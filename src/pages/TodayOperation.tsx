import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Edit3, ImagePlus, Loader2, Plus, RefreshCw, Save, Trash2, TrendingUp, X } from 'lucide-react';
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

export default function TodayOperation() {
  const { selectedDate } = useDate();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    stockName: '',
    profitLoss: '',
    logic: '',
    screenshotUrl: '',
  });

  useEffect(() => {
    void fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/today-operation?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setOperations(result.data || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('获取数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const response = await apiFetch('/api/upload?folder=operations', {
        method: 'POST',
        body: uploadData,
      });
      const result = await response.json();
      if (result.success) {
        setFormData((prev) => ({ ...prev, screenshotUrl: result.url }));
        toast.success('截图上传成功');
      } else {
        toast.error(result.error || '上传失败');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('上传失败，请检查网络或配置');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({ stockName: '', profitLoss: '', logic: '', screenshotUrl: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.stockName) {
      toast.error('请输入股票名称');
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch('/api/today-operation', {
        method: 'POST',
        body: JSON.stringify({
          id: editingId,
          date: selectedDate,
          stockName: formData.stockName,
          profitLoss: parseFloat(formData.profitLoss) || 0,
          logic: formData.logic,
          screenshotUrl: formData.screenshotUrl,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(editingId ? '记录已更新' : '记录已新增');
        resetForm();
        await fetchData();
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('连接服务器失败');
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
      if (result.success) {
        toast.success('记录已删除');
        await fetchData();
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-20">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold tracking-tight">交易记录</h2>
          <p className="text-sm font-medium uppercase tracking-wider text-on-surface-variant">
            {selectedDate} · {operations.length} 条记录
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="rounded-full p-2 transition-colors hover:bg-surface-container" title="刷新">
            <RefreshCw className={cn('h-5 w-5 text-on-surface-variant', isLoading && 'animate-spin')} />
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary shadow-md transition-all hover:opacity-90"
            >
              <Plus className="h-5 w-5" />
              <span>新增记录</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-12 overflow-hidden rounded-2xl border border-primary/10 bg-surface-container-lowest p-6 shadow-xl md:p-8"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1.5 rounded-full bg-primary" />
                <h3 className="text-xl font-bold">{editingId ? '编辑交易记录' : '新增交易记录'}</h3>
              </div>
              <button onClick={resetForm} className="rounded-full p-2 transition-colors hover:bg-surface-container">
                <X className="h-5 w-5 text-on-surface-variant" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <label className="block h-full cursor-pointer">
                    <input className="hidden" type="file" onChange={handleFileUpload} disabled={isUploading} />
                    <div
                      className={cn(
                        'relative flex min-h-[200px] h-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all',
                        formData.screenshotUrl
                          ? 'border-primary/30 bg-surface'
                          : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high',
                      )}
                    >
                      {formData.screenshotUrl ? (
                        <>
                          <img src={formData.screenshotUrl} alt="Preview" referrerPolicy="no-referrer" className="h-full w-full object-contain p-2" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                            <span className="text-sm font-bold text-white">点击更换截图</span>
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            {isUploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            ) : (
                              <ImagePlus className="h-6 w-6 text-primary" />
                            )}
                          </div>
                          <p className="text-sm font-bold text-primary">上传交易截图</p>
                          <p className="mt-1 text-[10px] text-on-surface-variant">支持常见图片格式</p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                <div className="space-y-6 lg:col-span-2">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">股票名称</label>
                      <input
                        className="w-full rounded-xl bg-surface-container-low px-4 py-3 font-medium text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20"
                        placeholder="例如：贵州茅台"
                        type="text"
                        value={formData.stockName}
                        onChange={(e) => setFormData({ ...formData, stockName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">盈亏百分比</label>
                      <div className="relative">
                        <input
                          className="w-full rounded-xl bg-surface-container-low px-4 py-3 pr-12 font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20"
                          placeholder="+0.00"
                          type="text"
                          value={formData.profitLoss}
                          onChange={(e) => setFormData({ ...formData, profitLoss: e.target.value.replace('%', '') })}
                        />
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 font-bold text-primary/60">%</div>
                        <TrendingUp className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary/30" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">交易逻辑 / 总结</label>
                    <textarea
                      className="w-full resize-none rounded-xl bg-surface-container-low px-4 py-3 leading-relaxed outline-none transition-all focus:ring-2 focus:ring-primary/20"
                      placeholder="记录买入逻辑、卖出逻辑、执行细节和改进点..."
                      rows={5}
                      value={formData.logic}
                      onChange={(e) => setFormData({ ...formData, logic: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={resetForm} className="rounded-xl px-6 py-3 font-bold text-on-surface-variant transition-all hover:bg-surface-container">
                  取消
                </button>
                <button
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-on-primary shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
                  type="submit"
                >
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  <span>{editingId ? '更新记录' : '保存记录'}</span>
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="animate-pulse text-on-surface-variant">正在加载交易数据...</p>
        </div>
      ) : operations.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {operations.map((operation, index) => (
            <motion.div
              key={operation.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm"
            >
              {operation.screenshot_url && (
                <div className="relative aspect-video w-full overflow-hidden bg-surface-container-low">
                  <img
                    src={operation.screenshot_url}
                    alt={operation.stock_name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button
                      onClick={() => handleEdit(operation)}
                      className="rounded-full bg-white/90 p-2 text-on-surface-variant shadow-md backdrop-blur transition-colors hover:text-primary"
                      title="编辑"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(operation.id)}
                      className="rounded-full bg-white/90 p-2 text-on-surface-variant shadow-md backdrop-blur transition-colors hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h4 className="text-xl font-bold tracking-tight">{operation.stock_name}</h4>
                    <p className="mt-0.5 text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {new Date(operation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'rounded-full px-3 py-1 text-sm font-bold',
                      operation.profit_loss >= 0 ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600',
                    )}
                  >
                    {operation.profit_loss >= 0 ? '+' : ''}
                    {operation.profit_loss}%
                  </div>
                </div>

                <div className="flex-1">
                  <p className="line-clamp-3 text-sm leading-relaxed text-on-surface-variant">
                    {operation.logic || '暂无交易逻辑记录'}
                  </p>
                </div>

                {!operation.screenshot_url && (
                  <div className="mt-4 flex justify-end gap-2 border-t border-outline-variant/10 pt-4">
                    <button onClick={() => handleEdit(operation)} className="text-xs font-bold text-primary hover:underline">
                      编辑
                    </button>
                    <button onClick={() => handleDelete(operation.id)} className="text-xs font-bold text-red-600 hover:underline">
                      删除
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 bg-surface-container-lowest py-24 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container">
            <TrendingUp className="h-10 w-10 text-on-surface-variant/20" />
          </div>
          <h3 className="mb-2 text-xl font-bold">暂无交易记录</h3>
          <p className="mx-auto mb-8 max-w-xs text-on-surface-variant">今天还没有记录任何交易，点击右上角“新增记录”开始复盘。</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-on-primary shadow-lg transition-all hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            <span>立即添加</span>
          </button>
        </div>
      )}
    </div>
  );
}
