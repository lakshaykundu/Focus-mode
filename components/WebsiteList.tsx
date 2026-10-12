import { Trash2 } from 'lucide-react';
import { YOUTUBE_DOMAIN } from '@/lib/siteRegistry';
import { cn } from '@/lib/cn';
import type { BlockedSite, YouTubePolicy } from '@/types/settings';
import { Badge } from './ui/Badge';
import { Switch } from './ui/Switch';

interface WebsiteListProps {
  sites: BlockedSite[];
  categoryEnabled: boolean;
  youtubePolicy: YouTubePolicy;
  onToggle: (site: BlockedSite, enabled: boolean) => void;
  onRemove: (site: BlockedSite) => void;
  disabled?: boolean;
  /** Strict Mode: sites that are on can't be switched off or removed. */
  lockEnabled?: boolean;
  emptyMessage?: string;
}

export function WebsiteList({
  sites,
  categoryEnabled,
  youtubePolicy,
  onToggle,
  onRemove,
  disabled,
  lockEnabled = false,
  emptyMessage = 'No sites in this category.',
}: WebsiteListProps) {
  if (sites.length === 0) {
    return <p className="px-4 py-3 text-[12px] text-fg-subtle">{emptyMessage}</p>;
  }
  return (
    <ul className={cn('divide-y divide-line', !categoryEnabled && 'opacity-50')}>
      {sites.map((site) => (
        <li key={site.id} className="group flex items-center gap-3 px-4 py-2">
          {/* A monogram instead of a favicon: fetching favicons would reveal the blocklist to third parties. */}
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-md bg-white/[0.04] text-[11px] font-semibold text-fg-muted uppercase"
          >
            {site.domain.charAt(0)}
          </span>
          <span className={cn('flex-1 truncate font-mono text-[12.5px]', !site.enabled && 'text-fg-subtle line-through decoration-white/20')}>
            {site.domain}
          </span>
          {site.domain === YOUTUBE_DOMAIN && site.enabled && (
            <Badge tone={youtubePolicy === 'clean' ? 'accent' : 'neutral'}>
              {youtubePolicy === 'clean' ? 'Clean mode' : 'Blocked'}
            </Badge>
          )}
          {site.custom && (
            <button
              type="button"
              onClick={() => onRemove(site)}
              disabled={disabled || (lockEnabled && site.enabled)}
              aria-label={`Remove ${site.domain}`}
              title="Remove"
              className="cursor-pointer rounded-md p-1.5 text-fg-subtle opacity-60 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <Switch
            size="sm"
            checked={site.enabled}
            onChange={(enabled) => onToggle(site, enabled)}
            label={`Block ${site.domain}`}
            disabled={disabled || (lockEnabled && site.enabled)}
          />
        </li>
      ))}
    </ul>
  );
}
