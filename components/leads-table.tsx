'use client';

import { useEffect, useState } from 'react';
import { SlaBadge } from './sla-badge';
import { getIdleTime, getMaxIdleLabel } from '@/lib/sla';
import type { Lead, SlaStatus, Stage } from '@/lib/types';

const STAGES: Stage[] = [
  'New',
  'Contact Attempt',
  'Qualifying',
  'Sourcing Product',
  'Quoted / Finance',
  'Committed Sale',
];

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (stageFilter) params.set('stage', stageFilter);
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '100');

    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.leads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stageFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="ok">OK</option>
          <option value="warning">Warning</option>
          <option value="breached">Breached</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Salesperson</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Idle Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Max Idle</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">SLA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No leads found
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={
                    lead.sla_status === 'breached'
                      ? 'bg-red-50'
                      : lead.sla_status === 'warning'
                        ? 'bg-yellow-50'
                        : ''
                  }
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {lead.lead_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {lead.partner_name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {lead.salesperson || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {lead.stage}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {getIdleTime(lead.stage_entered_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {getMaxIdleLabel(lead.stage as Stage)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <SlaBadge status={lead.sla_status as SlaStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
