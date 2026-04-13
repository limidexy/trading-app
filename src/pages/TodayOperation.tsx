import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, Edit3, ImagePlus, Loader2, Plus, RefreshCw, Save, Search, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDate } from '@/contexts/DateContext';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Operation {
  id: number;
  stock_name: string;
  profit_loss: number;
  logic: string;
  screenshot_url: string;
  created_at: string;
}

type DraftState = 'idle' | 'saving' | 'saved' | 'error';
type ProfitFilter = 'all' | 'profit' | 'loss';
type SortMode = 'latest' | 'profit-desc' | 'profit-asc' | 'name';

function getDraftKey(date: string) {
  return `today-operation-draft:${date}`;
}

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function getResponseErrorMessage(status: number, payload: any) {
  if (status === 401) return payload?.error || '登录已失效，请重新登录';
  if (status >= 500) return payload?.error || '服务器异常，请稍后再试';
  return payload?.error || '操作失败，请稍后重试';
}

export default function TodayOperation() {
  const { selectedDate } = useDate();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pnlInput, setPnlInput] = useState('');
  const [isPnlSaving, setIsPnlSaving] = useState(false);
  const [isPnlLoading, setIsPnlLoading] = useState(false);
  const [pnlDirty, setPnlDirty] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftState, setDraftState] = useState<DraftState>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    stockName: '',
    profitLoss: '',
    logic: '',
    screenshotUrl: '',
  });
  const logicRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void fetchData();
    void fetchDailyPnl(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (logicRef.current) autoResize(logicRef.current);
  }, [formData.logic]);

  useEffect(() => {
    const draft = localStorage.getItem(getDraftKey(selectedDate));
    if (draft && !showForm && !editingId) {
      setFormData(JSON.parse(draft));
      setShowForm(true);
      setDraftState('saved');
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!showForm) return;
    localStorage.setItem(getDraftKey(selectedDate), JSON.stringify(formData));
    setDraftState('saved');
    const timer = window.setTimeout(() => {
      setDraftState((current) => (current === 'saved' ? 'idle' : current));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [formData, selectedDate, showForm]);

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
    try {
      const response = await apiFetch(`/api/today-operation?date=${selectedDate}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }
      setOperations(result.data || []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('获取今日操作失败，请检查网络后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDailyPnl = async (date: string) => {
    setIsPnlLoading(true);
    try {
      const response = await apiFetch(`/api/daily-pnl?date=${date}`);
      const result = await response.json();
      if (!pnlDirty) {
        const value = result?.data?.pnl;
        setPnlInput(value === null || value === undefined ? '' : String(value));
      }
    } catch (error) {
      console.error('Daily pnl fetch error:', error);
    } finally {
      setIsPnlLoading(false);
    }
  };

  const handleSavePnl = async () => {
    setIsPnlSaving(true);
    try {
      const payload = {
        date: selectedDate,
        pnl: pnlInput.trim() === '' ? null : Number(pnlInput),
      };
      const response = await apiFetch('/api/daily-pnl', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result?.error || '保存每日盈亏失败');
        return;
      }
      setPnlDirty(false);
      toast.success('每日盈亏已保存');
    } catch (error) {
      console.error('Daily pnl save error:', error);
      toast.error('保存每日盈亏失败');
    } finally {
      setIsPnlSaving(false);
    }
  };

  const filteredOperations = useMemo(() => {
    const result = operations.filter((item) => {
      const matchQuery = !query.trim()
        || item.stock_name?.toLowerCase().includes(query.toLowerCase())
        || item.logic?.toLowerCase().includes(query.toLowerCase());
      const matchProfit =
        profitFilter === 'all'
          || (profitFilter === 'profit' && Number(item.profit_loss) >= 0)
          || (profitFilter === 'loss' && Number(item.profit_loss) < 0);
      return matchQuery && matchProfit;
    });

    switch (sortMode) {
      case 'profit-desc':
        return [...result].sort((a, b) => Number(b.profit_loss) - Number(a.profit_loss));
      case 'profit-asc':
        return [...result].sort((a, b) => Number(a.profit_loss) - Number(b.profit_loss));
      case 'name':
        return [...result].sort((a, b) => (a.stock_name || '').localeCompare(b.stock_name || '', 'zh-CN'));
      case 'latest':
      default:
        return [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [operations, profitFilter, query, sortMode]);

  const updateForm = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
  };

  const resetForm = () => {
    setFormData({ stockName: '', profitLoss: '', logic: '', screenshotUrl: '' });
    setEditingId(null);
    setShowForm(false);
    setIsDirty(false);
    localStorage.removeItem(getDraftKey(selectedDate));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const response = await apiFetch('/api/upload?folder=operations', {
        method: 'POST',
        body: uploadData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }
      updateForm('screenshotUrl', result.url);
      toast.success('截图上传成功');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('截图上传失败，请检查网络后重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.stockName.trim()) {
      toast.error('请填写股票名称');
      return;
    }
    if (!formData.logic.trim()) {
      toast.error('请填写交易逻辑');
      return;
    }

    setIsSaving(true);
    setDraftState('saving');

    try {
      const response = await apiFetch('/api/today-operation', {
        method: 'POST',
        body: JSON.stringify({
          id: editingId,
          date: selectedDate,
          stockName: formData.stockName.trim(),
          profitLoss: parseFloat(formData.profitLoss) || 0,
          logic: formData.logic.trim(),
          screenshotUrl: formData.screenshotUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        setDraftState('error');
        return;
      }

      toast.success(editingId ? '操作记录已更新' : '操作记录已新增');
      setDraftState('saved');
      resetForm();
      await fetchData();
    } catch (error) {
      console.error('Save error:', error);
      setDraftState('error');
      toast.error('网络连接失败，草稿已保存在本地');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await apiFetch(`/api/today-operation/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(getResponseErrorMessage(response.status, result));
        return;
      }
      toast.success('操作记录已删除');
      await fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败，请检查网络后重试');
    }
  };

  const handleEdit = (operation: Operation) => {
    setEditingId(operation.id);
    setFormData({
      stockName: operation.stock_name || '',
      profitLoss: operation.profit_loss?.toString() || '',
      logic: operation.logic || '',
      screenshotUrl: operation.screenshot_url || '',
    });
    setShowForm(true);
    setIsDirty(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const getDraftHint = () => {
    if (isSaving || draftState === 'saving') return '正在保存操作记录...';
    if (draftState === 'saved' && isDirty) return '草稿已自动保存';
    if (draftState === 'saved' && !isDirty) return editingId ? '正在编辑已有记录' : '可以继续填写新的操作记录';
    if (draftState === 'error') return '自动保存失败，草稿仍保留在本地';
    if (isDirty) return '正在记录修改';
    return '表单内容会自动保存草稿';
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-20">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold tracking-tight">今日操作</h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">记录今天的买卖动作、盈亏结果和交易逻辑，便于后续复盘。</p>
          <div className="mt-2 text-xs text-on-surface-variant">当前日期：{selectedDate.replace(/-/g, '/')}</div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[360px]">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
            <div className="mb-2 text-xs font-bold text-on-surface-variant">每日盈亏（手动输入）</div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={pnlInput}
                onChange={(event) => {
                  setPnlInput(event.target.value);
                  setPnlDirty(true);
                }}
                onBlur={() => setPnlDirty(true)}
                placeholder="例如 1.25 或 -0.80"
                className="h-10 w-full flex-1 rounded-2xl border border-outline-variant/15 bg-surface px-3 text-sm outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={handleSavePnl}
                disabled={isPnlSaving || isPnlLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-on-surface px-4 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
              >
                {isPnlSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPnlSaving ? '保存中...' : '保存盈亏'}
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索股票名称或交易逻辑"
              className="h-12 w-full rounded-2xl border border-outline-variant/15 bg-surface-container-lowest pl-10 pr-4 text-sm outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: '全部盈亏' },
              { value: 'profit', label: '仅看盈利' },
              { value: 'loss', label: '仅看亏损' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setProfitFilter(item.value as ProfitFilter)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-bold transition-all',
                  profitFilter === item.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: 'latest', label: '按时间' },
              { value: 'profit-desc', label: '盈亏从高到低' },
              { value: 'profit-asc', label: '盈亏从低到高' },
              { value: 'name', label: '按股票名称' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSortMode(item.value as SortMode)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-bold transition-all',
                  sortMode === item.value ? 'bg-on-surface text-white' : 'bg-surface-container text-on-surface-variant',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
        {getDraftHint()}
      </div>

      <div className="mb-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
        已筛选出 {filteredOperations.length} 条记录。可以按股票名称、策略关键词、盈亏情况和排序方式快速查找。
      </div>

      <div className="mb-6 flex items-center justify-between">
        <button onClick={fetchData} className="flex h-12 items-center gap-2 rounded-2xl bg-surface-container-lowest px-4 font-bold text-on-surface transition-all hover:bg-surface-container">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          刷新记录
        </button>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-on-primary shadow-md transition-all hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            新增操作
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-10 overflow-hidden rounded-3xl border border-primary/10 bg-surface-container-lowest p-6 shadow-xl md:p-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{editingId ? '编辑操作记录' : '新增操作记录'}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">把关键截图、盈亏比例和交易逻辑一次记录完整。</p>
              </div>
              <button onClick={resetForm} className="flex h-11 w-11 items-center justify-center rounded-2xl text-on-surface-variant transition-colors hover:bg-surface-container">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <label className="block h-full cursor-pointer">
                  <input className="hidden" type="file" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                  <div className={cn('relative flex min-h-[220px] h-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all', formData.screenshotUrl ? 'border-primary/25 bg-surface' : 'border-outline-variant/20 bg-surface-container')}>
                    {formData.screenshotUrl ? (
                      <img src={formData.screenshotUrl} alt="操作截图预览" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-6 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <ImagePlus className="h-6 w-6 text-primary" />}
                        </div>
                        <div className="text-sm font-bold text-on-surface">上传操作截图</div>
                        <div className="mt-1 text-xs text-on-surface-variant">支持 png、jpg、webp，大小不超过 10MB</div>
                      </div>
                    )}
                  </div>
                </label>

                <div className="space-y-6 lg:col-span-2">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-on-surface-variant">股票名称</label>
                      <input
                        value={formData.stockName}
                        onChange={(event) => updateForm('stockName', event.target.value)}
                        className="h-12 w-full rounded-2xl bg-surface px-4 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
                        placeholder="例如：中天科技"
                        onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-on-surface-variant">盈亏比例</label>
                      <div className="relative">
                        <input
                          value={formData.profitLoss}
                          onChange={(event) => updateForm('profitLoss', event.target.value.replace('%', ''))}
                          className="h-12 w-full rounded-2xl bg-surface px-4 pr-12 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
                          placeholder="例如：6.5"
                          onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface-variant">交易逻辑</label>
                    <textarea
                      ref={logicRef}
                      rows={4}
                      value={formData.logic}
                      onChange={(event) => updateForm('logic', event.target.value)}
                      onInput={(event) => autoResize(event.currentTarget)}
                      onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                      className="min-h-[140px] w-full resize-none overflow-hidden rounded-2xl bg-surface px-4 py-3 leading-7 text-on-surface outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-primary/30"
                      placeholder="记录买入依据、卖出条件、盘中应对和复盘总结。"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={resetForm} className="flex min-h-12 items-center rounded-2xl px-5 font-bold text-on-surface-variant transition-all hover:bg-surface-container">
                  取消
                </button>
                <button type="submit" disabled={isSaving} className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:opacity-60">
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {isSaving ? '正在保存操作记录...' : '保存操作记录'}
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-on-surface-variant">正在加载今日操作...</p>
        </div>
      ) : filteredOperations.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredOperations.map((operation) => {
            const expanded = expandedIds.includes(operation.id);
            const preview = expanded ? operation.logic : operation.logic?.slice(0, 120);

            return (
              <div key={operation.id} className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
                {operation.screenshot_url && (
                  <div className="relative aspect-video overflow-hidden bg-surface">
                    <img src={operation.screenshot_url} alt={operation.stock_name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    <div className="absolute right-3 top-3 flex gap-2">
                      <button onClick={() => handleEdit(operation)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-on-surface shadow-md">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(operation.id)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-on-surface shadow-md">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{operation.stock_name}</h3>
                      <div className="mt-1 text-xs tracking-[0.2em] text-on-surface-variant/70">{new Date(operation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold', Number(operation.profit_loss) >= 0 ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600')}>
                      {Number(operation.profit_loss) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {Number(operation.profit_loss) >= 0 ? '+' : ''}
                      {operation.profit_loss}%
                    </div>
                  </div>

                  <div className="rounded-2xl bg-surface px-4 py-4">
                    <div className="mb-2 text-sm font-bold text-on-surface-variant">交易逻辑</div>
                    <p className="whitespace-pre-wrap break-words leading-7 text-on-surface">
                      {preview}
                      {!expanded && operation.logic?.length > 120 ? '...' : ''}
                    </p>
                    {operation.logic?.length > 120 && (
                      <button type="button" onClick={() => toggleExpanded(operation.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
                        {expanded ? '收起' : '展开全部'}
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  {!operation.screenshot_url && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(operation)} className="rounded-xl px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-container">
                        编辑
                      </button>
                      <button onClick={() => handleDelete(operation.id)} className="rounded-xl px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-container">
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 bg-surface-container-lowest py-24 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container">
            <TrendingUp className="h-10 w-10 text-on-surface-variant/20" />
          </div>
          <h3 className="mb-2 text-xl font-bold">今天还没有操作记录</h3>
          <p className="mx-auto mb-8 max-w-sm text-on-surface-variant">你可以先新增一条操作记录，记录股票、盈亏和交易逻辑。也可以使用上方搜索和盈亏筛选快速定位历史内容。</p>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 font-bold text-on-primary shadow-lg transition-all hover:opacity-90">
            <Plus className="h-5 w-5" />
            新增操作
          </button>
        </div>
      )}
    </div>
  );
}
