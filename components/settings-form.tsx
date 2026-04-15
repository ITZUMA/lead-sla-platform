'use client';

import { useEffect, useState } from 'react';

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
        const data = await res.json().catch(() => ({}));
        setMessage(`Failed to save: ${data.error || res.statusText}`);
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
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Default Google Chat Webhook</h2>
        <p className="mb-3 text-sm text-gray-500">Fallback webhook if no routes are configured. Routes above take priority.</p>
        <div className="space-y-3">
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
    </div>
  );
}
