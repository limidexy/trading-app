import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Camera, Loader2, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, checkAuth } = useUser();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [navigate, user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload?folder=avatars', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setAvatarUrl(result.url);
        toast.success('头像上传成功');
      } else {
        toast.error(result.error || '头像上传失败');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('头像上传失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !confirmPassword) {
      toast.error('请完整填写注册信息');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, avatarUrl }),
      });
      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || '注册失败');
        return;
      }

      if (result.token) {
        localStorage.setItem('auth_token', result.token);
      }

      await checkAuth();
      toast.success('注册成功');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Register error:', error);
      toast.error('网络错误，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-xl"
      >
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">创建账号</h2>
          <p className="mt-2 text-sm text-on-surface-variant">开始记录你的交易复盘、计划和执行。</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="mb-4 flex flex-col items-center">
            <div className="group relative cursor-pointer" onClick={handleAvatarClick}>
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-outline-variant/30 bg-surface-container-low">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar Preview" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-on-surface-variant/30" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary">设置头像（可选）</p>
          </div>

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
              placeholder="请设置密码"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 transition-all focus:ring-2 focus:ring-primary"
              placeholder="请再次输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
            {isLoading ? '注册中...' : '立即注册'}
          </button>
        </form>

        <div className="mt-8 border-t border-outline-variant/10 pt-6 text-center">
          <p className="text-sm text-on-surface-variant">
            已有账号？{' '}
            <Link to="/login" className="font-bold text-primary hover:underline">
              去登录
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
