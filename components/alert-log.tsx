'use client';

import { useEffect, useState } from 'react';
import type { Alert } from '@/lib/types';

export function AlertLog() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/alerts?limit=100')
      .then((r) => r.json())
      .then((data) => {
        setAlerts(data.alerts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Time</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Lead</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Message</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Sent To</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                Loading...
              </td>
            </tr>
          ) : alerts.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                No alerts sent yet
              </td>
            </tr>
          ) : (
            alerts.map((alert) => (
              <tr key={alert.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {new Date(alert.created_at).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {(alert.lead as Record<string, string>)?.lead_name || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {alert.stage}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {alert.message}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {alert.sent_to}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
