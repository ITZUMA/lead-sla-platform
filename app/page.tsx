import { DashboardStats } from '@/components/dashboard-stats';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of lead SLA compliance
        </p>
      </div>
      <DashboardStats />
    </div>
  );
}
