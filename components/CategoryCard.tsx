import type { ReactNode } from 'react';
import { CATEGORY_META } from '@/lib/siteRegistry';
import { cn } from '@/lib/cn';
import type { SiteCategory } from '@/types/settings';
import { CATEGORY_ICONS } from './categoryIcons';
import { Switch } from './ui/Switch';

interface CategoryCardProps {
  category: SiteCategory;
  enabled: boolean;
  count: { enabled: number; total: number };
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  /** Expanded content, e.g. the website list on the settings page. */
  children?: ReactNode;
  variant?: 'row' | 'card';
}

export function CategoryCard({
  category,
  enabled,
  count,
  onToggle,
  disabled,
  children,
  variant = 'row',
}: CategoryCardProps) {
  const meta = CATEGORY_META[category];
  const Icon = CATEGORY_ICONS[category];
  const summary = count.total === 0 ? 'No sites yet' : `${count.enabled} of ${count.total} sites on`;

  const header = (
    <div className={cn('flex items-center gap-3', variant === 'row' ? 'px-3 py-2.5' : 'p-4')}>
      <div
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg border transition-colors',
          enabled ? 'border-accent/20 bg-accent-soft text-accent' : 'border-line bg-white/[0.03] text-fg-subtle',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13px] font-medium', !enabled && 'text-fg-muted')}>{meta.label}</p>
        <p className="tabular truncate text-[11px] text-fg-subtle">
          {variant === 'card' ? `${meta.description} · ${summary}` : summary}
        </p>
      </div>
      <Switch
        checked={enabled}
        onChange={onToggle}
        label={`Block ${meta.label}`}
        disabled={disabled}
        size={variant === 'row' ? 'sm' : 'md'}
      />
    </div>
  );

  if (variant === 'row') return header;
  return (
    <section aria-label={meta.label} className="rounded-xl border border-line bg-surface shadow-card">
      {header}
      {children && <div className="border-t border-line">{children}</div>}
    </section>
  );
}
