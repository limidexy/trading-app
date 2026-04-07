import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, checkAuth } = useUser();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [navigate, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || '登录失败');
        return;
      }

      if (result.token) {
        localStorage.setItem('auth_token', result.token);
      }

      const isAuthed = await checkAuth();
      if (!isAuthed) {
        toast.error('登录成功，但同步用户状态失败');
        return;
      }

      toast.success('登录成功');
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error?.message || '网络连接失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-xl"
      >
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LogIn className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">欢迎回来</h2>
          <p className="mt-2 text-sm text-on-surface-variant">登录后即可继续记录交易、复盘和计划。</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 transition-all focus:ring-2 focus:ring-primary"
              placeholder="请输入用户名"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 transition-all focus:ring-2 focus:ring-primary"
              placeholder="请输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {isLoading ? '登录中...' : '立即登录'}
          </button>
        </form>

        <div className="mt-8 border-t border-outline-variant/10 pt-6 text-center">
          <p className="text-sm text-on-surface-variant">
            还没有账号？{' '}
            <Link to="/register" className="font-bold text-primary hover:underline">
              去注册
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
