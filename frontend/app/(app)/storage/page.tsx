'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, TrendingUp, AlertTriangle, RefreshCw, Calendar, Zap } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { getForecast, getAttachments } from '@/lib/api';
import { formatBytes, formatDate, getStorageColor, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="font-medium text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatBytes(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function StoragePage() {
  const [data, setData] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [forecastRes, attachRes] = await Promise.all([
        getForecast(),
        getAttachments(1),
      ]);
      setData(forecastRes.data);
      setAttachments(attachRes.data.attachments || []);
    } catch {
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-xl shimmer" />)}
      </div>
    );
  }

  const snapshots = data?.snapshots || [];
  const forecast = data?.forecast;
  const insufficient = data?.insufficient;

  // Build chart data with projected points
  const chartData = snapshots.map((s: any) => ({
    date: format(new Date(s.date), 'MMM d'),
    actual: s.totalUsed,
    capacity: s.totalCapacity,
  }));

  // Add forecast projections
  if (forecast) {
    const today = new Date();
    [30, 60, 90].forEach(days => {
      const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
      const projected = forecast.projections[`${days}d`];
      chartData.push({
        date: format(futureDate, 'MMM d') + ' (est)',
        projected,
        capacity: snapshots[snapshots.length - 1]?.totalCapacity,
      });
    });
  }

  const currentStorage = snapshots[snapshots.length - 1];
  const storagePercent = currentStorage?.percentUsed || 0;
  const storageColor = getStorageColor(storagePercent);

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Storage Forecast</h1>
          <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>
            {snapshots.length} data points · Linear regression model
          </p>
        </div>
        <button onClick={fetchData} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="glass-card p-4">
          <p className="metric-label mb-2">Current Usage</p>
          <p className="text-2xl font-bold font-mono" style={{ color: storageColor }}>
            {storagePercent.toFixed(1)}%
          </p>
          <p className="text-xs mt-1" style={{ color: '#52525B' }}>
            {formatBytes(currentStorage?.totalUsed || 0)} / {formatBytes(currentStorage?.totalCapacity || 0)}
          </p>
        </div>

        {forecast ? (
          <>
            <div className="glass-card p-4">
              <p className="metric-label mb-2">Days to Full</p>
              <p className="text-2xl font-bold font-mono" style={{ color: forecast.daysToFull < 90 ? '#EF4444' : forecast.daysToFull < 180 ? '#F59E0B' : '#10B981' }}>
                {forecast.daysToFull === 999 ? '999+' : forecast.daysToFull}
              </p>
              <p className="text-xs mt-1" style={{ color: '#52525B' }}>
                at current growth rate
              </p>
            </div>

            <div className="glass-card p-4">
              <p className="metric-label mb-2">Monthly Growth</p>
              <p className="text-2xl font-bold font-mono text-white">
                +{formatBytes(forecast.monthlyGrowthBytes || 0)}
              </p>
              <p className="text-xs mt-1" style={{ color: '#52525B' }}>
                confidence: {forecast.confidence}
              </p>
            </div>

            <div className="glass-card p-4">
              <p className="metric-label mb-2">Full by</p>
              <p className="text-lg font-bold text-white">
                {forecast.daysToFull < 999 ? formatDate(forecast.estimatedFullDate) : 'Far future'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#52525B' }}>estimated date</p>
            </div>
          </>
        ) : (
          <div className="glass-card p-4 col-span-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-sm" style={{ color: '#A1A1AA' }}>
              {data?.message || 'Need more data for accurate forecast. Check back after a few days.'}
            </p>
          </div>
        )}
      </div>

      {/* Forecast warning banner */}
      {forecast && forecast.daysToFull < 90 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
          <p className="text-sm" style={{ color: '#fca5a5' }}>
            At current growth, your Gmail will be full in {forecast.daysToFull} days.
            Consider running a cleanup session to recover space.
          </p>
        </motion.div>
      )}

      {/* Storage chart */}
      <div className="glass-card p-5 mb-5">
        <p className="text-sm font-medium text-white mb-1">Storage Over Time</p>
        <p className="text-xs mb-5" style={{ color: '#52525B' }}>
          Actual usage (solid) + 90-day projection (dashed)
        </p>
        {chartData.length < 2 ? (
          <div className="flex items-center justify-center h-48" style={{ color: '#52525B' }}>
            <p className="text-sm">Not enough data points yet. Check back tomorrow.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#52525B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatBytes(v, 0)} tick={{ fill: '#52525B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#actualGradient)"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="projected"
                name="Projected"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#projectedGradient)"
                connectNulls
              />
              {currentStorage && (
                <ReferenceLine
                  y={currentStorage.totalCapacity}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  opacity={0.5}
                  label={{ value: '15 GB limit', fill: '#EF4444', fontSize: 10 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Projections */}
      {forecast?.projections && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {Object.entries(forecast.projections).map(([key, val]: [string, any]) => {
            const days = parseInt(key);
            const pct = (val / (currentStorage?.totalCapacity || 1)) * 100;
            return (
              <div key={key} className="glass-card p-4">
                <p className="metric-label mb-2">In {days} days</p>
                <p className="text-xl font-bold font-mono" style={{ color: getStorageColor(pct) }}>
                  {pct.toFixed(1)}%
                </p>
                <p className="text-xs mt-1" style={{ color: '#52525B' }}>{formatBytes(val)}</p>
                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: getStorageColor(pct) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top attachments */}
      {attachments.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-medium text-white">Largest Attachments</p>
          </div>
          {attachments.slice(0, 15).map((att: any, i) => (
            <div key={att.messageId + att.filename}
                 className="flex items-center gap-3 px-5 py-3 text-sm"
                 style={{ borderBottom: i < attachments.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold"
                   style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                {att.filename.split('.').pop()?.toUpperCase().slice(0, 3) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{att.filename}</p>
                <p className="text-xs truncate" style={{ color: '#52525B' }}>{att.sender} · {formatDate(att.date)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono text-white">{formatBytes(att.size)}</p>
                <p className="text-xs" style={{ color: '#52525B' }}>{att.mimeType?.split('/')[1] || 'file'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
