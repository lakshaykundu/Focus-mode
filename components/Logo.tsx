import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="fg-logo-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="#141416" stroke="rgb(255 255 255 / 0.1)" strokeWidth="2" />
      <path
        d="M256 92 L380 140 V246 C380 330 326 392 256 420 C186 392 132 330 132 246 V140 Z"
        fill="none"
        stroke="url(#fg-logo-ring)"
        strokeWidth="30"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="250" r="46" fill="url(#fg-logo-ring)" />
    </svg>
  );
}
