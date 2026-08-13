'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Plus, Trash2, RefreshCw, Lock, Eye, Database, Check } from 'lucide-react';
import { getSettings, addProtectedSender, removeProtectedSender, deleteAllData } from '@/lib/api';
import toast from 'react-hot-toast';

const BUILT_IN_PROTECTED = [
  { name: 'Banking & Finance', examples: 'chase.com, wellsfargo.com, paypal.com', color: '#10B981' },
  { name: 'Government Agencies', examples: 'irs.gov, ssa.gov, state.gov, .gov domains', color: '#3B82F6' },
  { name: 'Medical Providers', examples: 'mychart.com, athenahealth.com, epic.com', color: '#8B5CF6' },
  { name: 'Legal Documents', examples: 'docusign.com, hellosign.com, legalzoom.com', color: '#F59E0B' },
];

const PROTECTED_KEYWORDS = [
  'tax', 'invoice', 'receipt', 'payment', 'verification', 'security',
  'medical', 'prescription', 'legal', 'contract', 'offer letter', 'insurance',
];

export default function SecurityPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newSender, setNewSender] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSettings();
      setSettings(res.data);
    } catch {
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleAddSender = async () => {
    if (!newSender.trim() || !newSender.includes('@')) {
      return toast.error('Enter a valid email address');
    }
    setAdding(true);
    try {
      await addProtectedSender(newSender.trim().toLowerCase());
      toast.success(`${newSender} added to protected senders`);
      setNewSender('');
      fetchSettings();
    } catch {
      toast.error('Failed to add sender');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveSender = async (email: string) => {
    try {
      await removeProtectedSender(email);
      toast.success(`Removed ${email}`);
      fetchSettings();
    } catch {
      toast.error('Failed to remove sender');
    }
  };

  const handleDeleteData = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteAllData();
      toast.success('All analysis data deleted. Your Gmail is not affected.');
      setConfirmDelete(false);
    } catch {
      toast.error('Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-6 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-xl shimmer" />)}</div>;
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Security & Privacy</h1>
      </div>

      <div className="space-y-5">
        {/* How we protect your data */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4" style={{ color: '#10B981' }} />
            <p className="text-sm font-medium text-white">How We Protect Your Data</p>
          </div>
          <div className="space-y-3">
            {[
              { icon: Eye, label: 'Gmail tokens encrypted at rest', desc: 'Your OAuth tokens are AES-256 encrypted before storage. We never store email content.' },
              { icon: Shield, label: 'Analysis only, no data retention', desc: 'Email metadata is analyzed in-memory. Only storage stats and importance scores are cached for 24 hours.' },
              { icon: Lock, label: 'Revoke anytime', desc: 'Disconnect MailSweep AI from your Google Account at any time via Google account settings.' },
              { icon: Database, label: 'GDPR: Delete all data', desc: 'You can permanently delete all your MailSweep AI data below. Your Gmail is not affected.' },
            ].map((item) => (
              <div key={item.label} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <item.icon className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#71717A' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-protected sources */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4" style={{ color: '#8B5CF6' }} />
            <p className="text-sm font-medium text-white">Automatically Protected Sources</p>
          </div>
          <p className="text-xs mb-4" style={{ color: '#52525B' }}>These are permanently excluded from all deletion recommendations.</p>
          <div className="space-y-2 mb-5">
            {BUILT_IN_PROTECTED.map(cat => (
              <div key={cat.name} className="flex items-start gap-3 rounded-lg p-3"
                   style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: cat.color }} />
                <div>
                  <p className="text-sm font-medium text-white">{cat.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>{cat.examples}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs font-medium text-white mb-2">Protected Subject Keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {PROTECTED_KEYWORDS.map(kw => (
              <span key={kw} className="badge badge-protected">{kw}</span>
            ))}
          </div>
        </div>

        {/* Custom protected senders */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4" style={{ color: '#6366f1' }} />
            <p className="text-sm font-medium text-white">Custom Protected Senders</p>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              value={newSender}
              onChange={e => setNewSender(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSender()}
              placeholder="someone@example.com"
              className="input-dark text-sm flex-1"
            />
            <button onClick={handleAddSender} disabled={adding} className="btn-brand text-xs whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {settings?.protectedSenders?.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: '#3f3f46' }}>
              No custom protected senders yet.
            </p>
          ) : (
            <div className="space-y-2">
              {settings?.protectedSenders?.map((email: string) => (
                <div key={email} className="flex items-center justify-between px-3 py-2 rounded-lg"
                     style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                    <span className="text-sm text-white">{email}</span>
                  </div>
                  <button onClick={() => handleRemoveSender(email)} className="p-1 rounded-md transition-colors"
                          style={{ color: '#52525B' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#52525B'; }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="glass-card p-5" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: '#fca5a5' }}>Danger Zone</p>
          <p className="text-xs mb-4" style={{ color: '#52525B' }}>
            Delete all MailSweep AI analysis data. This does not affect your Gmail account.
          </p>
          <button
            onClick={handleDeleteData}
            disabled={deleting}
            className="btn-danger"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting...' : confirmDelete ? 'Are you sure? Click again to confirm' : 'Delete All Analysis Data'}
          </button>
          {confirmDelete && (
            <button onClick={() => setConfirmDelete(false)} className="ml-2 text-xs" style={{ color: '#52525B' }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
