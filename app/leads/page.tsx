import { LeadsTable } from '@/components/leads-table';

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          All leads with SLA status tracking
        </p>
      </div>
      <LeadsTable />
    </div>
  );
}
