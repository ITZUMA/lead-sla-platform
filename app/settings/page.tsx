import { SettingsForm } from '@/components/settings-form';
import { RoutingSettings } from '@/components/routing-settings';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure webhooks, SLA rules, and alert routing
        </p>
      </div>
      <RoutingSettings />
      <SettingsForm />
    </div>
  );
}
