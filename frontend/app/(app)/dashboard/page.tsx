'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  HardDrive, Mail, Trash2, TrendingDown, Shield, Zap, 
  RefreshCw, ArrowRight, AlertTriangle, CheckCircle, Clock,
  Brain, BarChart3, Bell
} from 'lucide-react';
import Link from 'next/link';
import { getInboxData, syncAnalysis, getWeeklyReport, generateWeeklyReport } from '@/lib/api';
import { formatBytes, getHealthColor, getHealthLabel, getStorageColor, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HealthScoreGauge } from '@/components/dashboard/HealthScoreGauge';
import { StorageDonut } from '@/components/charts/StorageDonut';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { WeeklyReportCard } from '@/components/dashboard/WeeklyReportCard';

const stagger = {
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [inboxRes, reportRes] = await Promise.all([
        getInboxData(),
        getWeeklyReport().catch(() => ({ data: { report: null } })),
      ]);
      setData(inboxRes.data);
      setWeeklyReport(reportRes.data.report);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    const toastId = toast.loading('Analyzing your inbox...');
    try {
      await syncAnalysis();
      await fetchData();
      toast.success('Analysis complete!', { id: toastId });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Analysis failed', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateReport = async () => {
    const toastId = toast.loading('Generating AI report...');
    try {
      const res = await generateWeeklyReport();
      setWeeklyReport(res.data.report);
      toast.success('Report generated!', { id: toastId });
    } catch {
      toast.error('Report generation failed', { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  const needsSync = !data || data.needsSync;
  const storage = data?.storageStats;
  const healthScore = data?.inboxHealthScore || 0;
  const emailCount = data?.emailCount || {};

  return (
    <div className="p-5 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          {data?.analyzedAt && (
            <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>
              Last analyzed {new Date(data.analyzedAt).toLocaleString()}
            </p>
          )}
        </div>

        <button onClick={handleSync} disabled={syncing}
                className={cn('btn-brand text-xs gap-2', syncing && 'opacity-70 cursor-wait')}>
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
          {needsSync ? 'Run Analysis' : 'Re-analyze'}
        </button>
      </motion.div>

      {/* First-time / needs sync state */}
      {needsSync && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 text-center mb-6"
          style={{ borderColor: 'rgba(99,102,241,0.2)' }}
        >
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
               style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Brain className="w-6 h-6" style={{ color: '#6366f1' }} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Ready to analyze your inbox</h2>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: '#71717A' }}>
            MailSweep AI will scan your Gmail to generate your inbox health score, storage breakdown, and cleanup recommendations.
          </p>
          <button onClick={handleSync} disabled={syncing} className="btn-brand">
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Analyzing...' : 'Start Analysis'}
          </button>
          <p className="text-xs mt-3" style={{ color: '#3f3f46' }}>Usually takes 30-60 seconds</p>
        </motion.div>
      )}

      {!needsSync && (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
          {/* Top row: Health + Storage */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Health Score */}
            <motion.div variants={fadeUp} className="glass-card p-5 lg:col-span-1">
              <p className="metric-label mb-4">Inbox Health Score</p>
              <HealthScoreGauge score={healthScore} />
              
              {/* Health breakdown */}
              <div className="mt-4 space-y-2">
                {data?.healthBreakdown && Object.entries(data.healthBreakdown).map(([key, val]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs capitalize" style={{ color: '#71717A' }}>
                      {key.replace('Score', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" 
                             style={{ width: `${val}%`, background: getHealthColor(val) }} />
                      </div>
                      <span className="text-xs font-mono w-6 text-right" style={{ color: '#52525B' }}>{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Storage */}
            <motion.div variants={fadeUp} className="glass-card p-5 lg:col-span-2">
              <p className="metric-label mb-4">Storage Usage</p>
              <div className="flex items-start gap-6">
                <StorageDonut storageStats={storage} />
                
                <div className="flex-1 min-w-0 space-y-3">
                  {storage?.breakdown && Object.entries(storage.breakdown).map(([key, val]: [string, any]) => (
                    val > 0 && (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs capitalize" style={{ color: '#A1A1AA' }}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </span>
                          <span className="text-xs font-mono" style={{ color: '#71717A' }}>
                            {formatBytes(val)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all"
                               style={{ 
                                 width: `${(val / (storage?.totalUsed || 1)) * 100}%`,
                                 background: {
                                   attachments: '#6366f1',
                                   newsletters: '#22d3ee',
                                   promotions: '#F59E0B',
                                   social: '#10B981',
                                   updates: '#3B82F6',
                                   other: '#71717A',
                                 }[key] || '#71717A'
                               }} />
                        </div>
                      </div>
                    )
                  ))}
                  
                  <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex justify-between">
                      <span className="text-xs text-white font-medium">Total used</span>
                      <span className="text-xs font-mono font-medium text-white">
                        {formatBytes(storage?.totalUsed || 0)} / {formatBytes(storage?.totalCapacity || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Metric cards */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Emails', value: (emailCount.total || 0).toLocaleString(), icon: Mail, color: '#6366f1' },
              { label: 'Newsletters', value: (emailCount.newsletters || 0).toLocaleString(), icon: Bell, color: '#22d3ee' },
              { label: 'With Attachments', value: (emailCount.withAttachments || 0).toLocaleString(), icon: HardDrive, color: '#F59E0B' },
              { label: 'Spam', value: (emailCount.spam || 0).toLocaleString(), icon: AlertTriangle, color: '#EF4444' },
            ].map((card) => (
              <div key={card.label} className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="metric-label">{card.label}</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                       style={{ background: `${card.color}15`, border: `1px solid ${card.color}25` }}>
                    <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-white font-mono">{card.value}</p>
              </div>
            ))}
          </motion.div>

          {/* Quick actions + Weekly report */}
          <div className="grid lg:grid-cols-2 gap-4">
            <motion.div variants={fadeUp}>
              <QuickActions data={data} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <WeeklyReportCard 
                report={weeklyReport} 
                onGenerate={handleGenerateReport} 
              />
            </motion.div>
          </div>

          {/* Top senders quick view */}
          {data?.topSenders?.length > 0 && (
            <motion.div variants={fadeUp} className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white">Top Storage Consumers</p>
                <Link href="/analytics" className="text-xs flex items-center gap-1" style={{ color: '#6366f1' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {data.topSenders.slice(0, 5).map((sender: any) => (
                  <div key={sender.email} className="flex items-center gap-3 py-1.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                         style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                      {(sender.name || sender.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{sender.name || sender.email}</p>
                      <p className="text-xs truncate" style={{ color: '#52525B' }}>{sender.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-white">{formatBytes(sender.totalSize)}</p>
                      <p className="text-xs" style={{ color: '#52525B' }}>{sender.count} emails</p>
                    </div>
                    <div className="w-20 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ 
                        width: `${(sender.totalSize / (data.topSenders[0]?.totalSize || 1)) * 100}%`,
                        background: 'linear-gradient(90deg, #6366f1, #22d3ee)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
