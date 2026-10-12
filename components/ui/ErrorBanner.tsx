import { AlertTriangle, X } from 'lucide-react';

export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] text-red-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <p className="flex-1 leading-snug">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="-mr-1 cursor-pointer rounded p-0.5 text-red-300/70 hover:text-red-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
