import { useEffect, useState } from 'react';
import { PRESET_DURATIONS, validateDuration, MAX_CUSTOM_MINUTES, MIN_CUSTOM_MINUTES } from '@/lib/timer';
import { cn } from '@/lib/cn';
import type { SessionDuration } from '@/types/settings';

interface DurationSelectorProps {
  value: SessionDuration;
  customMinutes: number;
  /** Called with a valid duration. `custom` is set when the value came from the custom input. */
  onChange: (duration: SessionDuration, custom?: number) => void;
  disabled?: boolean;
}

const isPreset = (value: SessionDuration) =>
  typeof value === 'number' && (PRESET_DURATIONS as readonly number[]).includes(value);

export function DurationSelector({ value, customMinutes, onChange, disabled }: DurationSelectorProps) {
  const valueIsCustom = typeof value === 'number' && !isPreset(value);
  const [customOpen, setCustomOpen] = useState(valueIsCustom);
  const [text, setText] = useState(String(valueIsCustom ? value : customMinutes));
  const [error, setError] = useState<string | null>(null);

  // Follow external changes (e.g. the settings page changed the default).
  useEffect(() => {
    if (typeof value === 'number' && !isPreset(value)) {
      setCustomOpen(true);
      setText(String(value));
    }
  }, [value]);

  const selected = customOpen ? 'custom' : value === 'indefinite' ? 'indefinite' : String(value);

  const commitCustom = () => {
    const result = validateDuration(text);
    if (!result.ok || result.duration === 'indefinite') {
      setError(result.ok ? 'Enter a number of minutes' : result.error);
      return;
    }
    setError(null);
    if (result.duration !== value) onChange(result.duration, result.duration);
  };

  const options: Array<{ key: string; label: string; aria: string; select: () => void }> = [
    ...PRESET_DURATIONS.map((minutes) => ({
      key: String(minutes),
      label: `${minutes}m`,
      aria: `${minutes} minutes`,
      select: () => {
        setCustomOpen(false);
        setError(null);
        onChange(minutes);
      },
    })),
    {
      key: 'custom',
      label: 'Custom',
      aria: 'Custom duration',
      select: () => {
        setCustomOpen(true);
        const result = validateDuration(text);
        if (result.ok && typeof result.duration === 'number') onChange(result.duration, result.duration);
      },
    },
    {
      key: 'indefinite',
      label: '∞',
      aria: 'No time limit',
      select: () => {
        setCustomOpen(false);
        setError(null);
        onChange('indefinite');
      },
    },
  ];

  return (
    <div>
      <div role="radiogroup" aria-label="Session length" className="grid grid-cols-6 gap-1">
        {options.map((option) => {
          const active = selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.aria}
              title={option.aria}
              disabled={disabled}
              onClick={option.select}
              className={cn(
                'h-8 cursor-pointer rounded-lg border text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                option.key === 'custom' && 'col-span-1 px-0 text-[11px]',
                active
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-line bg-white/[0.02] text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {customOpen && (
        <div className="mt-2">
          <label className="flex items-center gap-2 text-[12px] text-fg-muted">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_CUSTOM_MINUTES}
              max={MAX_CUSTOM_MINUTES}
              step={1}
              value={text}
              disabled={disabled}
              aria-invalid={error !== null}
              aria-describedby={error ? 'duration-error' : undefined}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              onBlur={commitCustom}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitCustom();
              }}
              className={cn(
                'tabular h-8 w-20 rounded-lg border bg-black/30 px-2.5 text-[13px] text-fg outline-none transition-colors',
                'focus:border-accent/50 [&::-webkit-inner-spin-button]:appearance-none',
                error ? 'border-danger/50' : 'border-line-strong',
              )}
            />
            minutes ({MIN_CUSTOM_MINUTES}–{MAX_CUSTOM_MINUTES})
          </label>
          {error && (
            <p id="duration-error" className="mt-1 text-[11px] text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
