import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Radio-group semantics with roving focus: arrow keys move and select. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
      : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex rounded-lg border border-line bg-black/30 p-0.5',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-8 px-3 text-[13px]',
              selected
                ? 'bg-white/[0.09] text-fg shadow-[0_1px_2px_rgb(0_0_0/0.4)]'
                : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
