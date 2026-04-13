import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, CalendarRange, CheckCircle2, Download, Image as ImageIcon, Loader2, Search, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useDate } from '@/contexts/DateContext';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const questions = [
  { id: '01', title: '今天市场有没有明显赚钱效应？', placeholder: '例如：高位抱团、低位轮动、量能变化等。' },
  { id: '02', title: '当前更偏向哪种风格？', placeholder: '例如：连板、趋势、容量、题材扩散。' },
  { id: '03', title: '龙头和核心标的是什么？', placeholder: '记录最能代表今天情绪和资金方向的股票。' },
  { id: '04', title: '主线题材是什么？', placeholder: '记录今天最强的板块、驱动逻辑和资金集中点。' },
  { id: '05', title: '你对这条主线的节奏判断是什么？', placeholder: '例如：第几天、是否高潮、是否分歧、明天怎么看。' },
];

interface DashboardDay {
  date: string;
  operationCount: number;
  profitLossTotal: number;
  uploadCount: number;
  planCompletionRate: number;
  hasReflection: boolean;
}

interface DashboardSummary {
  recentRecordDays: number;
  uploadCount: number;
  streakDays: number;
  averageCompletionRate: number;
}

interface ExportDayData {
  date: string;
  thinking: Array<{ id: string; content: string }>;
  operations: Array<{ stock_name: string; profit_loss: number; logic: string; screenshot_url?: string }>;
  reflection: { content?: string; image_url?: string } | null;
  plans: Array<{ content: string; is_completed?: boolean }>;
}

interface SearchResultItem {
  date: string;
  type: '思考' | '操作' | '复盘' | '计划';
  title: string;
  content: string;
  path: '/' | '/operation' | '/reflection' | '/plan';
}

function getThinkingDraftKey(date: string) {
  return `daily-thinking-draft:${date}`;
}

function normalizeRate(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getChartMax(values: number[]) {
  const max = Math.max(...values, 0);
  return max <= 0 ? 1 : max;
}

function getProfitRange(values: number[]) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const positive = max <= 0 ? 1 : max;
  const negative = Math.abs(min) <= 0 ? 1 : Math.abs(min);
  return { positive, negative };
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <div className="text-sm font-bold text-on-surface-variant">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-on-surface">{value}</div>
      <div className="mt-1 text-sm leading-6 text-on-surface-variant">{hint}</div>
    </div>
  );
}

function highlightKeyword(text: string, keyword: string) {
  if (!keyword.trim()) return [text];

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.split(regex).filter(Boolean).map((part, index) =>
    regex.test(part) ? (
      <mark key={`${part}-${index}`} className="rounded bg-primary/15 px-1 text-primary">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toAbsoluteUrl(url: string | undefined) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return `${window.location.origin}/${url}`;
}

function buildMarkdownExport(title: string, from: string, to: string, days: ExportDayData[]) {
  const lines: string[] = [];
  const totalOperations = days.reduce((sum, day) => sum + day.operations.length, 0);
  const totalProfitLoss = days.reduce(
    (sum, day) => sum + day.operations.reduce((daySum, item) => daySum + Number(item.profit_loss || 0), 0),
    0,
  );
  const totalUploads = days.reduce(
    (sum, day) =>
      sum
      + day.operations.filter((item) => item.screenshot_url).length
      + (day.reflection?.image_url ? 1 : 0),
    0,
  );
  const totalPlanCount = days.reduce((sum, day) => sum + day.plans.length, 0);
  const completedPlanCount = days.reduce(
    (sum, day) => sum + day.plans.filter((item) => item.is_completed).length,
    0,
  );
  const completionRate = totalPlanCount > 0 ? Math.round((completedPlanCount / totalPlanCount) * 100) : 0;

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`时间范围：${from} 至 ${to}`);
  lines.push('');
  lines.push('## 导出摘要');
  lines.push('');
  lines.push(`- 记录天数：${days.length} 天`);
  lines.push(`- 操作数量：${totalOperations} 条`);
  lines.push(`- 总盈亏：${totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toFixed(1)}%`);
  lines.push(`- 计划完成率：${completionRate}%`);
  lines.push(`- 图片数量：${totalUploads} 张`);
  lines.push('');

  days.forEach((day) => {
    lines.push(`## ${day.date}`);
    lines.push('');

    lines.push('### 每日思考');
    if (day.thinking.length > 0) {
      day.thinking.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.content || '未填写'}`);
      });
    } else {
      lines.push('- 无记录');
    }
    lines.push('');

    lines.push('### 今日操作');
    if (day.operations.length > 0) {
      day.operations.forEach((operation, index) => {
        lines.push(`#### 操作 ${index + 1}`);
        lines.push(`- 股票名称：${operation.stock_name || '未填写'}`);
        lines.push(`- 盈亏比例：${Number(operation.profit_loss || 0)}%`);
        lines.push(`- 交易逻辑：${operation.logic || '未填写'}`);
        if (operation.screenshot_url) {
          lines.push(`- 操作截图：![操作截图](${toAbsoluteUrl(operation.screenshot_url)})`);
        }
        lines.push('');
      });
    } else {
      lines.push('- 无记录');
      lines.push('');
    }

    lines.push('### 今日复盘');
    if (day.reflection?.content || day.reflection?.image_url) {
      lines.push(day.reflection?.content || '未填写文字内容');
      lines.push('');
      if (day.reflection?.image_url) {
        lines.push(`![复盘配图](${toAbsoluteUrl(day.reflection.image_url)})`);
        lines.push('');
      }
    } else {
      lines.push('- 无记录');
      lines.push('');
    }

    lines.push('### 明日计划');
    if (day.plans.length > 0) {
      day.plans.forEach((plan, index) => {
        const status = plan.is_completed ? '已完成' : '待执行';
        lines.push(`${index + 1}. [${status}] ${plan.content || '未填写'}`);
      });
    } else {
      lines.push('- 无记录');
    }
    lines.push('');
  });

  return lines.join('\n');
}

function MiniBarChart({
  title,
  subtitle,
  days,
  valueKey,
  formatter,
  colorClass,
  onSelectDay,
}: {
  title: string;
  subtitle: string;
  days: DashboardDay[];
  valueKey: keyof DashboardDay;
  formatter: (value: number) => string;
  colorClass: string;
  onSelectDay: (date: string) => void;
}) {
  const values = days.map((day) => Number(day[valueKey] || 0));
  const max = getChartMax(values);

  return (
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-1 text-lg font-bold text-on-surface">{title}</div>
      <div className="mb-5 text-sm text-on-surface-variant">{subtitle}</div>

      <div className="grid grid-cols-7 items-end gap-3">
        {days.map((day) => {
          const value = Number(day[valueKey] || 0);
          const height = Math.max((value / max) * 120, value > 0 ? 10 : 4);

          return (
            <button
              type="button"
              key={`${title}-${day.date}`}
              onClick={() => onSelectDay(day.date)}
              className="flex flex-col items-center gap-2 rounded-2xl px-2 py-2 transition-all hover:bg-surface"
            >
              <div className="text-[11px] font-bold text-on-surface-variant">{formatter(value)}</div>
              <div className="flex h-32 items-end">
                <div className={`w-7 rounded-t-2xl ${colorClass}`} style={{ height }} />
              </div>
              <div className="text-[10px] font-semibold tabular-nums tracking-[0.06em] text-on-surface-variant/70">
                {day.date.slice(5).replace('-', '/')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfitBarChart({ days, onSelectDay }: { days: DashboardDay[]; onSelectDay: (date: string) => void }) {
  const values = days.map((day) => Number(day.profitLossTotal || 0));
  const { positive, negative } = getProfitRange(values);

  return (
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-1 text-lg font-bold text-on-surface">盈亏统计</div>
      <div className="mb-5 text-sm text-on-surface-variant">按天汇总今日操作的盈亏比例，0 轴以上为盈利，以下为亏损。</div>

      <div className="grid grid-cols-7 items-end gap-3">
        {days.map((day) => {
          const value = Number(day.profitLossTotal || 0);
          const positiveHeight = value > 0 ? Math.max((value / positive) * 56, 10) : 0;
          const negativeHeight = value < 0 ? Math.max((Math.abs(value) / negative) * 56, 10) : 0;

          return (
            <button
              type="button"
              key={`profit-${day.date}`}
              onClick={() => onSelectDay(day.date)}
              className="flex flex-col items-center gap-2 rounded-2xl px-2 py-2 transition-all hover:bg-surface"
            >
              <div className={cn('text-[11px] font-bold', value < 0 ? 'text-red-600' : 'text-on-surface-variant')}>
                {value >= 0 ? '+' : ''}
                {value.toFixed(1)}
              </div>

              <div className="flex h-32 flex-col justify-center">
                <div className="flex h-[56px] items-end justify-center">
                  {positiveHeight > 0 ? <div className="w-7 rounded-t-2xl bg-primary" style={{ height: positiveHeight }} /> : <div className="w-7" />}
                </div>

                <div className="h-[2px] w-9 rounded-full bg-outline-variant/60" />

                <div className="flex h-[56px] items-start justify-center">
                  {negativeHeight > 0 ? <div className="w-7 rounded-b-2xl bg-red-500" style={{ height: negativeHeight }} /> : <div className="w-7" />}
                </div>
              </div>

              <div className="text-[10px] font-semibold tabular-nums tracking-[0.06em] text-on-surface-variant/70">
                {day.date.slice(5).replace('-', '/')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DailyThinking() {
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useDate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardDays, setDashboardDays] = useState<DashboardDay[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    recentRecordDays: 0,
    uploadCount: 0,
    streakDays: 0,
    averageCompletionRate: 0,
  });
  const [isExporting, setIsExporting] = useState<'week' | 'month' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRange, setSearchRange] = useState<7 | 30 | 90>(30);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    void fetchThinking();
    void fetchDashboard();
  }, [selectedDate]);

  useEffect(() => {
    const draft = localStorage.getItem(getThinkingDraftKey(selectedDate));
    if (draft) {
      setAnswers(JSON.parse(draft));
    }
  }, [selectedDate]);

  useEffect(() => {
    localStorage.setItem(getThinkingDraftKey(selectedDate), JSON.stringify(answers));
  }, [answers, selectedDate]);

  const fetchThinking = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/daily-thinking?date=${selectedDate}`);
      const result = await response.json();
      if (response.ok && result.success && Array.isArray(result.data) && result.data.length > 0) {
        const nextAnswers: Record<string, string> = {};
        result.data.forEach((item: any) => {
          nextAnswers[item.id] = item.content || '';
        });
        setAnswers(nextAnswers);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    try {
      const days = Array.from({ length: 7 }, (_, index) =>
        dayjs(selectedDate).subtract(6 - index, 'day').format('YYYY-MM-DD'),
      );

      const dashboardResults = await Promise.all(
        days.map(async (date) => {
          const previousDate = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');

          const [operationRes, reflectionRes, planRes, pnlRes] = await Promise.all([
            apiFetch(`/api/today-operation?date=${date}`),
            apiFetch(`/api/today-reflection?date=${date}`),
            apiFetch(`/api/tomorrow-plan?date=${previousDate}`),
            apiFetch(`/api/daily-pnl?date=${date}`),
          ]);

          const [operationJson, reflectionJson, planJson, pnlJson] = await Promise.all([
            operationRes.json(),
            reflectionRes.json(),
            planRes.json(),
            pnlRes.json(),
          ]);

          const operations = Array.isArray(operationJson?.data) ? operationJson.data : [];
          const reflection = reflectionJson?.data || null;
          const plans = Array.isArray(planJson?.data) ? planJson.data : [];

          const operationCount = operations.length;
          const profitLossTotal = Number(pnlJson?.data?.pnl ?? 0);
          const uploadCount =
            operations.filter((item: any) => item.screenshot_url).length + (reflection?.image_url ? 1 : 0);
          const completedPlans = plans.filter((item: any) => item.is_completed).length;
          const planCompletionRate = plans.length > 0 ? (completedPlans / plans.length) * 100 : 0;
          const hasReflection = Boolean(reflection?.content || reflection?.image_url);

          return {
            date,
            operationCount,
            profitLossTotal,
            uploadCount,
            planCompletionRate: normalizeRate(planCompletionRate),
            hasReflection,
          } satisfies DashboardDay;
        }),
      );

      const recentRecordDays = dashboardResults.filter((day) => day.operationCount > 0 || day.hasReflection).length;
      const uploadCount = dashboardResults.reduce((sum, day) => sum + day.uploadCount, 0);
      const averageCompletionRate = normalizeRate(
        dashboardResults.reduce((sum, day) => sum + day.planCompletionRate, 0) / Math.max(dashboardResults.length, 1),
      );

      let streakDays = 0;
      for (let i = dashboardResults.length - 1; i >= 0; i -= 1) {
        if (dashboardResults[i].hasReflection) streakDays += 1;
        else break;
      }

      setDashboardDays(dashboardResults);
      setSummary({
        recentRecordDays,
        uploadCount,
        streakDays,
        averageCompletionRate,
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error('总览数据加载失败，请稍后刷新页面重试');
    } finally {
      setDashboardLoading(false);
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
      if (!response.ok || !result.success) {
        toast.error(result?.error || '保存失败，请稍后重试');
        return;
      }
      localStorage.removeItem(getThinkingDraftKey(selectedDate));
      toast.success('每日思考已保存');
      void fetchDashboard();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('网络连接失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const exportRange = async (mode: 'week' | 'month') => {
    setIsExporting(mode);
    try {
      const start = mode === 'week' ? dayjs(selectedDate).subtract(6, 'day') : dayjs(selectedDate).startOf('month');
      const end = mode === 'week' ? dayjs(selectedDate) : dayjs(selectedDate).endOf('month');
      const days = Array.from({ length: end.diff(start, 'day') + 1 }, (_, index) => start.add(index, 'day').format('YYYY-MM-DD'));

      const result: ExportDayData[] = [];
      for (const date of days) {
        const previousDate = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
        const [thinkingRes, operationRes, reflectionRes, planRes] = await Promise.all([
          apiFetch(`/api/daily-thinking?date=${date}`),
          apiFetch(`/api/today-operation?date=${date}`),
          apiFetch(`/api/today-reflection?date=${date}`),
          apiFetch(`/api/tomorrow-plan?date=${previousDate}`),
        ]);

        const [thinkingJson, operationJson, reflectionJson, planJson] = await Promise.all([
          thinkingRes.json(),
          operationRes.json(),
          reflectionRes.json(),
          planRes.json(),
        ]);

        result.push({
          date,
          thinking: Array.isArray(thinkingJson?.data) ? thinkingJson.data : [],
          operations: Array.isArray(operationJson?.data) ? operationJson.data : [],
          reflection: reflectionJson?.data || null,
          plans: Array.isArray(planJson?.data) ? planJson.data : [],
        });
      }

      const filename =
        mode === 'week'
          ? `review-week-${start.format('YYYY-MM-DD')}_to_${end.format('YYYY-MM-DD')}.md`
          : `review-month-${start.format('YYYY-MM')}.md`;

      const title = mode === 'week' ? '交易复盘周导出' : '交易复盘月导出';
      const markdown = buildMarkdownExport(title, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), result);
      downloadMarkdown(filename, markdown);
      toast.success(mode === 'week' ? '周导出已生成' : '月导出已生成');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('导出失败，请稍后重试');
    } finally {
      setIsExporting(null);
    }
  };

  const runGlobalSearch = async () => {
    const keyword = searchQuery.trim();
    if (!keyword) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const days = Array.from({ length: searchRange }, (_, index) =>
        dayjs(selectedDate).subtract(index, 'day').format('YYYY-MM-DD'),
      );
      const collected: SearchResultItem[] = [];

      for (const date of days) {
        const previousDate = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
        const [thinkingRes, operationRes, reflectionRes, planRes] = await Promise.all([
          apiFetch(`/api/daily-thinking?date=${date}`),
          apiFetch(`/api/today-operation?date=${date}`),
          apiFetch(`/api/today-reflection?date=${date}`),
          apiFetch(`/api/tomorrow-plan?date=${previousDate}`),
        ]);

        const [thinkingJson, operationJson, reflectionJson, planJson] = await Promise.all([
          thinkingRes.json(),
          operationRes.json(),
          reflectionRes.json(),
          planRes.json(),
        ]);

        const thoughts = Array.isArray(thinkingJson?.data) ? thinkingJson.data : [];
        thoughts.forEach((item: any) => {
          if ((item.content || '').includes(keyword)) {
            collected.push({
              date,
              type: '思考',
              title: `问题 ${item.id}`,
              content: item.content || '',
              path: '/',
            });
          }
        });

        const operations = Array.isArray(operationJson?.data) ? operationJson.data : [];
        operations.forEach((item: any) => {
          if ((item.stock_name || '').includes(keyword) || (item.logic || '').includes(keyword)) {
            collected.push({
              date,
              type: '操作',
              title: item.stock_name || '未命名操作',
              content: item.logic || '',
              path: '/operation',
            });
          }
        });

        const reflection = reflectionJson?.data;
        if (reflection?.content && reflection.content.includes(keyword)) {
          collected.push({
            date,
            type: '复盘',
            title: '今日复盘',
            content: reflection.content,
            path: '/reflection',
          });
        }

        const plans = Array.isArray(planJson?.data) ? planJson.data : [];
        plans.forEach((item: any) => {
          if ((item.content || '').includes(keyword)) {
            collected.push({
              date,
              type: '计划',
              title: item.is_completed ? '已完成计划' : '待执行计划',
              content: item.content || '',
              path: '/plan',
            });
          }
        });
      }

      setSearchResults(collected);
      if (collected.length === 0) toast.info(`最近 ${searchRange} 天没有找到相关内容`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('搜索失败，请稍后重试');
    } finally {
      setSearching(false);
    }
  };

  const jumpToResult = (item: SearchResultItem) => {
    setSelectedDate(item.date);
    navigate(item.path);
  };

  const jumpToDate = (date: string, path: '/' | '/operation' | '/reflection' | '/plan' = '/') => {
    setSelectedDate(date);
    navigate(path);
  };

  const dashboardStats = useMemo(
    () => [
      {
        label: '近 7 天记录日',
        value: `${summary.recentRecordDays} 天`,
        hint: '统计近 7 天内至少有操作或复盘内容的天数',
        icon: <CalendarRange className="h-5 w-5" />,
      },
      {
        label: '计划完成率',
        value: `${summary.averageCompletionRate}%`,
        hint: '按近 7 天已完成计划占比计算',
        icon: <CheckCircle2 className="h-5 w-5" />,
      },
      {
        label: '上传数量',
        value: `${summary.uploadCount} 张`,
        hint: '包括操作截图与复盘配图',
        icon: <ImageIcon className="h-5 w-5" />,
      },
      {
        label: '复盘连续天数',
        value: `${summary.streakDays} 天`,
        hint: '从当前日期向前连续有复盘内容的天数',
        icon: <TrendingUp className="h-5 w-5" />,
      },
    ],
    [summary],
  );

  if (isLoading && dashboardLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-[32px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-on-surface">复盘总览</h2>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">查看近 7 天记录概况、计划执行趋势和盈亏变化，快速把握当前节奏。</p>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => exportRange('week')}
                  disabled={isExporting !== null}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-on-primary shadow-md transition-all hover:opacity-90 disabled:opacity-60"
              >
                {isExporting === 'week' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出本周复盘
                </button>

                <button
                  type="button"
                  onClick={() => exportRange('month')}
                  disabled={isExporting !== null}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-5 py-3 font-bold text-on-surface shadow-sm ring-1 ring-outline-variant/20 transition-all hover:bg-surface-container disabled:opacity-60"
                >
                  {isExporting === 'month' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  导出本月复盘
                </button>
              </div>

            <div className="rounded-3xl border border-outline-variant/15 bg-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <div className="text-lg font-bold text-on-surface">全局搜索</div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {[7, 30, 90].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSearchRange(range as 7 | 30 | 90)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-bold transition-all',
                      searchRange === range ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant',
                    )}
                  >
                    最近 {range} 天
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void runGlobalSearch();
                    }
                  }}
                  placeholder="搜索股票、策略、复盘内容或计划关键词"
                  className="h-12 flex-1 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => void runGlobalSearch()}
                  disabled={searching}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-on-surface px-5 py-3 font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  搜索最近 30 天
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  {searchResults.slice(0, 20).map((item, index) => (
                    <button
                      key={`${item.date}-${item.type}-${index}`}
                      type="button"
                      onClick={() => jumpToResult(item)}
                      className="block w-full rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-surface"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{item.type}</span>
                        <span className="text-on-surface-variant">{item.date}</span>
                        <span className="font-bold text-on-surface">{highlightKeyword(item.title, searchQuery)}</span>
                        <span className="ml-auto text-xs font-bold text-on-surface-variant">点击跳转</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-7 text-on-surface">{highlightKeyword(item.content, searchQuery)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboardStats.map((stat) => (
                <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} hint={stat.hint} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <ProfitBarChart days={dashboardDays} onSelectDay={(date) => jumpToDate(date, '/operation')} />
              <MiniBarChart
                title="操作频率"
                subtitle="近 7 天每日操作记录数量"
                days={dashboardDays}
                valueKey="operationCount"
                formatter={(value) => `${value}`}
                colorClass="bg-on-surface"
                onSelectDay={(date) => jumpToDate(date, '/operation')}
              />
              <MiniBarChart
                title="计划完成率趋势"
                subtitle="按每天对应计划的完成占比展示"
                days={dashboardDays}
                valueKey="planCompletionRate"
                formatter={(value) => `${value}%`}
                colorClass="bg-primary/70"
                onSelectDay={(date) => jumpToDate(date, '/plan')}
              />
            </div>
          </div>
        )}
      </section>

      <section className="border-l-4 border-primary py-1 pl-4">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">每日思考</h2>
        <span className="mt-1 block text-sm leading-6 text-on-surface-variant">记录当天对情绪、题材和节奏的判断，为后续复盘做准备。</span>
      </section>

      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.id} className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="pt-1 text-xl font-bold tabular-nums text-primary/50">{question.id}</div>
              <div className="flex-1">
                <label className="mb-4 block text-[15px] font-bold leading-relaxed text-on-surface">{question.title}</label>
                <textarea
                  className="min-h-[96px] w-full resize-none rounded-2xl bg-surface px-4 py-3 text-sm leading-7 text-on-surface outline-none ring-1 ring-transparent transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30"
                  placeholder={question.placeholder}
                  rows={4}
                  value={answers[question.id] || ''}
                  onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          {isSaving ? '正在保存每日思考...' : '保存每日思考'}
        </button>
      </div>
    </motion.div>
  );
}
