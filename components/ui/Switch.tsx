import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/** Accessible toggle: a real button with `role="switch"`, operable by Space/Enter. */
export function Switch({ checked, onChange, label, disabled, size = 'md' }: SwitchProps) {
  const sm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-40',
        sm ? 'h-[18px] w-8' : 'h-[22px] w-10',
        checked ? 'border-accent/40 bg-accent-strong' : 'border-line-strong bg-white/[0.06]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block rounded-full bg-white shadow-sm transition-transform duration-200',
          sm ? 'size-3' : 'size-4',
          checked ? (sm ? 'translate-x-[15px]' : 'translate-x-[20px]') : 'translate-x-[2px]',
          !checked && 'bg-zinc-300',
        )}
      />
    </button>
  );
}
