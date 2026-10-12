import { useState } from 'react';
import { formatMinutes } from '@/lib/timer';
import type { DayStats } from '@/lib/statistics';

const CHART_HEIGHT = 96;

const dayLabel = (date: number, opts: Intl.DateTimeFormatOptions) =>
  new Date(date).toLocaleDateString([], opts);

/**
 * Completed focus minutes per local day. One series in the accent hue, so no legend; bars are
 * anchored to the baseline with rounded data ends, a 2px gap, a per-bar hover/focus tooltip,
 * and a visually hidden table for screen readers.
 */
export function FocusHistoryChart({ days }: { days: DayStats[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const peak = Math.max(0, ...days.map((d) => d.minutes));
  const max = Math.max(30, peak);
  const active = hovered !== null ? days[hovered] : undefined;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] font-medium">Completed focus, last {days.length} days</span>
        <span className="tabular min-h-4 text-[12px] text-fg-muted" aria-hidden>
          {active
            ? `${dayLabel(active.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatMinutes(active.minutes)} · ${active.sessions} session${active.sessions === 1 ? '' : 's'}`
            : `Best day ${formatMinutes(peak)}`}
        </span>
      </figcaption>

      <div className="relative" aria-hidden>
        {peak === 0 && (
          <p className="absolute inset-x-0 top-1/3 text-center text-[12px] text-fg-subtle">
            No completed sessions in the last {days.length} days yet.
          </p>
        )}
        {/* Recessive guide at the top of the scale. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <div className="flex items-end gap-[2px]" style={{ height: CHART_HEIGHT }} onMouseLeave={() => setHovered(null)}>
          {days.map((day, index) => {
            const h = day.minutes === 0 ? 0 : Math.max(3, (day.minutes / max) * CHART_HEIGHT);
            const isToday = index === days.length - 1;
            return (
              <div
                key={day.dayKey}
                className="flex h-full flex-1 cursor-default items-end"
                onMouseEnter={() => setHovered(index)}
              >
                <div
                  className="w-full rounded-t-[4px] transition-opacity duration-150"
                  style={{
                    height: h,
                    background: isToday ? '#34d399' : 'rgb(52 211 153 / 0.55)',
                    opacity: hovered === null || hovered === index ? 1 : 0.45,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 border-t border-line" />
        <div className="mt-1 flex justify-between text-[10.5px] text-fg-subtle">
          <span>{days[0] ? dayLabel(days[0].date, { month: 'short', day: 'numeric' }) : ''}</span>
          <span>Today</span>
        </div>
      </div>

      <table className="sr-only">
        <caption>Completed focus minutes per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
            <th scope="col">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.dayKey}>
              <th scope="row">{dayLabel(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}</th>
              <td>{day.minutes}</td>
              <td>{day.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
