import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/[0.05] text-fg-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Status dot; pulses softly while a session is active. */
export function StatusDot({ active, tone = 'accent' }: { active: boolean; tone?: 'accent' | 'warn' }) {
  const color = tone === 'warn' ? 'bg-warn' : 'bg-accent';
  return (
    <span className="relative inline-flex size-2" aria-hidden>
      {active && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-50', color)} />}
      <span className={cn('relative inline-flex size-2 rounded-full', active ? color : 'bg-zinc-600')} />
    </span>
  );
}
