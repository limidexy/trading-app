import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDate } from '@/contexts/DateContext';
import { apiFetch } from '@/lib/api';

const questions = [
  { id: '01', title: '今天市场有没有明显赚钱效应？', placeholder: '例如：高位抱团、低位轮动、量能变化等。' },
  { id: '02', title: '当前更偏向哪种风格？', placeholder: '例如：连板、趋势、容量、题材扩散。' },
  { id: '03', title: '龙头和核心标的是什么？', placeholder: '记录最能代表今天情绪和资金方向的股票。' },
  { id: '04', title: '主线题材是什么？', placeholder: '记录今天最强的板块、驱动逻辑和资金集中点。' },
  { id: '05', title: '你对这条主线的节奏判断是什么？', placeholder: '例如：第几天、是否高潮、是否分歧、明天怎么看。' },
];

export default function DailyThinking() {
  const { selectedDate } = useDate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/daily-thinking?date=${selectedDate}`);
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const nextAnswers: Record<string, string> = {};
        result.data.forEach((item: any) => {
          nextAnswers[item.id] = item.content || '';
        });
        setAnswers(nextAnswers);
      } else {
        setAnswers({});
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = questions.map((question) => ({
        id: question.id,
        content: answers[question.id] || '',
      }));

      const response = await apiFetch('/api/daily-thinking', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          items: payload,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('今日思考已保存');
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-8">
      <section className="border-l-4 border-primary py-1 pl-4">
        <h2 className="text-2xl font-bold tracking-tight">每日思考</h2>
        <span className="mt-1 block text-sm uppercase tracking-widest text-on-surface-variant">Market sentiment analysis</span>
      </section>

      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.id} className="rounded-lg bg-surface-container-lowest p-6 shadow-sm transition-all">
            <div className="flex items-start gap-4">
              <div className="text-xl font-bold tabular-nums text-primary/50">{question.id}</div>
              <div className="flex-1">
                <label className="mb-4 block text-[15px] font-bold leading-relaxed text-on-surface">{question.title}</label>
                <textarea
                  className="w-full resize-none border-none border-b-2 border-transparent bg-surface-container-low p-3 text-sm transition-all placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-0"
                  placeholder={question.placeholder}
                  rows={3}
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" />
          {isSaving ? '保存中...' : '保存今日思考'}
        </button>
      </div>
    </motion.div>
  );
}
