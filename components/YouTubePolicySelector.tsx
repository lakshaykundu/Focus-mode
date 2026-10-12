import { Ban, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { YouTubePolicy } from '@/types/settings';
import { SegmentedControl } from './ui/SegmentedControl';

interface Props {
  value: YouTubePolicy;
  onChange: (value: YouTubePolicy) => void;
  disabled?: boolean;
  variant?: 'compact' | 'detailed';
}

const DETAILS: Record<YouTubePolicy, { title: string; body: string; icon: typeof Ban }> = {
  block: {
    title: 'Block YouTube',
    body: 'youtube.com is blocked like any other distracting site.',
    icon: Ban,
  },
  clean: {
    title: 'Clean YouTube',
    body: 'YouTube stays usable for tutorials. Shorts, feeds and recommendations are hidden, and only videos in your allowed categories play.',
    icon: Sparkles,
  },
};

export function YouTubePolicySelector({ value, onChange, disabled, variant = 'compact' }: Props) {
  if (variant === 'compact') {
    return (
      <SegmentedControl
        label="YouTube policy"
        size="sm"
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={[
          { value: 'block', label: 'Block', title: DETAILS.block.body },
          { value: 'clean', label: 'Clean', title: DETAILS.clean.body },
        ]}
      />
    );
  }

  return (
    <div role="radiogroup" aria-label="YouTube policy" className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(DETAILS) as YouTubePolicy[]).map((policy) => {
        const { title, body, icon: Icon } = DETAILS[policy];
        const selected = policy === value;
        return (
          <button
            key={policy}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(policy)}
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              selected ? 'border-accent/40 bg-accent-soft' : 'border-line bg-white/[0.02] hover:border-line-strong',
            )}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')} aria-hidden />
            <span>
              <span className="block text-[13px] font-medium">{title}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{body}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
