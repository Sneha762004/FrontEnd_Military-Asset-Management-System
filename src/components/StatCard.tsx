import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from './ui';
import { qty } from '../lib/format';

type Accent = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

const accents: Record<Accent, { text: string; ring: string; icon: string }> = {
  neutral: { text: 'text-ink-100', ring: 'ring-ink-700/70', icon: 'bg-ink-800 text-ink-300' },
  positive: { text: 'text-emerald-300', ring: 'ring-emerald-500/20', icon: 'bg-emerald-500/10 text-emerald-400' },
  negative: { text: 'text-rose-300', ring: 'ring-rose-500/20', icon: 'bg-rose-500/10 text-rose-400' },
  warning: { text: 'text-amber-300', ring: 'ring-amber-500/20', icon: 'bg-amber-500/10 text-amber-400' },
  info: { text: 'text-accent-400', ring: 'ring-accent-500/20', icon: 'bg-accent-500/10 text-accent-400' },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ label, value, unit, hint, icon, accent = 'neutral', onClick, className }: StatCardProps) {
  const tone = accents[accent];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'card group p-4 text-left transition',
        onClick && 'cursor-pointer hover:border-accent-500/50 hover:shadow-lift',
        tone.ring,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
          <p className={clsx('mt-1.5 flex items-baseline gap-1.5 font-mono text-2xl font-semibold tabular-nums', tone.text)}>
            {value}
            {unit ? <span className="text-xs font-normal text-ink-400">{unit}</span> : null}
          </p>
          {hint ? <div className="mt-1 truncate text-[0.7rem] text-ink-400">{hint}</div> : null}
        </div>
        {icon ? <div className={clsx('shrink-0 rounded-lg p-2', tone.icon)}>{icon}</div> : null}
      </div>
    </Tag>
  );
}

/**
 * The balance walk-down. This is the piece of the brief that matters most, so
 * it is always visible rather than hidden behind a chart: opening, the four
 * movement lines, the identity, then expended and assigned on top.
 */
export function BalanceWalkDown({
  opening,
  purchases,
  transferIn,
  transferOut,
  expended,
  assigned,
  closing,
  available,
  unit = 'units',
  onNetMovementClick,
}: {
  opening: number;
  purchases: number;
  transferIn: number;
  transferOut: number;
  expended: number;
  assigned: number;
  closing: number;
  available: number;
  unit?: string;
  onNetMovementClick?: () => void;
}) {
  const net = purchases + transferIn - transferOut;
  const derivedClosing = opening + net - expended;
  // Flag rather than hide a broken identity - silent rounding or a bad filter
  // must not read as a correct number.
  const balances = derivedClosing === closing;

  const Line = ({ label, value, tone = 'neutral', strong = false, hint }: { label: string; value: number; tone?: Accent; strong?: boolean; hint?: string }) => (
    <div className={clsx('flex items-baseline justify-between gap-4 py-1.5', strong && 'border-t border-ink-700/70 pt-2.5')}>
      <span className={clsx('text-sm', strong ? 'font-medium text-ink-200' : 'text-ink-400')}>
        {label}
        {hint ? <span className="ml-1.5 text-[0.7rem] text-ink-500">{hint}</span> : null}
      </span>
      <span className={clsx('num text-sm tabular-nums', accents[tone].text, strong && 'font-semibold')}>
        {value > 0 && !strong ? '+' : ''}
        {qty(value)}
      </span>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Balance walk-down</h3>
        <span className={clsx('badge', balances ? 'badge-success' : 'badge-danger')}>
          {balances ? <Icon.Check className="h-3 w-3" /> : <Icon.Alert className="h-3 w-3" />}
          {balances ? 'Identity holds' : 'Out of balance'}
        </span>
      </div>
      <div className="p-4">
        <Line label="Opening balance" value={opening} />
        <div className="my-1 border-t border-dashed border-ink-700/60" />
        <Line label="Purchases" value={purchases} tone="positive" />
        <Line label="Transfers in" value={transferIn} tone="positive" />
        <Line label="Transfers out" value={-transferOut} tone="negative" />
        <button
          type="button"
          onClick={onNetMovementClick}
          disabled={!onNetMovementClick}
          className={clsx(
            'my-1 flex w-full items-baseline justify-between gap-4 border-y border-dashed border-ink-700/60 py-2',
            onNetMovementClick && 'rounded px-1 transition hover:bg-ink-800/40',
          )}
          title={onNetMovementClick ? 'Show the transactions behind net movement' : undefined}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-accent-400">
            Net movement
            {onNetMovementClick ? <Icon.Eye className="h-3.5 w-3.5 opacity-70" /> : null}
          </span>
          <span className="num text-sm font-semibold tabular-nums text-accent-400">
            {net > 0 ? '+' : ''}
            {qty(net)}
          </span>
        </button>
        <Line label="Expended" value={-expended} tone="negative" />
        <Line label={`Closing balance (${unit})`} value={closing} strong />
        <div className="mt-3 rounded-lg bg-ink-900/60 p-3">
          <Line label="Assigned to personnel" value={assigned} tone="warning" hint="committed, still on the books" />
          <Line label="Available" value={available} tone={available > 0 ? 'info' : 'neutral'} strong />
        </div>
        <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-500">
          Closing = Opening + (Purchases + Transfers in &minus; Transfers out) &minus; Expended.
          Available = Closing &minus; Assigned. Assigned assets remain part of the base&rsquo;s holdings; they are
          simply not free to re-issue or transfer.
        </p>
      </div>
    </div>
  );
}

export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5; className?: string }) {
  const map = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  } as const;
  return <div className={clsx('grid gap-3', map[cols], className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink-100">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
