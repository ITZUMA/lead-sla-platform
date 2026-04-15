'use client';

import { useEffect, useState } from 'react';
import type { AlertRoute } from '@/lib/google-chat';

const STAGES = ['', 'New', 'Contact Attempt', 'Qualifying', 'Sourcing Product', 'Quoted / Finance', 'Committed Sale'];
const ALERT_LEVELS = ['', 'highest', 'critical', 'high', 'medium'];
const TEAMS = [
  { id: '', label: 'All Teams' },
  { id: '1', label: 'Team 1' },
  { id: '6', label: 'Team 6' },
];

const LEAD_TYPES = [
  { id: '', label: 'All Types' },
  { id: 'lead', label: 'Lead' },
  { id: 'opportunity', label: 'Opportunity' },
];

const emptyRoute = {
  name: '',
  webhook_url: '',
  stage: '',
  team_id: '',
  alert_level: '',
  lead_type: '',
  sla_value: '',
  sla_unit: 'minutes',
};

export function RoutingSettings() {
  const [routes, setRoutes] = useState<AlertRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRoute);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchRoutes = () => {
    fetch('/api/routes')
      .then((r) => r.json())
      .then((data) => {
        setRoutes(data.routes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchRoutes(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.webhook_url) {
      setMessage('Name and Webhook URL are required');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      // Convert SLA value + unit to minutes
      let slaMinutes: number | null = null;
      if (form.sla_value) {
        const val = parseFloat(form.sla_value);
        if (form.sla_unit === 'hours') slaMinutes = Math.round(val * 60);
        else if (form.sla_unit === 'days') slaMinutes = Math.round(val * 510); // 8.5 biz hours per day
        else slaMinutes = Math.round(val);
      }

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          webhook_url: form.webhook_url,
          stage: form.stage || null,
          team_id: form.team_id ? parseInt(form.team_id) : null,
          alert_level: form.alert_level || null,
          lead_type: form.lead_type || null,
          sla_override_minutes: slaMinutes,
        }),
      });
      if (res.ok) {
        setForm(emptyRoute);
        setShowForm(false);
        fetchRoutes();
        setMessage('Route added!');
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setMessage('Error saving route');
    }
    setSaving(false);
  };

  const handleToggle = async (route: AlertRoute) => {
    await fetch('/api/routes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: route.id, is_active: !route.is_active }),
    });
    fetchRoutes();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/routes?id=${id}`, { method: 'DELETE' });
    fetchRoutes();
  };

  if (loading) {
    return <div className="animate-pulse h-40 rounded-lg bg-gray-100" />;
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Alert Routing</h2>
          <p className="text-sm text-gray-500">Route SLA alerts to different Google Chat spaces based on stage, team, or alert level</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {showForm ? 'Cancel' : '+ Add Route'}
        </button>
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.includes('added') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      {showForm && (
        <div className="mb-6 rounded-md border bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Route Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. New Leads - Urgent"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Google Chat Webhook URL *</label>
              <input
                type="url"
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage (optional)</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Stages</option>
                {STAGES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sales Team (optional)</label>
              <select
                value={form.team_id}
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alert Level (optional)</label>
              <select
                value={form.alert_level}
                onChange={(e) => setForm({ ...form, alert_level: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Levels</option>
                {ALERT_LEVELS.filter(Boolean).map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lead Type (optional)</label>
              <select
                value={form.lead_type}
                onChange={(e) => setForm({ ...form, lead_type: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {LEAD_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SLA Override (optional)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.sla_value}
                  onChange={(e) => setForm({ ...form, sla_value: e.target.value })}
                  placeholder="e.g. 15"
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  min="1"
                />
                <select
                  value={form.sla_unit}
                  onChange={(e) => setForm({ ...form, sla_unit: e.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Business Days</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-400">Leave empty to use default SLA for the stage</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Route'}
          </button>
        </div>
      )}

      {routes.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          No routes configured. Alerts will use the default webhook URL from settings.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Team</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Level</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">SLA</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {routes.map((route) => (
                <tr key={route.id} className={route.is_active ? '' : 'opacity-50'}>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900">{route.name}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{route.stage || 'All'}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{route.lead_type || 'All'}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{route.team_id ? `Team ${route.team_id}` : 'All'}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{route.alert_level?.toUpperCase() || 'All'}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">
                    {route.sla_override_minutes
                      ? route.sla_override_minutes >= 510
                        ? `${(route.sla_override_minutes / 510).toFixed(1)}d`
                        : route.sla_override_minutes >= 60
                          ? `${(route.sla_override_minutes / 60).toFixed(1)}h`
                          : `${route.sla_override_minutes}m`
                      : 'Default'}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleToggle(route)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        route.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {route.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleDelete(route.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
