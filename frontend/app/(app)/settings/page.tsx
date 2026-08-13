'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings, RefreshCw, Check, Trash2, Plus, Save, ChevronRight } from 'lucide-react';
import { getSettings, updateSettings, getRules, createRule, updateRule, deleteRule, runRule } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

const CATEGORIES = ['promotions', 'newsletter', 'social', 'spam', 'updates'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'rules'>('general');
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    conditions: { category: [] as string[], olderThanDays: 90, sizeGreaterThan: 0, senderPattern: '' },
    action: 'delete',
    isActive: true,
  });
  const [runningRule, setRunningRule] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, rulesRes] = await Promise.all([
        getSettings(),
        getRules(),
      ]);
      setSettings(settingsRes.data);
      setRules(rulesRes.data.rules || []);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategory = (cat: string) => {
    const current = settings?.protectedCategories || [];
    const updated = current.includes(cat)
      ? current.filter((c: string) => c !== cat)
      : [...current, cat];
    setSettings({ ...settings, protectedCategories: updated });
  };

  const handleCreateRule = async () => {
    if (!newRule.name.trim()) return toast.error('Rule name required');
    if (newRule.conditions.category.length === 0 && !newRule.conditions.senderPattern) {
      return toast.error('Add at least one condition');
    }
    try {
      const res = await createRule(newRule);
      setRules([...rules, res.data.rule]);
      setShowNewRule(false);
      setNewRule({ name: '', conditions: { category: [], olderThanDays: 90, sizeGreaterThan: 0, senderPattern: '' }, action: 'delete', isActive: true });
      toast.success('Rule created');
    } catch {
      toast.error('Failed to create rule');
    }
  };

  const handleToggleRule = async (rule: any) => {
    try {
      await updateRule(rule.id, { ...rule, isActive: !rule.isActive });
      setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
      toast.success(rule.isActive ? 'Rule disabled' : 'Rule enabled');
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id);
      setRules(rules.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleDryRun = async (id: string) => {
    setRunningRule(id);
    try {
      const res = await runRule(id, true);
      setDryRunResult({ id, ...res.data });
    } catch {
      toast.error('Dry run failed');
    } finally {
      setRunningRule(null);
    }
  };

  const handleRunRule = async (id: string) => {
    setRunningRule(id);
    const toastId = toast.loading('Running rule...');
    try {
      const res = await runRule(id, false);
      toast.success(`Processed ${res.data.emailsProcessed} emails`, { id: toastId });
      setDryRunResult(null);
    } catch {
      toast.error('Rule execution failed', { id: toastId });
    } finally {
      setRunningRule(null);
    }
  };

  if (loading) {
    return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl shimmer" />)}</div>;
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg mb-5 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {(['general', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
                  className="px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all"
                  style={{
                    background: activeTab === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: activeTab === t ? 'white' : '#71717A',
                    border: activeTab === t ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                  }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-5">
          {/* Protected categories */}
          <div className="glass-card p-5">
            <p className="text-sm font-medium text-white mb-1">Protected Email Categories</p>
            <p className="text-xs mb-4" style={{ color: '#52525B' }}>Emails in these categories are never suggested for deletion.</p>
            <div className="space-y-2">
              {['banking', 'legal', 'medical', 'government', 'academic', 'personal'].map(cat => (
                <label key={cat} className="flex items-center justify-between cursor-pointer p-2 rounded-lg transition-colors"
                       style={{ background: 'rgba(255,255,255,0.02)' }}
                       onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                  <span className="text-sm text-white capitalize">{cat}</span>
                  <div
                    className="w-9 h-5 rounded-full relative transition-colors cursor-pointer"
                    style={{ background: settings?.protectedCategories?.includes(cat) ? '#6366f1' : 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleToggleCategory(cat)}
                  >
                    <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                         style={{ left: settings?.protectedCategories?.includes(cat) ? '20px' : '2px' }} />
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notification frequency */}
          <div className="glass-card p-5">
            <p className="text-sm font-medium text-white mb-4">Report Frequency</p>
            <div className="space-y-2">
              {[
                { value: 'daily', label: 'Daily', desc: 'Get daily storage snapshots' },
                { value: 'weekly', label: 'Weekly', desc: 'Get weekly AI intelligence reports' },
                { value: 'never', label: 'Never', desc: 'Disable automated reports' },
              ].map(opt => (
                <label key={opt.value} onClick={() => setSettings({ ...settings, notificationFrequency: opt.value })}
                       className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                       style={{
                         background: settings?.notificationFrequency === opt.value ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                         border: settings?.notificationFrequency === opt.value ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(255,255,255,0.05)',
                       }}>
                  <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    settings?.notificationFrequency === opt.value ? 'border-brand-500' : 'border-zinc-600')}
                       style={{ borderColor: settings?.notificationFrequency === opt.value ? '#6366f1' : '#52525B' }}>
                    {settings?.notificationFrequency === opt.value && (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#6366f1' }} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-xs" style={{ color: '#52525B' }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={saving} className="btn-brand">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: '#A1A1AA' }}>Automated cleanup rules that run on schedule</p>
            <button onClick={() => setShowNewRule(!showNewRule)} className="btn-brand text-xs">
              <Plus className="w-3.5 h-3.5" />
              New Rule
            </button>
          </div>

          {/* New rule form */}
          {showNewRule && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card p-4 space-y-4"
              style={{ borderColor: 'rgba(99,102,241,0.2)' }}
            >
              <p className="text-sm font-medium text-white">New Cleanup Rule</p>
              <div>
                <label className="text-xs font-medium text-white mb-1 block">Rule Name</label>
                <input
                  value={newRule.name}
                  onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Clear old newsletters"
                  className="input-dark text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white mb-2 block">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => {
                      const current = newRule.conditions.category;
                      setNewRule({
                        ...newRule,
                        conditions: {
                          ...newRule.conditions,
                          category: current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat],
                        },
                      });
                    }}
                    className="px-3 py-1 rounded-full text-xs capitalize transition-all"
                    style={{
                      background: newRule.conditions.category.includes(cat) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      color: newRule.conditions.category.includes(cat) ? '#a5b4fc' : '#71717A',
                      border: newRule.conditions.category.includes(cat) ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white mb-1 block">Older than (days)</label>
                  <input type="number" value={newRule.conditions.olderThanDays}
                    onChange={e => setNewRule({ ...newRule, conditions: { ...newRule.conditions, olderThanDays: parseInt(e.target.value) || 0 } })}
                    className="input-dark text-sm" min={0} />
                </div>
                <div>
                  <label className="text-xs font-medium text-white mb-1 block">Action</label>
                  <select value={newRule.action}
                    onChange={e => setNewRule({ ...newRule, action: e.target.value })}
                    className="input-dark text-sm">
                    <option value="delete">Move to Trash</option>
                    <option value="archive">Archive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateRule} className="btn-brand text-xs">Create Rule</button>
                <button onClick={() => setShowNewRule(false)} className="btn-ghost text-xs">Cancel</button>
              </div>
            </motion.div>
          )}

          {/* Rules list */}
          {rules.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Settings className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: '#52525B' }} />
              <p className="text-sm" style={{ color: '#52525B' }}>No rules created yet. Create a rule to automate cleanups.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule: any) => (
                <motion.div key={rule.id} layout className="glass-card p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{rule.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>
                        {rule.conditions.category?.join(', ') || 'All'} · {rule.conditions.olderThanDays || 0}d old · {rule.action}
                        {rule.emailsProcessed > 0 && ` · ${rule.emailsProcessed} processed`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-9 h-5 rounded-full relative transition-colors cursor-pointer"
                        style={{ background: rule.isActive ? '#6366f1' : 'rgba(255,255,255,0.1)' }}
                        onClick={() => handleToggleRule(rule)}
                      >
                        <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                             style={{ left: rule.isActive ? '20px' : '2px' }} />
                      </div>
                      <button onClick={() => handleDryRun(rule.id)} disabled={runningRule === rule.id}
                              className="btn-ghost text-xs">
                        {runningRule === rule.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Test'}
                      </button>
                      <button onClick={() => handleRunRule(rule.id)} disabled={runningRule === rule.id}
                              className="btn-brand text-xs">Run</button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-1 rounded transition-colors"
                              style={{ color: '#52525B' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#52525B'; }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {dryRunResult?.id === rule.id && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="mt-2 p-3 rounded-lg text-xs"
                                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p className="text-white font-medium mb-1">Dry Run Result</p>
                      <p style={{ color: '#A1A1AA' }}>
                        Would affect {dryRunResult.emailsAffected} emails and recover storage.
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
