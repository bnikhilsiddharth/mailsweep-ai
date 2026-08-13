'use client';
import { Sparkles, TrendingUp, ArrowRight, RefreshCw } from 'lucide-react';
import { formatBytes, timeAgo } from '@/lib/utils';
import Link from 'next/link';

interface Props {
  report: any;
  onGenerate: () => void;
}

export function WeeklyReportCard({ report, onGenerate }: Props) {
  if (!report) {
    return (
      <div className="glass-card p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4" style={{ color: '#6366f1' }} />
          <p className="text-sm font-medium text-white">Weekly AI Report</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
               style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Sparkles className="w-5 h-5" style={{ color: '#6366f1' }} />
          </div>
          <p className="text-sm font-medium text-white mb-1">No report yet</p>
          <p className="text-xs mb-4" style={{ color: '#52525B' }}>
            Generate your first AI-powered inbox intelligence report
          </p>
          <button onClick={onGenerate} className="btn-brand text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Generate Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: '#6366f1' }} />
          <p className="text-sm font-medium text-white">Weekly AI Report</p>
        </div>
        <button onClick={onGenerate} 
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{ color: '#52525B', background: 'rgba(255,255,255,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#A1A1AA'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#52525B'; }}>
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Storage saved', value: formatBytes(report.metrics?.storageSaved || 0) },
          { label: 'Emails cleaned', value: (report.metrics?.emailsCleaned || 0).toLocaleString() },
          { label: 'Subscriptions', value: report.metrics?.newSubscriptionsDetected || 0 },
          { label: 'Efficiency', value: `${report.metrics?.cleanupEfficiency || 0}%` },
        ].map((m) => (
          <div key={m.label} className="rounded-lg p-2.5"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-mono font-semibold text-white">{m.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* AI insights */}
      {report.aiInsights?.length > 0 && (
        <div className="flex-1 space-y-2 mb-3">
          {report.aiInsights.slice(0, 2).map((insight: string, i: number) => (
            <div key={i} className="flex gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#6366f1' }} />
              <p style={{ color: '#A1A1AA' }}>{insight}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: '#3f3f46' }}>
        {timeAgo(report.generatedAt)}
      </p>
    </div>
  );
}
