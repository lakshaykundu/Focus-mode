import { Infinity as InfinityIcon } from 'lucide-react';
import { formatClock } from '@/lib/timer';
import { cn } from '@/lib/cn';
import type { Countdown } from '@/hooks/useCountdown';
import type { FocusSession } from '@/types/focus';

interface FocusTimerProps {
  session: FocusSession;
  countdown: Countdown;
  strict?: boolean;
}

const SIZE = 168;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Progress ring with the remaining time (timed) or elapsed time (indefinite). */
export function FocusTimer({ session, countdown, strict }: FocusTimerProps) {
  const timed = session.endsAt !== null;
  const clock = timed ? formatClock(countdown.remaining ?? 0) : formatClock(countdown.elapsed);
  const endsAt = session.endsAt
    ? new Date(session.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="relative mx-auto grid size-[168px] place-items-center">
      <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth={STROKE} />
        {timed && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={strict ? '#fbbf24' : '#34d399'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * countdown.progress}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        )}
      </svg>
      <div className="relative text-center">
        <p
          className={cn('tabular font-semibold tracking-tight', clock.length > 5 ? 'text-[30px]' : 'text-[38px]')}
          role="timer"
          aria-label={timed ? `${clock} remaining` : `${clock} elapsed`}
        >
          {clock}
        </p>
        <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-fg-subtle">
          {timed ? (
            <>remaining · ends {endsAt}</>
          ) : (
            <>
              <InfinityIcon className="size-3" aria-hidden /> elapsed
            </>
          )}
        </p>
      </div>
    </div>
  );
}
