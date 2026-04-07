import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, CheckSquare, Loader2, RefreshCw, Save, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { useDate } from '@/contexts/DateContext';
import { apiFetch } from '@/lib/api';

interface PlanItem {
  id: number;
  content: string;
  is_completed: boolean;
}

export default function TodayReflection() {
  const { selectedDate } = useDate();
  const [reflection, setReflection] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const reflectionRes = await apiFetch(`/api/today-reflection?date=${selectedDate}`);
      const reflectionResult = await reflectionRes.json();
      setReflection(reflectionResult.success && reflectionResult.data ? reflectionResult.data.content || '' : '');
      setImageUrl(reflectionResult.success && reflectionResult.data ? reflectionResult.data.image_url || '' : '');

      const prevDate = dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD');
      const planRes = await apiFetch(`/api/tomorrow-plan?date=${prevDate}`);
      const planResult = await planRes.json();
      setPlanItems(planResult.success && planResult.data ? planResult.data : []);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlanItem = async (id: number, currentStatus: boolean) => {
    try {
      const response = await apiFetch('/api/tomorrow-plan/toggle', {
        method: 'POST',
        body: JSON.stringify({ id, is_completed: !currentStatus }),
      });
      const result = await response.json();
      if (result.success) {
        setPlanItems((items) =>
          items.map((item) => (item.id === id ? { ...item, is_completed: !currentStatus } : item)),
        );
      }
    } catch (error) {
      console.error('Toggle error:', error);
      toast.error('更新执行状态失败');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch('/api/upload?folder=reflections', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setImageUrl(result.url);
        toast.success('图片上传成功');
      } else {
        toast.error(result.error || '图片上传失败');
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
      const response = await apiFetch('/api/today-reflection', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          content: reflection,
          imageUrl,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('今日复盘已保存');
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('无法连接到服务器');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingItems = planItems.filter((item) => !item.is_completed);
  const completedItems = planItems.filter((item) => item.is_completed);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-5xl space-y-8">
      <div className="mb-10">
        <h2 className="mb-2 text-3xl font-bold tracking-tight">今日复盘</h2>
        <p className="text-sm font-medium uppercase tracking-wider text-on-surface-variant">
          Daily market reflection & learning
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <div className="h-6 w-1 bg-primary" />
              <h2 className="text-lg font-extrabold tracking-tight">执行情况</h2>
              <button
                onClick={fetchData}
                className="ml-2 rounded-full p-1 transition-colors hover:bg-surface-container-low"
                title="刷新"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-on-surface-variant/40 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {planItems.length > 0 ? (
              <div className="space-y-8">
                {pendingItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                      <Square className="h-3 w-3" />
                      待执行
                    </h3>
                    <div className="grid gap-3">
                      {pendingItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => togglePlanItem(item.id, item.is_completed)}
                          className="group flex w-full items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 text-left transition-all hover:border-primary/40 hover:bg-surface-container-high"
                        >
                          <Square className="h-5 w-5 shrink-0 text-on-surface-variant/30 group-hover:text-primary/40" />
                          <span className="font-medium text-on-surface">{item.content}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {completedItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                      <CheckSquare className="h-3 w-3" />
                      已完成
                    </h3>
                    <div className="grid gap-3">
                      {completedItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => togglePlanItem(item.id, item.is_completed)}
                          className="flex w-full items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left text-on-surface/60 transition-all"
                        >
                          <CheckSquare className="h-5 w-5 shrink-0 text-primary" />
                          <span className="font-medium line-through decoration-primary/30">{item.content}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-outline-variant/20 bg-surface-container-low/30 py-10 text-center">
                <p className="text-sm font-medium italic text-on-surface-variant/50">今天没有关联到前一天的计划项。</p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <div className="h-6 w-1 bg-primary" />
              <h2 className="text-lg font-extrabold tracking-tight">复盘心得</h2>
            </div>
            <textarea
              className="min-h-[400px] w-full rounded bg-surface-container-low p-6 leading-relaxed text-on-surface placeholder:text-neutral-400 focus:ring-0"
              placeholder="记录今天的市场感受、交易得失、情绪波动和改进点..."
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <div className="h-6 w-1 bg-primary" />
              <h2 className="text-lg font-extrabold tracking-tight">复盘配图</h2>
            </div>

            <div className="space-y-4">
              <div className="group relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low">
                {imageUrl ? (
                  <div className="relative h-full w-full">
                    <img src={imageUrl} alt="Reflection" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setImageUrl('')}
                      className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-on-surface-variant">
                    <Camera className="mb-2 h-10 w-10 opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-40">未上传图片</span>
                  </div>
                )}

                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  <span className="text-sm font-bold uppercase tracking-widest text-white">
                    {isUploading ? '上传中...' : imageUrl ? '更换图片' : '点击上传'}
                  </span>
                </label>
              </div>
            </div>
          </section>

          <button
            disabled={isSaving}
            onClick={handleSave}
            className="w-full rounded bg-primary py-4 shadow-md transition-all duration-150 hover:shadow-lg disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2">
              <Save className="h-4 w-4 text-white" />
              <span className="font-headline font-bold uppercase tracking-widest text-white">
                {isSaving ? '保存中...' : '保存复盘'}
              </span>
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
