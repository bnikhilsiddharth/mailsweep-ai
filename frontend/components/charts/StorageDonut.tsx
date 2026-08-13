'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatBytes } from '@/lib/utils';

const COLORS = {
  attachments: '#6366f1',
  newsletters: '#22d3ee',
  promotions: '#F59E0B',
  social: '#10B981',
  updates: '#3B82F6',
  other: '#52525B',
};

interface Props {
  storageStats: any;
}

export function StorageDonut({ storageStats }: Props) {
  if (!storageStats?.breakdown) return null;

  const data = Object.entries(storageStats.breakdown)
    .filter(([, val]) => (val as number) > 0)
    .map(([key, val]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: val as number,
      color: COLORS[key as keyof typeof COLORS] || '#52525B',
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-lg px-3 py-2 text-xs" 
             style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-white font-medium">{payload[0].name}</p>
          <p style={{ color: '#A1A1AA' }}>{formatBytes(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={55}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xs font-bold text-white font-mono">
          {storageStats.percentUsed?.toFixed(0)}%
        </span>
        <span className="text-[9px]" style={{ color: '#52525B' }}>used</span>
      </div>
    </div>
  );
}
