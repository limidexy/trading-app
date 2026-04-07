import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { apiFetch } from '@/lib/api';

export default function Profile() {
  const { profile, setProfile, refreshProfile } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const response = await apiFetch('/api/upload?folder=avatars', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setProfile({ ...profile, avatar_url: result.url });
        toast.success('头像上传成功');
      } else {
        toast.error(result.error || '头像上传失败');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('上传失败，请检查网络或 COS 配置');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('个人资料已保存');
        await refreshProfile();
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('保存失败，请检查服务器连接');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
      <div className="mb-10">
        <h2 className="mb-2 text-3xl font-bold tracking-tight">个人设置</h2>
        <p className="text-sm font-medium uppercase tracking-wider text-on-surface-variant">Profile & Identity</p>
      </div>

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
        <div className="mb-10 flex flex-col items-center">
          <div className="group relative cursor-pointer" onClick={handleAvatarClick}>
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-surface-container bg-surface-container-low">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
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
            <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">昵称</label>
            <input
              className="w-full border-none border-b-2 border-transparent bg-surface-container-low px-4 py-3 font-medium text-on-surface transition-all focus:border-primary focus:ring-0"
              type="text"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="请输入你的昵称"
            />
          </div>

          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {isSaving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">说明</h3>
        <ul className="space-y-2 text-xs leading-relaxed text-on-surface-variant">
          <li>头像图片上传到腾讯云 COS 存储。</li>
          <li>个人资料保存在 MySQL 数据库中。</li>
          <li>建议使用压缩后的图片，移动端体验会更好。</li>
        </ul>
      </div>
    </motion.div>
  );
}
