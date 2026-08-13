'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mail, RefreshCw, Unlink, CheckSquare, Search, Filter, ExternalLink } from 'lucide-react';
import { getInboxData, getSubscriptions, unsubscribe, bulkUnsubscribe, getSenders } from '@/lib/api';
import { formatBytes, getCategoryBadgeClass, getCategoryLabel, timeAgo, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const TABS = ['Senders', 'Subscriptions'] as const;
type Tab = typeof TABS[number];

export default function InboxPage() {
  const [tab, setTab] = useState<Tab>('Senders');
  const [senders, setSenders] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unsubbing, setUnsubbing] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sendersRes, subsRes] = await Promise.all([
        getSenders(),
        getSubscriptions(),
      ]);
      setSenders(sendersRes.data.senders || []);
      setSubscriptions(subsRes.data.subscriptions || []);
    } catch {
      toast.error('Failed to load inbox data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUnsubscribe = async (email: string) => {
    setUnsubbing(prev => new Set(prev).add(email));
    try {
      const res = await unsubscribe(email);
      if (res.data.success) {
        toast.success(`Unsubscribed from ${email}`);
      } else {
        toast.error('Could not auto-unsubscribe. Please do it manually.');
      }
    } catch {
      toast.error('Unsubscribe failed');
    } finally {
      setUnsubbing(prev => { const s = new Set(prev); s.delete(email); return s; });
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (selected.size === 0) return;
    const toastId = toast.loading(`Unsubscribing from ${selected.size} senders...`);
    try {
      const res = await bulkUnsubscribe(Array.from(selected));
      toast.success(`Succeeded: ${res.data.succeeded}, Failed: ${res.data.failed}`, { id: toastId });
      setSelected(new Set());
    } catch {
      toast.error('Bulk unsubscribe failed', { id: toastId });
    }
  };

  const toggleSelect = (email: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(email)) s.delete(email);
      else s.add(email);
      return s;
    });
  };

  const filteredSenders = senders.filter(s =>
    !search || s.email.includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSubs = subscriptions.filter(s =>
    !search || s.email.includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
      </div>
    );
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Inbox Intelligence</h1>
        <button onClick={fetchData} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg mb-5 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150"
                  style={{
                    background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: tab === t ? 'white' : '#71717A',
                    border: tab === t ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                  }}>
            {t}
            <span className="ml-1.5 text-xs font-mono" style={{ color: '#52525B' }}>
              {t === 'Senders' ? senders.length : subscriptions.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search + bulk actions */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#52525B' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="input-dark pl-9 text-sm"
          />
        </div>
        {tab === 'Subscriptions' && selected.size > 0 && (
          <button onClick={handleBulkUnsubscribe} className="btn-danger text-xs whitespace-nowrap">
            <Unlink className="w-3.5 h-3.5" />
            Unsubscribe from {selected.size}
          </button>
        )}
      </div>

      {/* Senders tab */}
      {tab === 'Senders' && (
        <div className="glass-card overflow-hidden">
          <div className="grid px-4 py-2 text-xs uppercase tracking-wider"
               style={{ gridTemplateColumns: '1fr auto auto auto', color: '#52525B', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>Sender</div>
            <div className="text-right pr-8">Emails</div>
            <div className="text-right pr-8">Size</div>
            <div>Category</div>
          </div>
          {filteredSenders.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#52525B' }}>
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No senders found. Run analysis first.</p>
            </div>
          ) : (
            filteredSenders.slice(0, 50).map((sender: any, i) => (
              <motion.div
                key={sender.email}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="grid px-4 py-3 text-sm transition-colors"
                style={{
                  gridTemplateColumns: '1fr auto auto auto',
                  borderBottom: i < filteredSenders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  alignItems: 'center',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                       style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                    {(sender.name || sender.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{sender.name}</p>
                    <p className="text-xs truncate" style={{ color: '#52525B' }}>{sender.email}</p>
                  </div>
                </div>
                <div className="text-right pr-8">
                  <span className="text-xs font-mono" style={{ color: '#A1A1AA' }}>{sender.count}</span>
                </div>
                <div className="text-right pr-8">
                  <span className="text-xs font-mono" style={{ color: '#A1A1AA' }}>{formatBytes(sender.totalSize)}</span>
                </div>
                <div>
                  <span className={getCategoryBadgeClass(sender.category)}>
                    {getCategoryLabel(sender.category)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Subscriptions tab */}
      {tab === 'Subscriptions' && (
        <div className="space-y-2">
          {filteredSubs.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: '#52525B' }} />
              <p className="text-sm" style={{ color: '#52525B' }}>No subscriptions detected.</p>
            </div>
          ) : (
            filteredSubs.map((sub: any, i) => (
              <motion.div
                key={sub.email}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-4 flex items-center gap-4"
              >
                <input
                  type="checkbox"
                  checked={selected.has(sub.email)}
                  onChange={() => toggleSelect(sub.email)}
                  className="rounded"
                  style={{ accentColor: '#6366f1' }}
                />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0"
                     style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                  {sub.name[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{sub.name}</p>
                  <p className="text-xs" style={{ color: '#52525B' }}>{sub.email}</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs font-mono text-white">{formatBytes(sub.totalSize)}</p>
                  <p className="text-xs" style={{ color: '#52525B' }}>{sub.count} emails</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs" style={{ color: '#52525B' }}>~{sub.estimatedMonthlyEmails}/mo</p>
                </div>
                <button
                  onClick={() => handleUnsubscribe(sub.email)}
                  disabled={unsubbing.has(sub.email)}
                  className="btn-danger text-xs flex-shrink-0"
                >
                  {unsubbing.has(sub.email) ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Unlink className="w-3 h-3" />
                  )}
                  {unsubbing.has(sub.email) ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
