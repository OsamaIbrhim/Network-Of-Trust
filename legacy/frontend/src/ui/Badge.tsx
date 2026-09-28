import { ReactNode } from 'react';

type BadgeVariant = 'verified' | 'unverified' | 'active' | 'revoked' | 'pending';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  verified: 'bg-emerald-100 text-emerald-700',
  unverified: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-rose-100 text-rose-700',
  pending: 'bg-slate-100 text-slate-600',
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}