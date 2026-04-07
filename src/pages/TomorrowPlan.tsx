import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDate } from '@/contexts/DateContext';
import { apiFetch } from '@/lib/api';

type DraftState = 'idle' | 'saving' | 'saved' | 'error';

const createEmptyItems = () => ['', ''];

function getDraftKey(date: string) {
  return `tomorrow-plan-draft:${date}`;
}

function getResponseErrorMessage(status: number, payload: any) {
  if (status === 401) return payload?.error || '登录已失效，请重新登录';
  if (status >= 500) return payload?.error || '服务器异常，请稍后再试';
  return payload?.error || '保存失败，请稍后重试';
}

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export default function TomorrowPlan() {
  const { selectedDate } = useDate();
  const [items, setItems] = useState<string[]>(createEmptyItems());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedServerData, setHasLoadedServerData] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draftState, setDraftState] = useState<DraftState>('idle');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const textareasRef = useRef<Array<HTMLTextAreaElement | null>>([]);
  const composingIndexRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchData();
  }, [selectedDate]);

  useEffect(() => {
    textareasRef.current.forEach((textarea) => {
      if (textarea) autoResize(textarea);
    });
  }, [items]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (!hasLoadedServerData) return;
    if (composingIndexRef.current !== null) return;
    const draftKey = getDraftKey(selectedDate);
    localStorage.setItem(draftKey, JSON.stringify(items));
    setDraftState('saved');

    const timer = window.setTimeout(() => {
      setDraftState((current) => (current === 'saved' ? 'idle' : current));
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [items, selectedDate, hasLoadedServerData]);

  const fetchData = async () => {
    setIsLoading(true);
    const draftKey = getDraftKey(selectedDate);
    const localDraft = localStorage.getItem(draftKey);

    try {
      const response = await apiFetch(`/api/tomorrow-plan?date=${selectedDate}`);
      const result = await response.json();

      if (response.ok && result.success && result.data?.length > 0) {
        setItems(result.data.map((item: any) => item.content));
      } else if (localDraft) {
        setItems(JSON.parse(localDraft));
      } else {
        setItems(createEmptyItems());
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (localDraft) {
        setItems(JSON.parse(localDraft));
        toast.info('网络异常，已加载本地草稿');
      } else {
        toast.error('获取明日计划失败，请检查网络后重试');
        setItems(createEmptyItems());
      }
    } finally {
      setHasLoadedServerData(true);
      setIsDirty(false);
      setIsLoading(false);
    }
  };

  const updateItem = (index: number, value: string) => {
    const nextItems = [...items];
    nextItems[index] = value;
    setItems(nextItems);
    setIsDirty(true);
  };

  const addItem = () => {
    setItems([...items, '']);
    setIsDirty(true);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setItems(['']);
      setIsDirty(true);
      return;
    }
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const validItems = items.map((item) => item.trim()).filter(Boolean);
    if (validItems.length === 0) {
      toast.error('请至少填写一项计划内容');
      return;
    }

    setIsSaving(true);
    setDraftState('saving');

    try {
      const response = await apiFetch('/api/tomorrow-plan', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          items: validItems,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        setDraftState('error');
        return;
      }

      localStorage.removeItem(getDraftKey(selectedDate));
      setIsDirty(false);
      setDraftState('saved');
      toast.success('明日计划已保存');
    } catch (error) {
      console.error('Save error:', error);
      setDraftState('error');
      toast.error('网络连接失败，草稿已保存在本地');
    } finally {
      setIsSaving(false);
    }
  };

  const onDragStart = (index: number) => setDraggingIndex(index);

  const onDrop = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(draggingIndex, 1);
    nextItems.splice(targetIndex, 0, movedItem);
    setItems(nextItems);
    setIsDirty(true);
    setDraggingIndex(null);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    setItems(nextItems);
    setIsDirty(true);
  };

  const getDraftHint = () => {
    if (isSaving || draftState === 'saving') return '正在保存...';
    if (draftState === 'saved' && isDirty) return '草稿已自动保存';
    if (draftState === 'saved' && !isDirty) return '内容已保存到服务器';
    if (draftState === 'error') return '自动保存失败，草稿仍保留在本地';
    if (isDirty) return '正在记录修改';
    return '计划会自动保存草稿';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold tracking-tight">明日计划</h2>
        <p className="text-sm leading-relaxed text-on-surface-variant">记录下一交易日的关注方向、交易条件和执行要求。</p>
      </div>

      <div className="mb-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
        {getDraftHint()}
      </div>

      <div className="space-y-5">
        {items.map((item, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(index)}
            className="group relative rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-3 py-3 shadow-sm transition-all hover:border-primary/25"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-primary"
                title="拖拽排序"
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-2 text-xs font-bold tracking-[0.2em] text-outline-variant/70 tabular-nums">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <textarea
                  ref={(element) => {
                    textareasRef.current[index] = element;
                  }}
                  rows={1}
                  value={item}
                  placeholder="添加一项计划内容..."
                  className="min-h-[40px] w-full resize-none overflow-hidden rounded-xl bg-surface px-4 py-3 text-base font-medium leading-7 text-on-surface outline-none ring-1 ring-transparent transition-all placeholder:text-on-surface-variant/45 focus:ring-2 focus:ring-primary/30"
                  onChange={(event) => updateItem(index, event.target.value)}
                  onInput={(event) => autoResize(event.currentTarget)}
                  onCompositionStart={() => {
                    composingIndexRef.current = index;
                  }}
                  onCompositionEnd={(event) => {
                    composingIndexRef.current = null;
                    updateItem(index, event.currentTarget.value);
                    autoResize(event.currentTarget);
                  }}
                  onFocus={(event) => {
                    event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => removeItem(index)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant/40 transition-colors hover:bg-surface-container hover:text-primary"
                title="删除计划"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 pl-14 md:hidden">
              <button
                type="button"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
                className="flex h-10 items-center gap-1 rounded-xl bg-surface px-3 text-sm font-bold text-on-surface transition-all disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
                上移
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 'down')}
                disabled={index === items.length - 1}
                className="flex h-10 items-center gap-1 rounded-xl bg-surface px-3 text-sm font-bold text-on-surface transition-all disabled:opacity-40"
              >
                <ArrowDown className="h-4 w-4" />
                下移
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-5">
        <button
          onClick={addItem}
          className="flex min-h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest px-8 py-4 text-on-surface transition-all active:scale-[0.99] hover:border-primary/30 hover:bg-surface-container"
        >
          <Plus className="h-5 w-5" />
          <span className="text-base font-bold">添加新计划</span>
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isSaving ? '正在保存明日计划...' : '保存明日计划'}
        </button>
      </div>
    </motion.div>
  );
}
