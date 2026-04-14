'use client';

import { useEffect, useState } from 'react';
import type { Lead } from '@/lib/types';

interface Stats {
  total: number;
  ok: number;
  warning: number;
  breached: number;
  byStage: Record<string, number>;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leads?limit=1000')
      .then((r) => r.json())
      .then((data) => {
        const leads: Lead[] = data.leads || [];
        const s: Stats = {
          total: leads.length,
          ok: leads.filter((l) => l.sla_status === 'ok').length,
          warning: leads.filter((l) => l.sla_status === 'warning').length,
          breached: leads.filter((l) => l.sla_status === 'breached').length,
          byStage: {},
        };
        for (const lead of leads) {
          s.byStage[lead.stage] = (s.byStage[lead.stage] || 0) + 1;
        }
        setStats(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Total Leads', value: stats.total, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'OK', value: stats.ok, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Warning', value: stats.warning, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Breached', value: stats.breached, color: 'bg-red-50 text-red-700 border-red-200' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg border p-5 ${card.color}`}
          >
            <p className="text-sm font-medium opacity-75">{card.label}</p>
            <p className="mt-1 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {Object.keys(stats.byStage).length > 0 && (
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-3 text-sm font-medium text-gray-500">Leads by Stage</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(stats.byStage).map(([stage, count]) => (
              <div key={stage} className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">{stage}</p>
                <p className="text-lg font-semibold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
