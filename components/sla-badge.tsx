import { cn } from '@/lib/utils';
import type { SlaStatus } from '@/lib/types';

const statusStyles: Record<SlaStatus, string> = {
  ok: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  breached: 'bg-red-100 text-red-800',
};

const statusLabels: Record<SlaStatus, string> = {
  ok: 'OK',
  warning: 'Warning',
  breached: 'Breached',
};

export function SlaBadge({ status }: { status: SlaStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
