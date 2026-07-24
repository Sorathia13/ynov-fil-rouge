import clsx from 'clsx';
import type { ReactNode } from 'react';

type Variant = 'info' | 'success' | 'error' | 'warning';

const styles: Record<Variant, string> = {
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
};

export function Alert({
  variant = 'info',
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={clsx('rounded-lg border px-4 py-3 text-sm', styles[variant])}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}
