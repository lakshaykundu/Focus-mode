import { CheckCircle2, Clock3 } from 'lucide-react';
import { formatMinutes } from '@/lib/timer';
import type { FocusStats } from '@/lib/statistics';

interface StatTileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatTile({ label, value, icon }: StatTileProps) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
      <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 text-[20px] leading-none font-semibold tracking-tight">{value}</p>
    </div>
  );
}

/** Today's numbers from completed sessions only; optionally lifetime totals too. */
export function SessionStats({ stats, showTotals = false }: { stats: FocusStats; showTotals?: boolean }) {
  const clock = <Clock3 className="size-3" aria-hidden />;
  const check = <CheckCircle2 className="size-3" aria-hidden />;
  return (
    <div className={showTotals ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'grid grid-cols-2 gap-2'}>
      <StatTile label="Focus time today" value={formatMinutes(stats.today.minutes)} icon={clock} />
      <StatTile label="Sessions today" value={String(stats.today.sessions)} icon={check} />
      {showTotals && (
        <>
          <StatTile label="Total focus time" value={formatMinutes(stats.total.minutes)} icon={clock} />
          <StatTile label="Total sessions" value={String(stats.total.sessions)} icon={check} />
        </>
      )}
    </div>
  );
}
