'use client';
import Link from 'next/link';
import { Trash2, Mail, HardDrive, BarChart3, ArrowRight, Shield } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface Props {
  data: any;
}

export function QuickActions({ data }: Props) {
  const candidates = data?.cleanupCandidates?.length || 0;
  const candidateSize = data?.cleanupCandidates?.reduce((s: number, c: any) => s + c.size, 0) || 0;
  const subs = data?.subscriptions?.length || 0;
  const attachmentSize = data?.storageStats?.breakdown?.attachments || 0;

  const actions = [
    {
      href: '/cleanup',
      icon: Trash2,
      label: 'Clean Up Inbox',
      description: candidates > 0 ? `${candidates} emails, recover ${formatBytes(candidateSize)}` : 'No candidates found',
      color: '#6366f1',
      badge: candidates > 0 ? candidates.toString() : null,
    },
    {
      href: '/inbox',
      icon: Mail,
      label: 'Manage Subscriptions',
      description: subs > 0 ? `${subs} active subscriptions detected` : 'No subscriptions found',
      color: '#22d3ee',
      badge: subs > 0 ? subs.toString() : null,
    },
    {
      href: '/storage',
      icon: HardDrive,
      label: 'View Storage Forecast',
      description: attachmentSize > 0 ? `${formatBytes(attachmentSize)} in attachments` : 'Check storage trends',
      color: '#F59E0B',
      badge: null,
    },
    {
      href: '/security',
      icon: Shield,
      label: 'Review Protection',
      description: `${(data?.preferences?.protectedSenders?.length || 0) + 5} sources protected`,
      color: '#8B5CF6',
      badge: null,
    },
  ];

  return (
    <div className="glass-card p-5 h-full">
      <p className="text-sm font-medium text-white mb-4">Quick Actions</p>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}
                className="flex items-center gap-3 p-3 rounded-lg transition-all duration-150 group"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: `${action.color}12`, border: `1px solid ${action.color}20` }}>
              <action.icon className="w-4 h-4" style={{ color: action.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{action.label}</p>
                {action.badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                        style={{ background: `${action.color}18`, color: action.color }}>
                    {action.badge}
                  </span>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: '#52525B' }}>{action.description}</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#52525B' }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
