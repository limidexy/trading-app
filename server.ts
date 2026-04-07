import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import COS from 'cos-nodejs-sdk-v5';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'trading_app_secret_key_2024';
const upload = multer({ storage: multer.memoryStorage() });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trading_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID || '',
  SecretKey: process.env.COS_SECRET_KEY || '',
});

const BUCKET = process.env.COS_BUCKET || '';
const REGION = process.env.COS_REGION || '';

interface JwtUser {
  id: number;
  username: string;
}

interface AuthedRequest extends express.Request {
  user?: JwtUser;
  file?: any;
}

app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  if (!req.url.startsWith('/@') && !req.url.includes('node_modules')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

function signToken(user: JwtUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

function getAuthUser(req: express.Request): JwtUser | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as JwtUser;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: '未登录或登录已失效' });
    return;
  }
  req.user = user;
  next();
}

function getProxyUrl(urlOrKey: string | null) {
  if (!urlOrKey) return '';
  if (urlOrKey.startsWith('/api/proxy-image')) return urlOrKey;

  let key = urlOrKey;
  if (urlOrKey.includes('.myqcloud.com/')) {
    const parts = urlOrKey.split('.myqcloud.com/');
    if (parts[1]) {
      key = parts[1].split('?')[0];
    }
  }
  return `/api/proxy-image?key=${encodeURIComponent(key)}`;
}

async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP NULL DEFAULT NULL
      )
    `);

    try {
      await connection.query('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL');
    } catch {
      // Column already exists.
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        user_id INT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        avatar_url VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_thinking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        question_id VARCHAR(10) NOT NULL,
        answer TEXT,
        style VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tomorrow_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        plan_item TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS today_reflections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        reflection_text TEXT,
        file_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS today_operations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        stock_name VARCHAR(100),
        logic TEXT,
        profit_loss DECIMAL(10, 2),
        screenshot_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connection.release();
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Trading app API is running' });
});

app.get('/api/proxy-image', async (req, res) => {
  const key = req.query.key as string;
  if (!key || !BUCKET || !REGION) {
    res.status(400).send('Missing COS config or key');
    return;
  }

  cos.getObject({ Bucket: BUCKET, Region: REGION, Key: key }, (err, data) => {
    if (err) {
      console.error('Proxy error:', err);
      res.status(err.statusCode || 500).send(err.message);
      return;
    }

    if (data.headers['content-type']) {
      res.setHeader('Content-Type', data.headers['content-type']);
    }
    if (data.headers['content-length']) {
      res.setHeader('Content-Length', data.headers['content-length']);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(data.Body);
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, avatarUrl } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword],
    );

    const user = { id: result.insertId, username };
    await pool.execute('INSERT INTO user_profile (user_id, username, avatar_url) VALUES (?, ?, ?)', [
      user.id,
      username,
      avatarUrl || null,
    ]);

    res.json({ success: true, token: signToken(user), user });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.execute<any[]>('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const payload = { id: user.id, username: user.username };
    await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    res.json({ success: true, token: signToken(payload), user: payload });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

app.post('/api/logout', (_req, res) => {
  res.json({ success: true, message: '已退出登录' });
});

app.get('/api/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    res.json({ success: true, authenticated: false });
    return;
  }
  res.json({ success: true, authenticated: true, user });
});

app.get('/api/profile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT p.*, u.created_at, u.last_login_at
       FROM user_profile p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`,
      [req.user!.id],
    );
    const profile = rows[0] || { username: req.user!.username, avatar_url: '', created_at: null, last_login_at: null };
    if (profile.avatar_url) {
      profile.avatar_url = getProxyUrl(profile.avatar_url);
    }
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, error: '获取个人资料失败' });
  }
});

app.post('/api/profile/password', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: '请完整填写当前密码和新密码' });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({ success: false, error: '新密码至少需要 6 位' });
      return;
    }

    const [rows] = await pool.execute<any[]>('SELECT password FROM users WHERE id = ?', [req.user!.id]);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const matched = await bcrypt.compare(currentPassword, user.password);
    if (!matched) {
      res.status(400).json({ success: false, error: '当前密码不正确' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user!.id]);
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: '修改密码失败，请稍后重试' });
  }
});

app.post('/api/profile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { username, avatar_url } = req.body;
    await pool.execute(
      'UPDATE user_profile SET username = ?, avatar_url = ? WHERE user_id = ?',
      [username || req.user!.username, avatar_url || null, req.user!.id],
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: '更新个人资料失败' });
  }
});

app.get('/api/daily-thinking', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const date = req.query.date;
    const [rows] = await pool.execute<any[]>(
      'SELECT question_id as id, answer as content, style FROM daily_thinking WHERE date = ? AND user_id = ? ORDER BY question_id ASC',
      [date, req.user!.id],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Daily thinking fetch error:', error);
    res.status(500).json({ success: false, error: '获取每日思考失败' });
  }
});

app.post('/api/daily-thinking', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { date, items, style } = req.body;
    await pool.execute('DELETE FROM daily_thinking WHERE date = ? AND user_id = ?', [date, req.user!.id]);

    if (Array.isArray(items)) {
      for (const item of items) {
        await pool.execute(
          'INSERT INTO daily_thinking (user_id, date, question_id, answer, style) VALUES (?, ?, ?, ?, ?)',
          [req.user!.id, date, item.id || '00', item.content || '', style || ''],
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Daily thinking save error:', error);
    res.status(500).json({ success: false, error: '保存每日思考失败' });
  }
});

app.get('/api/tomorrow-plan', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const date = req.query.date;
    const [rows] = await pool.execute<any[]>(
      'SELECT id, plan_item as content, is_completed FROM tomorrow_plans WHERE date = ? AND user_id = ? ORDER BY id ASC',
      [date, req.user!.id],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Tomorrow plan fetch error:', error);
    res.status(500).json({ success: false, error: '获取明日计划失败' });
  }
});

app.post('/api/tomorrow-plan', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { date, items } = req.body;
    await pool.execute('DELETE FROM tomorrow_plans WHERE date = ? AND user_id = ?', [date, req.user!.id]);
    for (const item of items || []) {
      await pool.execute('INSERT INTO tomorrow_plans (user_id, date, plan_item) VALUES (?, ?, ?)', [
        req.user!.id,
        date,
        item,
      ]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Tomorrow plan save error:', error);
    res.status(500).json({ success: false, error: '保存明日计划失败' });
  }
});

app.post('/api/tomorrow-plan/toggle', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id, is_completed } = req.body;
    await pool.execute('UPDATE tomorrow_plans SET is_completed = ? WHERE id = ? AND user_id = ?', [
      is_completed ? 1 : 0,
      id,
      req.user!.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Tomorrow plan toggle error:', error);
    res.status(500).json({ success: false, error: '更新执行状态失败' });
  }
});

app.get('/api/today-reflection', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const date = req.query.date;
    const [rows] = await pool.execute<any[]>(
      'SELECT reflection_text as content, file_url as image_url FROM today_reflections WHERE date = ? AND user_id = ? LIMIT 1',
      [date, req.user!.id],
    );
    const data = rows[0] || null;
    if (data?.image_url) {
      data.image_url = getProxyUrl(data.image_url);
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Today reflection fetch error:', error);
    res.status(500).json({ success: false, error: '获取今日复盘失败' });
  }
});

app.post('/api/today-reflection', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { date, content, imageUrl } = req.body;
    await pool.execute('DELETE FROM today_reflections WHERE date = ? AND user_id = ?', [date, req.user!.id]);
    await pool.execute(
      'INSERT INTO today_reflections (user_id, date, reflection_text, file_url) VALUES (?, ?, ?, ?)',
      [req.user!.id, date, content || '', imageUrl || null],
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Today reflection save error:', error);
    res.status(500).json({ success: false, error: '保存今日复盘失败' });
  }
});

app.get('/api/today-operation', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const date = req.query.date;
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM today_operations WHERE date = ? AND user_id = ? ORDER BY created_at ASC',
      [date, req.user!.id],
    );
    const data = rows.map((row) => ({
      ...row,
      screenshot_url: row.screenshot_url ? getProxyUrl(row.screenshot_url) : '',
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Today operation fetch error:', error);
    res.status(500).json({ success: false, error: '获取今日操作失败' });
  }
});

app.post('/api/today-operation', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id, date, stockName, profitLoss, logic, screenshotUrl } = req.body;
    if (id) {
      await pool.execute(
        'UPDATE today_operations SET stock_name = ?, logic = ?, profit_loss = ?, screenshot_url = ? WHERE id = ? AND user_id = ?',
        [stockName || null, logic || '', profitLoss || 0, screenshotUrl || null, id, req.user!.id],
      );
    } else {
      await pool.execute(
        'INSERT INTO today_operations (user_id, date, stock_name, logic, profit_loss, screenshot_url) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user!.id, date, stockName || null, logic || '', profitLoss || 0, screenshotUrl || null],
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Today operation save error:', error);
    res.status(500).json({ success: false, error: '保存今日操作失败' });
  }
});

app.delete('/api/today-operation/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await pool.execute('DELETE FROM today_operations WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Today operation delete error:', error);
    res.status(500).json({ success: false, error: '删除今日操作失败' });
  }
});

app.post('/api/upload', (req: AuthedRequest, _res, next) => {
  req.user = getAuthUser(req) || undefined;
  next();
}, upload.single('file'), async (req: AuthedRequest, res) => {
  try {
    const folder = (req.query.folder as string) || 'general';
    if (!req.user && folder !== 'avatars') {
      res.status(401).json({ success: false, error: '未登录时仅允许上传头像' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: '未检测到上传文件' });
      return;
    }

    if (!BUCKET || !REGION) {
      res.status(500).json({ success: false, error: 'COS 配置不完整' });
      return;
    }

    const fileName = `ledger/${folder}/${Date.now()}-${req.file.originalname}`;
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: fileName,
        Body: req.file.buffer,
      },
      (err) => {
        if (err) {
          console.error('COS upload error:', err);
          res.status(500).json({ success: false, error: '文件上传失败' });
          return;
        }
        res.json({ success: true, url: getProxyUrl(fileName), name: fileName });
      },
    );
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: '上传失败' });
  }
});

async function setupFrontend() {
  if (!isProduction || !fs.existsSync(path.join(__dirname, 'dist'))) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    return;
  }

  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.all('/api/*', (_req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Error Handler:', err);
  if (res.headersSent) {
    next(err);
    return;
  }

  if (req.url.startsWith('/api/')) {
    res.status(err.status || 500).json({
      success: false,
      error: '服务器内部错误',
      message: err.message,
    });
    return;
  }

  res.status(500).send('Internal server error');
});

async function start() {
  await initDatabase();
  await setupFrontend();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
