import { Plus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { normalizeDomain } from '@/lib/domainUtils';
import { cn } from '@/lib/cn';
import type { FocusResponse } from '@/types/messages';
import { Button } from './ui/Button';

interface WebsiteInputProps {
  onAdd: (input: string) => Promise<FocusResponse>;
  disabled?: boolean;
}

export function WebsiteInput({ onAdd, disabled }: WebsiteInputProps) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = value.trim() ? normalizeDomain(value) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDomain(value);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }
    setBusy(true);
    const response = await onAdd(value);
    setBusy(false);
    if (response.ok) {
      setValue('');
      setError(null);
      setAdded(normalized.domain);
    } else {
      setError(response.error);
    }
  };

  const hint = error
    ? error
    : preview?.ok
      ? `Blocks ${preview.domain} and all of its subdomains`
      : added
        ? `Added ${added}`
        : 'Paste a URL or type a domain, e.g. news.ycombinator.com';

  return (
    <form onSubmit={submit} className="p-4" noValidate>
      <label htmlFor={id} className="sr-only">
        Website to block
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="example.com"
          value={value}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
            setAdded(null);
          }}
          className={cn(
            'h-9 flex-1 rounded-lg border bg-black/30 px-3 font-mono text-[13px] text-fg outline-none transition-colors placeholder:text-fg-subtle',
            'focus:border-accent/50 disabled:opacity-50',
            error ? 'border-danger/50' : 'border-line-strong',
          )}
        />
        <Button type="submit" variant="secondary" loading={busy} disabled={disabled || !value.trim()} icon={<Plus className="size-4" />}>
          Add
        </Button>
      </div>
      <p
        id={`${id}-hint`}
        aria-live="polite"
        className={cn('mt-1.5 text-[11.5px]', error ? 'text-danger' : added && !preview ? 'text-accent' : 'text-fg-subtle')}
      >
        {hint}
      </p>
    </form>
  );
}
