'use client';

import { useEffect, useState } from 'react';
import { SLA_RULES, getMaxIdleLabel } from '@/lib/sla';
import type { Stage } from '@/lib/types';

export function SettingsForm() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setWebhookUrl(data.google_chat_webhook_url || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_chat_webhook_url: webhookUrl }),
      });
      if (res.ok) {
        setMessage('Settings saved!');
      } else {
        setMessage('Failed to save settings');
      }
    } catch {
      setMessage('Error saving settings');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="animate-pulse h-40 rounded-lg bg-gray-100" />;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Google Chat Webhook</h2>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://chat.googleapis.com/v1/spaces/..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {message && (
              <span className={`text-sm ${message.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">SLA Rules</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Max Idle</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Alert Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Recipients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(Object.entries(SLA_RULES) as [Stage, typeof SLA_RULES[Stage]][]).map(
                ([stage, rule]) => (
                  <tr key={stage}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {stage}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {getMaxIdleLabel(stage)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          rule.alert_level === 'highest'
                            ? 'bg-red-100 text-red-800'
                            : rule.alert_level === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : rule.alert_level === 'high'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {rule.alert_level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rule.recipients.join(', ')}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Webhook Payload Format</h2>
        <p className="mb-2 text-sm text-gray-600">
          Configure your Odoo automated action to send a POST request with this JSON body:
        </p>
        <pre className="rounded-md bg-gray-50 p-4 text-xs text-gray-800 overflow-x-auto">
{`{
  "lead_id": 123,
  "lead_name": "Equipment Inquiry - ABC Corp",
  "partner_name": "ABC Corp",
  "salesperson": "John Smith",
  "salesperson_email": "john@company.com",
  "stage": "New",
  "last_stage_update": "2026-04-13 10:30:00"
}`}
        </pre>
      </div>
    </div>
  );
}
