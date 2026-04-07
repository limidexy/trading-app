import React, { useEffect, useRef, useState } from 'react';
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

type DraftState = 'idle' | 'saving' | 'saved' | 'error';

function getDraftKey(date: string) {
  return `today-reflection-draft:${date}`;
}

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function getResponseErrorMessage(status: number, payload: any) {
  if (status === 401) return payload?.error || '登录已失效，请重新登录';
  if (status >= 500) return payload?.error || '服务器异常，请稍后再试';
  return payload?.error || '保存失败，请稍后重试';
}

export default function TodayReflection() {
  const { selectedDate } = useDate();
  const [reflection, setReflection] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedServerData, setHasLoadedServerData] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draftState, setDraftState] = useState<DraftState>('idle');
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    void fetchData();
  }, [selectedDate]);

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [reflection]);

  useEffect(() => {
    if (!hasLoadedServerData) return;
    localStorage.setItem(getDraftKey(selectedDate), JSON.stringify({ reflection, imageUrl }));
    setDraftState('saved');
    const timer = window.setTimeout(() => {
      setDraftState((current) => (current === 'saved' ? 'idle' : current));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [reflection, imageUrl, selectedDate, hasLoadedServerData]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const fetchData = async () => {
    setIsLoading(true);
    const localDraft = localStorage.getItem(getDraftKey(selectedDate));

    try {
      const reflectionRes = await apiFetch(`/api/today-reflection?date=${selectedDate}`);
      const reflectionResult = await reflectionRes.json();

      const prevDate = dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD');
      const planRes = await apiFetch(`/api/tomorrow-plan?date=${prevDate}`);
      const planResult = await planRes.json();
      setPlanItems(planResult.success && Array.isArray(planResult.data) ? planResult.data : []);

      if (reflectionRes.ok && reflectionResult.success && reflectionResult.data) {
        setReflection(reflectionResult.data.content || '');
        setImageUrl(reflectionResult.data.image_url || '');
      } else if (localDraft) {
        const draft = JSON.parse(localDraft);
        setReflection(draft.reflection || '');
        setImageUrl(draft.imageUrl || '');
      } else {
        setReflection('');
        setImageUrl('');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (localDraft) {
        const draft = JSON.parse(localDraft);
        setReflection(draft.reflection || '');
        setImageUrl(draft.imageUrl || '');
        toast.info('网络异常，已恢复本地草稿');
      } else {
        toast.error('获取今日复盘失败，请检查网络后重试');
      }
    } finally {
      setHasLoadedServerData(true);
      setIsDirty(false);
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
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }

      setPlanItems((items) => items.map((item) => (item.id === id ? { ...item, is_completed: !currentStatus } : item)));
    } catch (error) {
      console.error('Toggle error:', error);
      toast.error('更新执行状态失败，请检查网络后重试');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('只能上传图片文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片不能超过 10MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiFetch('/api/upload?folder=reflections', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }

      setImageUrl(result.url);
      setIsDirty(true);
      toast.success('复盘图片上传成功');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('图片上传失败，请检查网络后重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!reflection.trim() && !imageUrl) {
      toast.error('请至少填写复盘内容或上传一张图片');
      return;
    }

    setIsSaving(true);
    setDraftState('saving');

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
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        setDraftState('error');
        return;
      }

      localStorage.removeItem(getDraftKey(selectedDate));
      setDraftState('saved');
      setIsDirty(false);
      toast.success('今日复盘已保存');
    } catch (error) {
      console.error('Save error:', error);
      setDraftState('error');
      toast.error('网络连接失败，草稿已保存在本地');
    } finally {
      setIsSaving(false);
    }
  };

  const getDraftHint = () => {
    if (isSaving || draftState === 'saving') return '正在保存复盘内容...';
    if (draftState === 'saved' && isDirty) return '草稿已自动保存';
    if (draftState === 'saved' && !isDirty) return '内容已保存到服务器';
    if (draftState === 'error') return '自动保存失败，草稿仍保留在本地';
    if (isDirty) return '正在记录修改';
    return '复盘内容会自动保存草稿';
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
  const displayedReflection = expanded ? reflection : reflection.slice(0, 220);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-5xl space-y-8">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold tracking-tight">今日复盘</h2>
        <p className="text-sm leading-relaxed text-on-surface-variant">记录今天的执行情况、情绪变化、得失总结和下一步改进方向。</p>
      </div>

      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
        {getDraftHint()}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-primary" />
              <h3 className="text-lg font-bold">计划执行情况</h3>
              <button onClick={fetchData} className="ml-2 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container" title="刷新">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {planItems.length > 0 ? (
              <div className="space-y-6">
                {pendingItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-on-surface-variant/70">
                      <Square className="h-3 w-3" />
                      待执行
                    </div>
                    {pendingItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => togglePlanItem(item.id, item.is_completed)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-outline-variant/15 bg-surface px-4 py-4 text-left transition-all hover:border-primary/25 hover:bg-surface-container"
                      >
                        <Square className="mt-1 h-5 w-5 shrink-0 text-on-surface-variant/50" />
                        <span className="whitespace-pre-wrap break-words leading-7 text-on-surface">{item.content}</span>
                      </button>
                    ))}
                  </div>
                )}

                {completedItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary/70">
                      <CheckSquare className="h-3 w-3" />
                      已完成
                    </div>
                    {completedItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => togglePlanItem(item.id, item.is_completed)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-left"
                      >
                        <CheckSquare className="mt-1 h-5 w-5 shrink-0 text-primary" />
                        <span className="whitespace-pre-wrap break-words leading-7 text-on-surface/75 line-through decoration-primary/30">{item.content}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface px-4 py-10 text-center text-sm text-on-surface-variant">
                今天没有关联到前一天的计划内容。
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm md:p-8">
            <div className="mb-5 flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-primary" />
              <h3 className="text-lg font-bold">复盘内容</h3>
            </div>

            <textarea
              ref={textareaRef}
              rows={8}
              value={reflection}
              placeholder="记录今天做对了什么、做错了什么、情绪状态如何、明天应该避免什么。"
              className="min-h-[260px] w-full resize-none overflow-hidden rounded-2xl bg-surface px-5 py-4 leading-8 text-on-surface outline-none ring-1 ring-transparent transition-all placeholder:text-on-surface-variant/45 focus:ring-2 focus:ring-primary/30"
              onChange={(event) => {
                setReflection(event.target.value);
                setIsDirty(true);
              }}
              onInput={(event) => autoResize(event.currentTarget)}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(event) => {
                isComposingRef.current = false;
                setReflection(event.currentTarget.value);
                setIsDirty(true);
                autoResize(event.currentTarget);
              }}
              onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            />

            {reflection.trim() && !isComposingRef.current && (
              <div className="mt-5 rounded-2xl bg-surface px-5 py-4">
                <div className="mb-2 text-sm font-bold text-on-surface-variant">预览</div>
                <p className="whitespace-pre-wrap break-words leading-8 text-on-surface">
                  {displayedReflection}
                  {!expanded && reflection.length > 220 ? '...' : ''}
                </p>
                {reflection.length > 220 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="mt-3 text-sm font-bold text-primary"
                  >
                    {expanded ? '收起内容' : '展开全部'}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-primary" />
              <h3 className="text-lg font-bold">复盘配图</h3>
            </div>

            <div className="space-y-4">
              <div className="group relative aspect-square overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant/25 bg-surface">
                {imageUrl ? (
                  <div className="relative h-full w-full">
                    <img src={imageUrl} alt="复盘配图" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    <button
                      onClick={() => {
                        setImageUrl('');
                        setIsDirty(true);
                      }}
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-on-surface-variant">
                    <Camera className="mb-3 h-10 w-10 opacity-25" />
                    <span className="text-sm">上传一张截图或复盘配图</span>
                  </div>
                )}

                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                  <span className="text-sm font-bold text-white">
                    {isUploading ? '正在上传图片...' : imageUrl ? '更换图片' : '选择图片'}
                  </span>
                </label>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant">建议上传关键分时图、K 线图或能辅助复盘的截图。</p>
            </div>
          </section>

          <button
            disabled={isSaving}
            onClick={handleSave}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {isSaving ? '正在保存今日复盘...' : '保存今日复盘'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
