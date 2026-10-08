import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'primary' | 'accent';
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl2 bg-white p-4 shadow-soft">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tone === 'primary' ? 'bg-primary-50 text-primary-700' : 'bg-orange-50 text-accent-600'
        }`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-ink/50">{label}</p>
        <p className="font-mono text-lg font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}
