import { AlertLog } from '@/components/alert-log';

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        <p className="mt-1 text-sm text-gray-500">
          History of all SLA breach alerts sent via Google Chat
        </p>
      </div>
      <AlertLog />
    </div>
  );
}
