'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, Archive, RefreshCw, Eye, CheckSquare, Square,
  Shield, AlertTriangle, ChevronDown, Filter, Zap,
  RotateCcw, CheckCircle, XCircle, Clock, Info
} from 'lucide-react';
import { getCleanupCandidates, previewCleanup, executeCleanup, rollbackCleanup, getCleanupHistory } from '@/lib/api';
import { formatBytes, getImportanceColor, getImportanceLabel, getCategoryBadgeClass, getCategoryLabel, timeAgo, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const CATEGORIES = ['all', 'promotions', 'newsletter', 'social', 'updates', 'spam'];

export default function CleanupPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [tab, setTab] = useState<'candidates' | 'history'>('candidates');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [rollbackingId, setRollbackingId] = useState<string | null>(null);

  const fetchCandidates = useCallback(async (category?: string) => {
    setLoading(true);
    try {
      const cat = (category || categoryFilter) === 'all' ? undefined : (category || categoryFilter);
      const res = await getCleanupCandidates(1, cat);
      if (res.data.needsSync) {
        setCandidates([]);
        setTotal(0);
      } else {
        setCandidates(res.data.candidates || []);
        setTotal(res.data.total || 0);
      }
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getCleanupHistory();
      setHistory(res.data.sessions || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchCandidates(); }, []);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
    setPreview(null);
  };

  const toggleSelectAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map(c => c.messageId)));
    }
    setPreview(null);
  };

  const handlePreview = async () => {
    if (selected.size === 0) return toast.error('Select emails first');
    setPreviewLoading(true);
    try {
      const res = await previewCleanup(Array.from(selected));
      setPreview(res.data);
    } catch {
      toast.error('Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async (action: 'delete' | 'archive') => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setExecuting(true);
    const toastId = toast.loading(`${action === 'delete' ? 'Moving to trash' : 'Archiving'} ${ids.length} emails...`);
    try {
      const res = await executeCleanup(ids, action);
      toast.success(`Done! Recovered ${formatBytes(res.data.storageRecovered)}. Rollback available for 30 days.`, { id: toastId, duration: 5000 });
      setSelected(new Set());
      setPreview(null);
      await fetchCandidates();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Cleanup failed', { id: toastId });
    } finally {
      setExecuting(false);
    }
  };

  const handleRollback = async (sessionId: string) => {
    setRollbackingId(sessionId);
    const toastId = toast.loading('Restoring emails...');
    try {
      const res = await rollbackCleanup(sessionId);
      toast.success(`Restored ${res.data.emailsRestored} emails`, { id: toastId });
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Rollback failed', { id: toastId });
    } finally {
      setRollbackingId(null);
    }
  };

  const handleCategoryFilter = (cat: string) => {
    setCategoryFilter(cat);
    setSelected(new Set());
    setPreview(null);
    fetchCandidates(cat);
  };

  const totalSelectedSize = candidates
    .filter(c => selected.has(c.messageId))
    .reduce((sum, c) => sum + c.size, 0);

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">AI Cleanup Studio</h1>
          <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>
            {total} emails ready for cleanup · Protected emails excluded
          </p>
        </div>
        <button onClick={() => fetchCandidates()} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg mb-5 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {(['candidates', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize"
                  style={{
                    background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: tab === t ? 'white' : '#71717A',
                    border: tab === t ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                  }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'candidates' && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => handleCategoryFilter(cat)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all capitalize"
                      style={{
                        background: categoryFilter === cat ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                        color: categoryFilter === cat ? '#a5b4fc' : '#52525B',
                        border: categoryFilter === cat ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.06)',
                      }}>
                {cat === 'all' ? 'All categories' : cat}
              </button>
            ))}
          </div>

          {/* Action bar */}
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-3 mb-4 flex items-center gap-3 flex-wrap"
              style={{ borderColor: 'rgba(99,102,241,0.25)' }}
            >
              <span className="text-sm text-white font-medium">
                {selected.size} selected · {formatBytes(totalSelectedSize)}
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <button onClick={handlePreview} disabled={previewLoading}
                        className="btn-ghost text-xs gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  {previewLoading ? 'Loading...' : 'Preview Impact'}
                </button>
                <button onClick={() => handleExecute('archive')} disabled={executing}
                        className="btn-ghost text-xs gap-1.5">
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
                <button onClick={() => handleExecute('delete')} disabled={executing}
                        className="btn-danger text-xs gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  {executing ? 'Processing...' : 'Move to Trash'}
                </button>
              </div>
            </motion.div>
          )}

          {/* What-if preview panel */}
          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 rounded-xl overflow-hidden"
                style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4" style={{ color: '#6366f1' }} />
                    <p className="text-sm font-medium text-white">What-If Preview</p>
                    <span className={cn('badge ml-auto', preview.riskLevel === 'low' ? 'badge-safe' : 'badge-warning')}>
                      {preview.riskLevel === 'low' ? 'Low risk' : 'Medium risk'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: 'Emails to delete', value: preview.emailsToDelete, color: '#EF4444' },
                      { label: 'Protected (skipped)', value: preview.emailsProtected, color: '#8B5CF6' },
                      { label: 'Storage recovered', value: formatBytes(preview.storageRecovered), color: '#10B981' },
                      { label: 'Rollback window', value: '30 days', color: '#22d3ee' },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-sm font-semibold font-mono" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {preview.emailsProtected > 0 && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                         style={{ background: 'rgba(139,92,246,0.08)', color: '#c4b5fd' }}>
                      <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                      {preview.emailsProtected} emails were automatically excluded because they appear important.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email list */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}
            </div>
          ) : candidates.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#10B981' }} />
              <p className="text-sm font-medium text-white mb-1">Inbox looks clean!</p>
              <p className="text-xs" style={{ color: '#52525B' }}>No cleanup candidates found. Run analysis to refresh.</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2.5 text-xs uppercase tracking-wider"
                   style={{ color: '#52525B', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={toggleSelectAll} className="flex-shrink-0">
                  {selected.size === candidates.length && candidates.length > 0
                    ? <CheckSquare className="w-4 h-4" style={{ color: '#6366f1' }} />
                    : <Square className="w-4 h-4" style={{ color: '#52525B' }} />
                  }
                </button>
                <div className="flex-1">Subject / Sender</div>
                <div className="hidden md:block w-24 text-right">Size</div>
                <div className="hidden md:block w-24">Category</div>
                <div className="hidden lg:block w-20 text-right">Score</div>
              </div>

              {candidates.map((email, i) => {
                const isSelected = selected.has(email.messageId);
                return (
                  <motion.div
                    key={email.messageId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    onClick={() => toggleSelect(email.messageId)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      borderBottom: i < candidates.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {isSelected
                        ? <CheckSquare className="w-4 h-4" style={{ color: '#6366f1' }} />
                        : <Square className="w-4 h-4" style={{ color: '#3f3f46' }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{email.subject}</p>
                      <p className="text-xs truncate" style={{ color: '#52525B' }}>{email.sender}</p>
                    </div>
                    <div className="hidden md:block w-24 text-right">
                      <span className="text-xs font-mono" style={{ color: '#71717A' }}>{formatBytes(email.size)}</span>
                    </div>
                    <div className="hidden md:block w-24">
                      <span className={getCategoryBadgeClass(email.category)}>
                        {getCategoryLabel(email.category)}
                      </span>
                    </div>
                    <div className="hidden lg:block w-20 text-right">
                      <span className="text-xs font-mono" style={{ color: getImportanceColor(email.importanceScore) }}>
                        {email.importanceScore}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {historyLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)
          ) : history.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: '#52525B' }} />
              <p className="text-sm" style={{ color: '#52525B' }}>No cleanup sessions yet.</p>
            </div>
          ) : (
            history.map((session, i) => {
              const canRollback = session.status === 'completed' && new Date(session.rollbackExpiresAt) > new Date();
              return (
                <motion.div
                  key={session._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-4 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {session.status === 'completed' && <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />}
                    {session.status === 'rolled_back' && <RotateCcw className="w-5 h-5" style={{ color: '#6366f1' }} />}
                    {session.status === 'failed' && <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />}
                    {session.status === 'in_progress' && <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#F59E0B' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {session.summary?.emailsDeleted > 0 ? `${session.summary.emailsDeleted} emails trashed` : ''}
                      {session.summary?.emailsArchived > 0 ? `${session.summary.emailsArchived} emails archived` : ''}
                      {session.status === 'rolled_back' ? ' (Rolled back)' : ''}
                    </p>
                    <p className="text-xs" style={{ color: '#52525B' }}>
                      {formatBytes(session.summary?.storageRecovered || 0)} recovered · {timeAgo(session.startedAt)}
                    </p>
                  </div>
                  {canRollback && (
                    <button
                      onClick={() => handleRollback(session._id)}
                      disabled={rollbackingId === session._id}
                      className="btn-ghost text-xs flex-shrink-0"
                    >
                      <RotateCcw className={cn('w-3.5 h-3.5', rollbackingId === session._id && 'animate-spin')} />
                      {rollbackingId === session._id ? 'Restoring...' : 'Rollback'}
                    </button>
                  )}
                  <span className={cn(
                    'badge flex-shrink-0',
                    session.status === 'completed' && 'badge-safe',
                    session.status === 'rolled_back' && 'badge-newsletter',
                    session.status === 'failed' && 'badge-danger',
                  )}>
                    {session.status}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
