import { Lock } from 'lucide-react';

export function StrictModeNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warn/20 bg-warn-soft px-3 py-2.5">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
      <p className="text-[12px] leading-snug text-amber-100/90">
        <span className="font-medium text-warn">Strict Mode.</span> This session ends when the timer
        does. Sites can be added, not unblocked.
        {!compact && ' An emergency override is available in settings.'}
      </p>
    </div>
  );
}
