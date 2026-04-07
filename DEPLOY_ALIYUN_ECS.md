# 阿里云香港 ECS 部署步骤

## 1. 服务器准备

- 系统建议：Ubuntu 22.04 LTS
- 开放端口：`22`、`80`、`443`
- 安装软件：

```bash
sudo apt update
sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. 上传代码

你可以用 `git clone`，或者本地压缩后上传到服务器，例如：

```bash
scp -r ./trading-app root@your-server-ip:/var/www/trading-app
```

## 3. 安装依赖并准备环境变量

```bash
cd /var/www/trading-app
npm install
cp .env.example .env
```

然后编辑 `.env`，把数据库、COS、JWT、SESSION 密钥改成正式值。

## 4. 构建并启动

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5. 配置 Nginx

把 `nginx.conf.example` 内容复制到：

```bash
sudo nano /etc/nginx/sites-available/trading-app
```

然后启用：

```bash
sudo ln -s /etc/nginx/sites-available/trading-app /etc/nginx/sites-enabled/trading-app
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 配置 HTTPS

如果域名已经解析到 ECS：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 7. 发布更新

```bash
cd /var/www/trading-app
git pull
npm install
npm run build
pm2 restart trading-app
```
