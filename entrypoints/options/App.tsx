import { BarChart3, Globe2, Lock, RotateCcw, Shield, Square, Timer, MonitorPlay } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CategoryCard } from '@/components/CategoryCard';
import { DurationSelector } from '@/components/DurationSelector';
import { EmergencyOverride } from '@/components/EmergencyOverride';
import { FocusHistoryChart } from '@/components/FocusHistoryChart';
import { SessionStats } from '@/components/SessionStats';
import { StatusHeader, type FocusStatus } from '@/components/StatusHeader';
import { StrictModeNotice } from '@/components/StrictModeNotice';
import { WebsiteInput } from '@/components/WebsiteInput';
import { WebsiteList } from '@/components/WebsiteList';
import { YouTubePolicySelector } from '@/components/YouTubePolicySelector';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Switch } from '@/components/ui/Switch';
import { useBackgroundAction } from '@/hooks/useBackgroundAction';
import { useCountdown } from '@/hooks/useCountdown';
import { useFocusState, useHistory, useSettings } from '@/hooks/useFocusData';
import { countActiveSites, getBlockTargets, isSiteActive } from '@/lib/blockList';
import { BUILT_IN_CATEGORIES, YOUTUBE_DOMAIN } from '@/lib/siteRegistry';
import { computeStats } from '@/lib/statistics';
import { formatClock } from '@/lib/timer';
import type { CleanYouTubeOptions, SiteCategory } from '@/types/settings';

const NAV = [
  { id: 'session', label: 'Session', icon: Timer },
  { id: 'websites', label: 'Blocked websites', icon: Globe2 },
  { id: 'youtube', label: 'YouTube', icon: MonitorPlay },
  { id: 'focus', label: 'Focus defaults', icon: Lock },
  { id: 'stats', label: 'Statistics', icon: BarChart3 },
  { id: 'privacy', label: 'Privacy & reset', icon: Shield },
] as const;

const CLEAN_OPTIONS: Array<{ key: keyof CleanYouTubeOptions; label: string; hint: string }> = [
  { key: 'hideShorts', label: 'Hide Shorts', hint: 'Shelves, sidebar entry and tabs. Shorts links open in the normal player.' },
  { key: 'hideHomeFeed', label: 'Hide home feed', hint: 'The homepage shows a search-first message instead of recommendations.' },
  { key: 'hideSidebar', label: 'Hide recommendations', hint: 'Related videos beside the player and end-screen suggestions.' },
  { key: 'hideComments', label: 'Hide comments', hint: 'The comment section under videos.' },
  { key: 'hideAutoplay', label: 'Hide autoplay', hint: 'Autoplay toggle and "Up next" countdown, which is cancelled when shown.' },
];

function Section({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id={`${id}-title`} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SettingRow({ title, hint, control }: { title: string; hint: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-fg-subtle">{hint}</p>
      </div>
      {control}
    </div>
  );
}

export default function App() {
  const state = useFocusState();
  const settings = useSettings();
  const history = useHistory();
  const { run, pending, error, clearError } = useBackgroundAction();
  const [confirmReset, setConfirmReset] = useState(false);

  const session = state?.activeSession ?? null;
  const countdown = useCountdown(session, () => void run({ type: 'RECONCILE' }));
  const minute = Math.floor(countdown.now / 60_000);
  const stats = useMemo(() => (history ? computeStats(history, minute * 60_000, 14) : null), [history, minute]);
  const blockedCount = useMemo(() => (settings ? getBlockTargets(settings).length : 0), [settings]);

  useEffect(() => {
    if (!confirmReset) return;
    const id = window.setTimeout(() => setConfirmReset(false), 5000);
    return () => window.clearTimeout(id);
  }, [confirmReset]);

  if (!state || !settings) return <div className="min-h-screen bg-canvas" aria-busy="true" />;

  const strictLocked = session !== null && session.strictMode && (countdown.remaining ?? 1) > 0;
  const status: FocusStatus = !session ? 'idle' : strictLocked ? 'strict' : 'active';
  const youtubeSite = settings.sites.find((site) => site.domain === YOUTUBE_DOMAIN);
  const youtubeActive = youtubeSite !== undefined && isSiteActive(youtubeSite, settings);
  const categories: SiteCategory[] = [...BUILT_IN_CATEGORIES, 'custom'];

  return (
    <div className="min-h-screen bg-canvas bg-[radial-gradient(60%_40%_at_50%_0%,rgb(52_211_153/0.05),transparent)]">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-10 md:self-start">
          <StatusHeader status={status} showSettings={false} />
          <nav aria-label="Settings sections" className="mt-8 hidden flex-col gap-0.5 md:flex">
            {NAV.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-10">
          <div className="sticky top-4 z-10 empty:hidden">
            <ErrorBanner message={error} onDismiss={clearError} />
          </div>

          <Section id="session" title="Current session">
            <Card className="p-4">
              {session ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-[13px] text-fg-muted">
                        {strictLocked ? <Badge tone="warn"><Lock className="size-3" />Strict</Badge> : <Badge tone="accent">Active</Badge>}
                        {session.endsAt ? 'Timed session' : 'No time limit'}
                      </p>
                      <p className="tabular mt-1 text-[32px] font-semibold tracking-tight">
                        {session.endsAt ? formatClock(countdown.remaining ?? 0) : formatClock(countdown.elapsed)}
                        <span className="ml-2 text-[13px] font-normal text-fg-subtle">
                          {session.endsAt ? 'remaining' : 'elapsed'}
                        </span>
                      </p>
                      <p className="text-[12.5px] text-fg-muted">
                        {blockedCount} {blockedCount === 1 ? 'site' : 'sites'} blocked
                      </p>
                    </div>
                    {!strictLocked && (
                      <Button
                        variant="secondary"
                        loading={pending === 'END_SESSION'}
                        icon={<Square className="size-3.5" aria-hidden />}
                        onClick={() => void run({ type: 'END_SESSION' })}
                      >
                        End session
                      </Button>
                    )}
                  </div>
                  {strictLocked && (
                    <div className="flex flex-col gap-4 border-t border-line pt-4">
                      <StrictModeNotice compact />
                      <div>
                        <p className="mb-2 text-[13px] font-medium text-red-200">Emergency override</p>
                        <p className="mb-3 text-[12px] leading-relaxed text-fg-subtle">
                          For genuine emergencies only. Overridden sessions aren't counted as completed.
                        </p>
                        <EmergencyOverride
                          busy={pending === 'override'}
                          onConfirm={() => void run({ type: 'END_SESSION', emergencyOverride: true }, 'override')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-fg-muted">
                  No focus session running. Start one from the FocusGuard toolbar button.{' '}
                  <span className="text-fg-subtle">
                    {blockedCount} {blockedCount === 1 ? 'site' : 'sites'} will be blocked.
                  </span>
                </p>
              )}
            </Card>
          </Section>

          <Section
            id="websites"
            title="Blocked websites"
            description={
              strictLocked
                ? 'Strict Mode is on: you can add or switch on sites, but not unblock any until the session ends.'
                : 'Blocks the domain and all of its subdomains during focus sessions only.'
            }
            aside={<Badge tone="accent">{blockedCount} active</Badge>}
          >
            <div className="flex flex-col gap-3">
              {categories.map((category) => {
                const sites = settings.sites.filter((site) => site.category === category);
                return (
                  <CategoryCard
                    key={category}
                    variant="card"
                    category={category}
                    enabled={settings.categories[category].enabled}
                    count={countActiveSites(settings, category)}
                    onToggle={(enabled) => void run({ type: 'TOGGLE_CATEGORY', category, enabled }, `category:${category}`)}
                    disabled={pending === `category:${category}` || (strictLocked && settings.categories[category].enabled)}
                  >
                    <WebsiteList
                      sites={sites}
                      categoryEnabled={settings.categories[category].enabled}
                      youtubePolicy={settings.youtubePolicy}
                      emptyMessage="Add any site you find distracting."
                      lockEnabled={strictLocked}
                      onToggle={(site, enabled) => void run({ type: 'TOGGLE_SITE', siteId: site.id, enabled }, `site:${site.id}`)}
                      onRemove={(site) => void run({ type: 'REMOVE_SITE', siteId: site.id }, `site:${site.id}`)}
                    />
                    {category === 'custom' && (
                      <div className="border-t border-line">
                        <WebsiteInput onAdd={(input) => run({ type: 'ADD_CUSTOM_SITE', input }, 'add-site')} />
                      </div>
                    )}
                  </CategoryCard>
                );
              })}
            </div>
          </Section>

          <Section
            id="youtube"
            title="YouTube"
            description="YouTube mixes tutorials with entertainment. Choose how focus sessions treat it."
            aside={
              <Badge tone={!youtubeActive ? 'neutral' : settings.youtubePolicy === 'clean' ? 'accent' : 'neutral'}>
                {!youtubeActive ? 'Off in blocklist' : settings.youtubePolicy === 'clean' ? 'Clean YouTube' : 'Blocked'}
              </Badge>
            }
          >
            <div className="flex flex-col gap-3">
              <YouTubePolicySelector
                variant="detailed"
                value={settings.youtubePolicy}
                disabled={pending === 'youtube' || (strictLocked && settings.youtubePolicy === 'block')}
                onChange={(youtubePolicy) => void run({ type: 'UPDATE_SETTINGS', patch: { youtubePolicy } }, 'youtube')}
              />
              {!youtubeActive && (
                <p className="text-[12px] text-fg-subtle">
                  youtube.com is currently switched off under Entertainment, so neither policy applies.
                </p>
              )}
              <Card className={settings.youtubePolicy === 'clean' ? 'divide-y divide-line' : 'divide-y divide-line opacity-60'}>
                <p className="px-4 py-2.5 text-[11px] font-medium tracking-[0.08em] text-fg-subtle uppercase">
                  Clean YouTube options{settings.youtubePolicy !== 'clean' && ' · used when Clean YouTube is selected'}
                </p>
                {CLEAN_OPTIONS.map((option) => (
                  <SettingRow
                    key={option.key}
                    title={option.label}
                    hint={option.hint}
                    control={
                      <Switch
                        label={option.label}
                        checked={settings.cleanYouTube[option.key]}
                        disabled={pending === `clean:${option.key}`}
                        onChange={(value) =>
                          void run({ type: 'UPDATE_SETTINGS', patch: { cleanYouTube: { [option.key]: value } } }, `clean:${option.key}`)
                        }
                      />
                    }
                  />
                ))}
              </Card>
              <p className="text-[12px] text-fg-subtle">
                YouTube Music (music.youtube.com) is controlled separately under Music.
              </p>
            </div>
          </Section>

          <Section id="focus" title="Focus defaults">
            <Card className="divide-y divide-line">
              <div className="px-4 py-3">
                <p className="text-[13px] font-medium">Default session length</p>
                <p className="mt-0.5 mb-3 text-[12px] text-fg-subtle">Preselected in the popup.</p>
                <div className="max-w-md">
                  <DurationSelector
                    value={settings.defaultDuration}
                    customMinutes={settings.ui.lastCustomMinutes}
                    onChange={(duration, custom) =>
                      void run(
                        {
                          type: 'UPDATE_SETTINGS',
                          patch: custom ? { defaultDuration: duration, ui: { lastCustomMinutes: custom } } : { defaultDuration: duration },
                        },
                        'duration',
                      )
                    }
                  />
                </div>
              </div>
              <SettingRow
                title="Strict Mode"
                hint="Timed sessions can't be ended early from the popup, and sites can't be unblocked mid-session. Applies to the next session you start. It's a commitment device, not a lock: the extension itself can still be disabled from chrome://extensions."
                control={
                  <Switch
                    label="Strict Mode"
                    checked={settings.strictMode}
                    disabled={pending === 'strict'}
                    onChange={(strictMode) => void run({ type: 'UPDATE_SETTINGS', patch: { strictMode } }, 'strict')}
                  />
                }
              />
            </Card>
          </Section>

          <Section id="stats" title="Statistics" description="Only sessions that ran to completion are counted. Everything stays on this device.">
            {stats && (
              <div className="flex flex-col gap-3">
                <SessionStats stats={stats} showTotals />
                <Card className="p-4">
                  <FocusHistoryChart days={stats.daily} />
                </Card>
              </div>
            )}
          </Section>

          <Section id="privacy" title="Privacy & reset">
            <Card className="divide-y divide-line">
              <div className="px-4 py-3 text-[12.5px] leading-relaxed text-fg-muted">
                FocusGuard stores settings and session history only in this browser (
                <code className="font-mono text-[11.5px]">chrome.storage.local</code>). It doesn't record
                browsing history, read page content, or send data anywhere. It blocks websites in Chrome
                only, not native mobile or desktop apps.
              </div>
              <SettingRow
                title="Reset preferences"
                hint="Restores default sites, categories, YouTube and session settings. Removes custom sites. Statistics are kept."
                control={
                  <Button
                    variant={confirmReset ? 'danger' : 'secondary'}
                    loading={pending === 'RESET_SETTINGS'}
                    disabled={strictLocked}
                    title={strictLocked ? 'Unavailable during a Strict Mode session' : undefined}
                    icon={<RotateCcw className="size-3.5" aria-hidden />}
                    onClick={() => {
                      if (!confirmReset) {
                        setConfirmReset(true);
                        return;
                      }
                      setConfirmReset(false);
                      void run({ type: 'RESET_SETTINGS' });
                    }}
                  >
                    {confirmReset ? 'Click again to reset' : 'Reset'}
                  </Button>
                }
              />
            </Card>
          </Section>
        </main>
      </div>
    </div>
  );
}
