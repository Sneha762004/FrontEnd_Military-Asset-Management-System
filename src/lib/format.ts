const NBSP = '\u00a0';

/** Thousands-separated integer. Quantities are whole units in this system. */
export function qty(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US');
}

/** Signed quantity, for ledger deltas where direction matters. */
export function signedQty(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(value).toLocaleString('en-US')}`;
}

export function money(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `2026-03-14T00:00:00Z` -> `14 Mar 2026`, with today's date rendered as "Today". */
export function date(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const today = new Date();
  const sameDay =
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate();
  if (sameDay) return 'Today';
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${parsed.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

/** `2026-03` -> `Mar 2026`. */
export function month(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthsAgo(count: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - count);
  return d.toISOString().slice(0, 7);
}

/** Today + n days as `YYYY-MM-DD`, used for assignment due dates. */
export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '-';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value;
  const seconds = Math.round((Date.now() - then) / 1000);
  // Largest unit whose span still fits the elapsed time, then divide by that
  // unit's own length - not by the next threshold, which would round 30s to 0.
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1],
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];
  const elapsed = Math.abs(seconds);
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0]!;
  for (const unit of units) {
    if (elapsed >= unit[1]) chosen = unit;
  }
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    -Math.round(seconds / chosen[1]),
    chosen[0],
  );
}

export const NBSP_CHAR = NBSP;

/** Tolerant pluralisation: `1 asset` / `2 assets`, without a full i18n layer. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${qty(count)}${NBSP}${count === 1 ? singular : pluralForm}`;
}

/** Title-cases SNAKE_CASE enums coming straight from the database. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function initials(value: string | null | undefined): string {
  if (!value) return '?';
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
