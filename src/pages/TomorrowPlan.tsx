import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDate } from '@/contexts/DateContext';
import { apiFetch } from '@/lib/api';

export default function TomorrowPlan() {
  const { selectedDate } = useDate();
  const [items, setItems] = useState<string[]>(['', '']);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const textareasRef = useRef<Array<HTMLTextAreaElement | null>>([]);

  useEffect(() => {
    void fetchData();
  }, [selectedDate]);

  useEffect(() => {
    textareasRef.current.forEach((textarea) => {
      if (!textarea) return;
      textarea.style.height = '0px';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [items]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/tomorrow-plan?date=${selectedDate}`);
      const result = await response.json();
      if (result.success && result.data?.length > 0) {
        setItems(result.data.map((item: any) => item.content));
      } else {
        setItems(['', '']);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = () => setItems([...items, '']);

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setItems(['']);
      return;
    }
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSave = async () => {
    const validItems = items.filter((item) => item.trim() !== '');
    if (validItems.length === 0) {
      toast.error('请至少填写一项计划');
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch('/api/tomorrow-plan', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          items: validItems,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('明日计划已保存');
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <div className="mb-10">
        <h2 className="mb-2 text-3xl font-bold tracking-tight">明日计划</h2>
        <p className="text-sm font-medium uppercase tracking-wider text-on-surface-variant">
          Set the intention for the next trading session
        </p>
      </div>

      <div className="space-y-6">
        {items.map((item, index) => (
          <div key={index} className="group relative flex items-start gap-2 bg-surface-container-low/50 p-1">
            <div className="flex flex-1 items-start gap-4 py-2">
              <span className="text-[10px] font-bold tracking-tighter text-outline-variant/30 tabular-nums">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <textarea
                ref={(element) => {
                  textareasRef.current[index] = element;
                }}
                rows={1}
                className="min-h-[32px] w-full resize-none overflow-hidden bg-transparent p-0 text-lg font-medium leading-relaxed text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0"
                placeholder="添加一项计划..."
                value={item}
                onChange={(e) => {
                  const nextItems = [...items];
                  nextItems[index] = e.target.value;
                  setItems(nextItems);
                }}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = '0px';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
            <button
              onClick={() => removeItem(index)}
              className="mt-1 p-2 text-on-surface-variant/40 opacity-0 transition-colors hover:text-primary group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-6">
        <button
          onClick={addItem}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded border border-outline-variant/20 bg-surface-container-high px-8 py-3 text-on-surface transition-all active:scale-95 hover:bg-surface-container-highest"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-bold uppercase tracking-wide">添加新计划</span>
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          {isSaving ? '保存中...' : '保存明日计划'}
        </button>
      </div>
    </motion.div>
  );
}
