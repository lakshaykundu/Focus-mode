import { Lock, Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Logo } from './Logo';
import { StatusDot } from './ui/Badge';

export type FocusStatus = 'idle' | 'active' | 'strict';

const LABELS: Record<FocusStatus, string> = {
  idle: 'Not focusing',
  active: 'Focus mode on',
  strict: 'Strict focus',
};

export function StatusHeader({ status, showSettings = true }: { status: FocusStatus; showSettings?: boolean }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Logo />
        <div className="leading-tight">
          <p className="text-[14px] font-semibold tracking-tight">FocusGuard</p>
          <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle" aria-live="polite">
            <StatusDot active={status !== 'idle'} tone={status === 'strict' ? 'warn' : 'accent'} />
            {LABELS[status]}
            {status === 'strict' && <Lock className="size-3 text-warn" aria-hidden />}
          </p>
        </div>
      </div>
      {showSettings && (
        <button
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
          aria-label="Open settings"
          title="Settings"
          className="cursor-pointer rounded-lg p-2 text-fg-subtle transition-colors hover:bg-white/[0.05] hover:text-fg"
        >
          <Settings className="size-4" />
        </button>
      )}
    </header>
  );
}
