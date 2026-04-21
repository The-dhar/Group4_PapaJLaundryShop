import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatCount(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString();
}

export default function IssueStatusChart({ data, height = 180, emptyMessage = 'No cases available.' }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div
        style={{
          minHeight: height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: 13,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} width={40} />
        <Tooltip
          formatter={(value, name) => [formatCount(value), name === 'resolved' ? 'Resolved' : 'Unresolved']}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
          }}
        />
        <Legend />
        <Bar dataKey="resolved" name="Resolved" fill="#16a34a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="unresolved" name="Unresolved" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}