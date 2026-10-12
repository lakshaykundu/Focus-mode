import { ArrowUpRight, Lock, Play, Square } from 'lucide-react';
import { useMemo } from 'react';
import { browser } from 'wxt/browser';
import { CategoryCard } from '@/components/CategoryCard';
import { DurationSelector } from '@/components/DurationSelector';
import { FocusTimer } from '@/components/FocusTimer';
import { SessionStats } from '@/components/SessionStats';
import { StatusHeader, type FocusStatus } from '@/components/StatusHeader';
import { StrictModeNotice } from '@/components/StrictModeNotice';
import { YouTubePolicySelector } from '@/components/YouTubePolicySelector';
import { Button } from '@/components/ui/Button';
import { Card, SectionLabel } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Switch } from '@/components/ui/Switch';
import { useBackgroundAction } from '@/hooks/useBackgroundAction';
import { useCountdown } from '@/hooks/useCountdown';
import { useFocusState, useHistory, useSettings } from '@/hooks/useFocusData';
import { countActiveSites, getBlockTargets, isSiteActive } from '@/lib/blockList';
import { BUILT_IN_CATEGORIES, YOUTUBE_DOMAIN } from '@/lib/siteRegistry';
import { computeStats } from '@/lib/statistics';
import { formatMinutes } from '@/lib/timer';
import type { SiteCategory } from '@/types/settings';

export default function App() {
  const state = useFocusState();
  const settings = useSettings();
  const history = useHistory();
  const { run, pending, error, clearError } = useBackgroundAction();

  const session = state?.activeSession ?? null;
  // When the countdown hits zero, ask the worker to settle now instead of waiting for the alarm.
  const countdown = useCountdown(session, () => void run({ type: 'RECONCILE' }));

  // Recompute once a minute (enough to catch midnight), not on every countdown tick.
  const minute = Math.floor(countdown.now / 60_000);
  const stats = useMemo(
    () => (history ? computeStats(history, minute * 60_000, 1) : null),
    [history, minute],
  );
  const blockedCount = useMemo(() => (settings ? getBlockTargets(settings).length : 0), [settings]);

  if (!state || !settings) {
    return <div className="h-[420px] w-[380px] bg-canvas" aria-busy="true" />;
  }

  const strictLocked = session !== null && session.strictMode && (countdown.remaining ?? 1) > 0;
  const status: FocusStatus = !session ? 'idle' : strictLocked ? 'strict' : 'active';
  const timedSelection = settings.defaultDuration !== 'indefinite';
  const youtubeSite = settings.sites.find((site) => site.domain === YOUTUBE_DOMAIN);
  const youtubeActive = youtubeSite !== undefined && isSiteActive(youtubeSite, settings);
  const nothingToDo = blockedCount === 0 && !(youtubeActive && settings.youtubePolicy === 'clean');
  const customCategoryHasSites = settings.sites.some((site) => site.category === 'custom');
  const categories: SiteCategory[] = [...BUILT_IN_CATEGORIES, ...(customCategoryHasSites ? (['custom'] as const) : [])];

  return (
    <div className="flex max-h-[600px] w-[380px] flex-col gap-4 overflow-y-auto bg-canvas p-4">
      <StatusHeader status={status} />

      <Card
        className={
          session
            ? strictLocked
              ? 'border-warn/20 bg-[radial-gradient(120%_80%_at_50%_0%,rgb(251_191_36/0.07),transparent_60%)] p-4'
              : 'border-accent/15 bg-[radial-gradient(120%_80%_at_50%_0%,rgb(52_211_153/0.08),transparent_60%)] p-4'
            : 'p-4'
        }
      >
        {session ? (
          <div className="flex flex-col gap-4">
            <FocusTimer session={session} countdown={countdown} strict={strictLocked} />
            <p className="text-center text-[12.5px] text-fg-muted">
              <span className="tabular font-medium text-fg">{blockedCount}</span> distracting{' '}
              {blockedCount === 1 ? 'site is' : 'sites are'} blocked
              {youtubeActive && settings.youtubePolicy === 'clean' && ' · YouTube is in clean mode'}
            </p>
            {strictLocked ? (
              <StrictModeNotice />
            ) : (
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                loading={pending === 'END_SESSION'}
                icon={<Square className="size-3.5" aria-hidden />}
                onClick={() => void run({ type: 'END_SESSION' })}
              >
                End session
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[18px] font-semibold tracking-tight">Ready to focus</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">
                <span className="tabular">{blockedCount}</span> {blockedCount === 1 ? 'site' : 'sites'} will be
                blocked
                {settings.defaultDuration === 'indefinite'
                  ? ' until you stop.'
                  : ` for ${formatMinutes(settings.defaultDuration)}.`}
              </p>
            </div>
            <DurationSelector
              value={settings.defaultDuration}
              customMinutes={settings.ui.lastCustomMinutes}
              disabled={pending === 'START_SESSION'}
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
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-fg-subtle" aria-hidden />
                <div>
                  <p className="text-[12.5px] font-medium">Strict Mode</p>
                  <p className="text-[11px] text-fg-subtle">
                    {timedSelection ? 'No ending early from the popup' : 'Only applies to timed sessions'}
                  </p>
                </div>
              </div>
              <Switch
                size="sm"
                label="Strict Mode"
                checked={settings.strictMode && timedSelection}
                disabled={!timedSelection}
                onChange={(strictMode) => void run({ type: 'UPDATE_SETTINGS', patch: { strictMode } }, 'strict')}
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={pending === 'START_SESSION'}
              disabled={nothingToDo}
              icon={<Play className="size-4 fill-current" aria-hidden />}
              onClick={() => void run({ type: 'START_SESSION', duration: settings.defaultDuration })}
            >
              Start Focusing
            </Button>
          </div>
        )}
      </Card>

      <ErrorBanner message={error} onDismiss={clearError} />

      <section className="flex flex-col gap-2" aria-labelledby="categories-label">
        <SectionLabel>
          <span id="categories-label">Blocked categories</span>
        </SectionLabel>
        <Card className="divide-y divide-line">
          {categories.map((category) => (
            <CategoryCard
              key={category}
              category={category}
              enabled={settings.categories[category].enabled}
              count={countActiveSites(settings, category)}
              disabled={pending === `category:${category}` || (strictLocked && settings.categories[category].enabled)}
              onToggle={(enabled) => void run({ type: 'TOGGLE_CATEGORY', category, enabled }, `category:${category}`)}
            />
          ))}
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div>
              <p className="text-[13px] font-medium">YouTube</p>
              <p className="text-[11px] text-fg-subtle">
                {!youtubeActive
                  ? 'Off in your blocklist'
                  : settings.youtubePolicy === 'clean'
                    ? 'Usable, distractions hidden'
                    : 'Blocked entirely'}
              </p>
            </div>
            <YouTubePolicySelector
              value={settings.youtubePolicy}
              disabled={pending === 'youtube' || (strictLocked && settings.youtubePolicy === 'block')}
              onChange={(youtubePolicy) => void run({ type: 'UPDATE_SETTINGS', patch: { youtubePolicy } }, 'youtube')}
            />
          </div>
        </Card>
      </section>

      {stats && (
        <section className="flex flex-col gap-2" aria-label="Today">
          <SectionLabel>Today</SectionLabel>
          <SessionStats stats={stats} />
        </section>
      )}

      <footer className="flex justify-center border-t border-line pt-3">
        <button
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] text-fg-muted transition-colors hover:text-fg"
        >
          Open full settings <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
      </footer>
    </div>
  );
}
