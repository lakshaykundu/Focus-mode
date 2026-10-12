import { ShieldOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export const OVERRIDE_PHRASE = 'end my focus session';
const HOLD_MS = 5000;

/**
 * Deliberate friction for ending a Strict Mode session: type a phrase, then press and hold for
 * five seconds. It's a speed bump against impulse, not a security boundary.
 */
export function EmergencyOverride({ onConfirm, busy }: { onConfirm: () => void; busy?: boolean }) {
  const [phrase, setPhrase] = useState('');
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const armed = phrase.trim().toLowerCase() === OVERRIDE_PHRASE;

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    startedAt.current = null;
    setProgress(0);
  };

  const start = () => {
    if (!armed || busy || frame.current !== null) return;
    startedAt.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - (startedAt.current ?? performance.now());
      const p = Math.min(1, elapsed / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        frame.current = null;
        startedAt.current = null;
        onConfirm();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (
    <div className="space-y-3">
      <label className="block text-[12.5px] text-fg-muted">
        Type <span className="font-mono text-fg">{OVERRIDE_PHRASE}</span> to unlock the override:
        <input
          type="text"
          value={phrase}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPhrase(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          className="mt-1.5 block h-9 w-full max-w-sm rounded-lg border border-line-strong bg-black/30 px-3 font-mono text-[13px] text-fg outline-none focus:border-danger/50"
        />
      </label>
      <button
        type="button"
        disabled={!armed || busy}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onKeyDown={(event) => {
          if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            event.preventDefault();
            start();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') stop();
        }}
        className={cn(
          'relative inline-flex h-10 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border px-4 text-[13px] font-medium transition-colors select-none',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'border-danger/30 bg-danger-soft text-red-200',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-danger/30"
          style={{ width: `${progress * 100}%` }}
        />
        <ShieldOff className="relative size-4" aria-hidden />
        <span className="relative">
          {progress > 0 ? `Keep holding… ${Math.ceil((1 - progress) * (HOLD_MS / 1000))}s` : 'Hold to end session'}
        </span>
      </button>
    </div>
  );
}
