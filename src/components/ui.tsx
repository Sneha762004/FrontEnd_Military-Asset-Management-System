import type { ComponentType, SVGProps } from 'react';
import clsx from 'clsx';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export const badgeTone: Record<string, BadgeTone> = {
  // Documents
  COMPLETED: 'success',
  ACTIVE: 'success',
  POSTED: 'success',
  CONFIRMED: 'success',
  RETURNED: 'info',
  IN_TRANSIT: 'warning',
  DISPATCHED: 'warning',
  PARTIAL: 'warning',
  PARTIALLY_RETURNED: 'warning',
  PENDING: 'warning',
  DRAFT: 'neutral',
  // Terminal / problem states
  CANCELLED: 'danger',
  REVERSED: 'danger',
  EXPIRED: 'danger',
  FAILED: 'danger',
};

export function statusTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral';
  return badgeTone[status.toUpperCase()] ?? 'neutral';
}

/* ---------------------------------------------------------------- icons ---
 * Hand-rolled 24px stroke icons. A dependency-free icon set keeps the bundle
 * small and the visual language consistent; `currentColor` keeps them themeable.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, className, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-5 w-5'}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Dashboard: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  ),
  Cart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 3h2.2l2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L20 7H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </Svg>
  ),
  Transfer: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5" />
      <path d="M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5" />
    </Svg>
  ),
  Assign: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 8.5h5M19 6v5" />
    </Svg>
  ),
  Ledger: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 3.5h11l3.5 3.5v13.5H5z" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </Svg>
  ),
  Users: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 19.5a6 6 0 0 1 12 0" />
      <path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 14.4a5 5 0 0 1 4 5.1" />
    </Svg>
  ),
  Shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Svg>
  ),
  Alert: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.8l9 15.7H3z" />
      <path d="M12 9.5v4.2M12 16.8v.4" />
    </Svg>
  ),
  Info: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  ),
  Logout: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14.5 4.5h-8a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h8" />
      <path d="M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5" />
    </Svg>
  ),
  Filter: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 5.5h18l-7 8v5.5l-4 2v-7.5z" />
    </Svg>
  ),
  Refresh: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 11a8 8 0 1 0-.7 4.5" />
      <path d="M20 4.5V11h-6" />
    </Svg>
  ),
  Box: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l8 4v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </Svg>
  ),
  Trend: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 17l5.5-6 4 3.5L21 6" />
      <path d="M15.5 6H21v5.5" />
    </Svg>
  ),
  Menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  Building: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 21V5.5L13 3v18" />
      <path d="M13 9.5h7V21" />
      <path d="M7 8.5h2.5M7 12h2.5M7 15.5h2.5M16 13.5h1.5M16 17h1.5" />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
      <path d="M4 17.5v1.5A1.5 1.5 0 0 0 5.5 20.5h13a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </Svg>
  ),
  Eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  ),
  Lock: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.8" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Svg>
  ),
} satisfies Record<string, ComponentType<IconProps>>;

export type IconName = keyof typeof Icon;

export { clsx as cx };
