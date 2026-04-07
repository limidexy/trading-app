import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, Loader2, LockKeyhole, Save, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { useUser } from '@/contexts/UserContext';
import { apiFetch } from '@/lib/api';

type DraftState = 'idle' | 'saving' | 'saved' | 'error';

function getDraftKey() {
  return 'profile-draft';
}

function formatDateTime(value?: string | null) {
  if (!value) return '暂无记录';
  return dayjs(value).format('YYYY/MM/DD HH:mm');
}

function getResponseErrorMessage(status: number, payload: any) {
  if (status === 401) return payload?.error || '登录已失效，请重新登录';
  if (status >= 500) return payload?.error || '服务器异常，请稍后再试';
  return payload?.error || '操作失败，请稍后重试';
}

export default function Profile() {
  const { user, profile, setProfile, refreshProfile } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draftState, setDraftState] = useState<DraftState>('idle');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const draft = localStorage.getItem(getDraftKey());
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft);
      setProfile({
        ...profile,
        username: parsed.username ?? profile.username,
        avatar_url: parsed.avatar_url ?? profile.avatar_url,
      });
    } catch {
      // ignore invalid drafts
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      getDraftKey(),
      JSON.stringify({
        username: profile.username,
        avatar_url: profile.avatar_url,
      }),
    );
    if (isDirty) {
      setDraftState('saved');
      const timer = window.setTimeout(() => {
        setDraftState((current) => (current === 'saved' ? 'idle' : current));
      }, 1400);
      return () => window.clearTimeout(timer);
    }
  }, [profile.username, profile.avatar_url, isDirty]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty && !passwordForm.currentPassword && !passwordForm.newPassword && !passwordForm.confirmPassword) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, passwordForm]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('只能上传图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('头像图片不能超过 10MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch('/api/upload?folder=avatars', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }
      setProfile({ ...profile, avatar_url: result.url });
      setIsDirty(true);
      toast.success('头像上传成功');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('头像上传失败，请检查网络后重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.username.trim()) {
      toast.error('请填写昵称');
      return;
    }

    setIsSaving(true);
    setDraftState('saving');
    try {
      const response = await apiFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          username: profile.username.trim(),
          avatar_url: profile.avatar_url,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        setDraftState('error');
        return;
      }

      await refreshProfile();
      setIsDirty(false);
      setDraftState('saved');
      localStorage.removeItem(getDraftKey());
      toast.success('个人资料已保存');
    } catch (error) {
      console.error('Save error:', error);
      setDraftState('error');
      toast.error('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('请完整填写密码信息');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码至少需要 6 位');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await apiFetch('/api/profile/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('密码修改成功');
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('修改密码失败，请稍后重试');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const draftHint =
    isSaving || draftState === 'saving'
      ? '正在保存个人资料...'
      : draftState === 'saved' && isDirty
        ? '草稿已自动保存'
        : draftState === 'saved'
          ? '资料已保存到服务器'
          : draftState === 'error'
            ? '自动保存失败，草稿仍保留在本地'
            : '资料修改会自动保存草稿';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="mb-2 text-3xl font-bold tracking-tight">个人设置</h2>
        <p className="text-sm leading-6 text-on-surface-variant">管理头像、昵称、账号只读信息和登录密码。</p>
      </div>

      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
        {draftHint}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm md:p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="group relative cursor-pointer" onClick={handleAvatarClick}>
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-surface-container bg-surface-container-low">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="头像" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-16 w-16 text-on-surface-variant/30" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-8 w-8 text-white" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">点击更换头像</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-on-surface-variant">昵称</label>
              <input
                className="h-12 w-full rounded-2xl bg-surface px-4 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
                type="text"
                value={profile.username}
                onChange={(e) => {
                  setProfile({ ...profile, username: e.target.value });
                  setIsDirty(true);
                }}
                placeholder="请输入你的昵称"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
              {isSaving ? '正在保存个人资料...' : '保存个人资料'}
            </button>
          </div>
        </section>

        <div className="space-y-8">
          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">账号信息</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div className="rounded-2xl bg-surface px-4 py-4">
                <div className="mb-1 text-on-surface-variant">用户 ID</div>
                <div className="font-bold text-on-surface">{user?.id ?? '暂无记录'}</div>
              </div>
              <div className="rounded-2xl bg-surface px-4 py-4">
                <div className="mb-1 text-on-surface-variant">注册时间</div>
                <div className="font-bold text-on-surface">{formatDateTime(profile.created_at)}</div>
              </div>
              <div className="rounded-2xl bg-surface px-4 py-4">
                <div className="mb-1 text-on-surface-variant">最近登录时间</div>
                <div className="font-bold text-on-surface">{formatDateTime(profile.last_login_at)}</div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">修改密码</h3>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((current) => ({ ...current, currentPassword: e.target.value }))}
                placeholder="当前密码"
                className="h-12 w-full rounded-2xl bg-surface px-4 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))}
                placeholder="新密码（至少 6 位）"
                className="h-12 w-full rounded-2xl bg-surface px-4 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))}
                placeholder="再次输入新密码"
                className="h-12 w-full rounded-2xl bg-surface px-4 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
              />

              <button
                onClick={handlePasswordChange}
                disabled={isChangingPassword}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-on-surface py-3 font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
              >
                {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                {isChangingPassword ? '正在修改密码...' : '确认修改密码'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
