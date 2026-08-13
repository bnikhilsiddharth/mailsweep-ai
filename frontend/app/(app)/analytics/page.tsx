'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw, MessageSquare, Send, Sparkles } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { getSenders, getContacts, sendCopilotMessage, getTrends } from '@/lib/api';
import { formatBytes, getCategoryLabel, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const CATEGORY_COLORS: Record<string, string> = {
  promotions: '#F59E0B',
  newsletter: '#22d3ee',
  social: '#10B981',
  personal: '#6366f1',
  banking: '#8B5CF6',
  spam: '#EF4444',
  updates: '#3B82F6',
  other: '#52525B',
};

export default function AnalyticsPage() {
  const [senders, setSenders] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: string; content: string }>>([
    { role: 'assistant', content: "Hi! I'm your AI Storage Copilot. Ask me anything about your inbox — storage usage, cleanup suggestions, or patterns I've noticed." }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sendersRes, contactsRes] = await Promise.all([
        getSenders(),
        getContacts(),
      ]);
      setSenders(sendersRes.data.senders || []);
      setContacts(contactsRes.data.contacts || []);
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCopilot = async () => {
    if (!copilotInput.trim() || copilotLoading) return;
    const userMsg = copilotInput.trim();
    setCopilotInput('');
    const newMessages = [...copilotMessages, { role: 'user', content: userMsg }];
    setCopilotMessages(newMessages);
    setCopilotLoading(true);
    try {
      const res = await sendCopilotMessage(userMsg, copilotMessages.slice(-8));
      setCopilotMessages([...newMessages, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setCopilotMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Category breakdown for pie chart
  const categoryMap = senders.reduce((acc: Record<string, number>, s: any) => {
    acc[s.category] = (acc[s.category] || 0) + s.totalSize;
    return acc;
  }, {});
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name: getCategoryLabel(name), value, key: name }))
    .sort((a, b) => (b.value as number) - (a.value as number));

  // Top 10 senders for bar chart
  const topSendersChart = senders
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 10)
    .map(s => ({ name: s.name?.split(' ')[0] || s.email.split('@')[0], size: s.totalSize, count: s.count }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p className="font-medium text-white mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color || '#A1A1AA' }}>
            {p.name}: {p.name === 'size' ? formatBytes(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="p-6 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-48 rounded-xl shimmer" />)}</div>;
  }

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <button onClick={fetchData} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Charts column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Top senders bar chart */}
          <div className="glass-card p-5">
            <p className="text-sm font-medium text-white mb-4">Top Storage Consumers</p>
            {topSendersChart.length === 0 ? (
              <div className="h-48 flex items-center justify-center" style={{ color: '#52525B' }}>
                <p className="text-sm">No sender data. Run analysis first.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topSendersChart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatBytes(v, 0)} tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="size" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category breakdown */}
          <div className="glass-card p-5">
            <p className="text-sm font-medium text-white mb-4">Storage by Category</p>
            <div className="flex items-center gap-8">
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                         paddingAngle={2} dataKey="value" animationBegin={0} animationDuration={700}>
                      {categoryData.map((entry) => (
                        <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] || '#52525B'} stroke="transparent" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {categoryData.slice(0, 6).map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                           style={{ background: CATEGORY_COLORS[item.key] || '#52525B' }} />
                      <span className="text-xs" style={{ color: '#A1A1AA' }}>{item.name}</span>
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#71717A' }}>{formatBytes(item.value as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Frequent contacts */}
          {contacts.length > 0 && (
            <div className="glass-card p-5">
              <p className="text-sm font-medium text-white mb-4">Frequent Personal Contacts</p>
              <div className="space-y-2">
                {contacts.slice(0, 8).map((contact: any) => (
                  <div key={contact.email} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                         style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                      {contact.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{contact.name}</p>
                      <p className="text-xs truncate" style={{ color: '#52525B' }}>{contact.email}</p>
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#52525B' }}>{contact.emailCount} emails</span>
                    <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${contact.trustScore}%`,
                        background: 'linear-gradient(90deg, #6366f1, #22d3ee)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Copilot sidebar */}
        <div className="glass-card flex flex-col" style={{ height: '600px', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Sparkles className="w-4 h-4" style={{ color: '#6366f1' }} />
            <p className="text-sm font-medium text-white">AI Storage Copilot</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {copilotMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-xs',
                  msg.role === 'user'
                    ? 'text-white'
                    : ''
                )} style={{
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: msg.role === 'user' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: msg.role === 'user' ? 'white' : '#A1A1AA',
                }}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {copilotLoading && (
              <div className="flex justify-start">
                <div className="flex gap-1 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#52525B', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2">
              <input
                value={copilotInput}
                onChange={e => setCopilotInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCopilot()}
                placeholder="Ask about your inbox..."
                className="input-dark text-xs flex-1"
              />
              <button onClick={handleCopilot} disabled={copilotLoading || !copilotInput.trim()} className="btn-brand px-3 text-xs">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs mt-2 text-center" style={{ color: '#3f3f46' }}>
              Powered by Claude AI · Requires ANTHROPIC_API_KEY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
