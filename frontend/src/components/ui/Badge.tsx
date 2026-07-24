import clsx from 'clsx';
import type { AppointmentStatus } from '../../types';

const statusMap: Record<AppointmentStatus, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmé', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Annulé', className: 'bg-red-100 text-red-800' },
  COMPLETED: { label: 'Terminé', className: 'bg-slate-200 text-slate-700' },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, className } = statusMap[status];
  return (
    <span className={clsx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}
