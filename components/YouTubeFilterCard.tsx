import { Check, X } from 'lucide-react';
import { YOUTUBE_CATEGORIES } from '@/lib/youtubeCategories';
import { cn } from '@/lib/cn';
import type { YouTubeFilterSettings } from '@/types/settings';
import { Card } from './ui/Card';
import { SegmentedControl } from './ui/SegmentedControl';
import { Switch } from './ui/Switch';

interface Props {
  filter: YouTubeFilterSettings;
  /** Clean YouTube isn't the active policy, so the filter has no effect right now. */
  inactive: boolean;
  /** Strict Mode session: only changes that tighten the filter are allowed. */
  strictLocked: boolean;
  pending: string | null;
  onChange: (patch: Partial<Pick<YouTubeFilterSettings, 'enabled' | 'allowedCategories' | 'unknownPolicy'>>, key: string) => void;
  onRemoveChannel: (channelId: string) => void;
}

export function YouTubeFilterCard({ filter, inactive, strictLocked, pending, onChange, onRemoveChannel }: Props) {
  const toggleCategory = (id: string) => {
    const allowed = filter.allowedCategories.includes(id)
      ? filter.allowedCategories.filter((c) => c !== id)
      : [...filter.allowedCategories, id];
    onChange({ allowedCategories: allowed }, `filter-cat:${id}`);
  };
  const off = !filter.enabled;

  return (
    <Card className={cn('divide-y divide-line', inactive && 'opacity-60')}>
      <div className="flex items-center justify-between gap-6 px-4 py-3">
        <div>
          <p className="text-[13px] font-medium">Filter videos by category</p>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-subtle">
            Videos outside your allowed categories are paused and covered. Uses the category the uploader
            chose on YouTube. It's a metadata lookup, not AI.
          </p>
        </div>
        <Switch
          label="Filter videos by category"
          checked={filter.enabled}
          disabled={pending === 'filter-enabled' || (strictLocked && filter.enabled)}
          onChange={(enabled) => onChange({ enabled }, 'filter-enabled')}
        />
      </div>

      <div className={cn('px-4 py-3', off && 'opacity-50')}>
        <p className="text-[13px] font-medium">Allowed categories</p>
        <p className="mt-0.5 mb-3 text-[12px] text-fg-subtle">
          {filter.allowedCategories.length} of {YOUTUBE_CATEGORIES.length} allowed. Everything else is blocked
          during focus sessions.
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Allowed YouTube categories">
          {YOUTUBE_CATEGORIES.map((category) => {
            const allowed = filter.allowedCategories.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={allowed}
                disabled={off || pending === `filter-cat:${category.id}` || (strictLocked && !allowed)}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed',
                  allowed
                    ? 'border-accent/35 bg-accent-soft text-accent'
                    : 'border-line bg-white/[0.02] text-fg-subtle hover:border-line-strong hover:text-fg-muted',
                )}
              >
                {allowed && <Check className="size-3" aria-hidden />}
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn('flex items-center justify-between gap-6 px-4 py-3', off && 'opacity-50')}>
        <div>
          <p className="text-[13px] font-medium">When the category can't be read</p>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-subtle">
            Rare, but possible if YouTube changes its player. Blocking is stricter; allowing never gets in your
            way.
          </p>
        </div>
        <SegmentedControl
          label="When the category can't be read"
          size="sm"
          value={filter.unknownPolicy}
          disabled={off || pending === 'filter-unknown' || (strictLocked && filter.unknownPolicy === 'block')}
          onChange={(unknownPolicy) => onChange({ unknownPolicy }, 'filter-unknown')}
          options={[
            { value: 'allow', label: 'Allow' },
            { value: 'block', label: 'Block' },
          ]}
        />
      </div>

      <div className={cn('px-4 py-3', off && 'opacity-50')}>
        <p className="text-[13px] font-medium">Always-allowed channels</p>
        {filter.allowedChannels.length === 0 ? (
          <p className="mt-0.5 text-[12px] text-fg-subtle">
            Channels you allow from a blocked video's overlay appear here.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {filter.allowedChannels.map((channel) => (
              <li
                key={channel.id}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white/[0.03] pr-1 pl-2.5 text-[12px]"
              >
                <span className="max-w-[220px] truncate">{channel.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveChannel(channel.id)}
                  aria-label={`Stop always allowing ${channel.name}`}
                  title="Remove"
                  className="grid size-5 cursor-pointer place-items-center rounded-full text-fg-subtle hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
