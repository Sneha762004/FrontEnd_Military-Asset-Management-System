import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from './ui';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Right-aligned, monospaced and tabular by default - use for numbers. */
  numeric?: boolean;
  width?: string;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable server-side. */
  sortKey?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  sort?: { key: string; order: 'asc' | 'desc' };
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  /** Renders inside the scroll container above the header, e.g. a toolbar. */
  toolbar?: ReactNode;
  footer?: ReactNode;
  /** Caps visible rows and adds a "show all" affordance. */
  maxHeight?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  empty,
  sort,
  onSortChange,
  onRowClick,
  toolbar,
  footer,
  maxHeight,
}: DataTableProps<T>) {
  // Skeleton rows keep the table from collapsing while a page loads.
  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  if (loading && rows.length === 0) {
    return (
      <div className={maxHeight ? 'overflow-auto' : undefined} style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ink-700/70">
              {columns.map((col) => (
                <th key={col.key} className="th" style={col.width ? { width: col.width } : undefined}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skeletonRows.map((rowIndex) => (
              <tr key={rowIndex} className="border-b border-ink-800/60">
                {columns.map((col) => (
                  <td key={col.key} className="td">
                    <div className="skeleton h-3.5 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {toolbar ? <div className="border-b border-ink-700/70 px-4 py-3">{toolbar}</div> : null}
      <div className={clsx('overflow-x-auto', maxHeight && 'overflow-y-auto')} style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
            <tr className="border-b border-ink-700/70">
              {columns.map((col) => {
                const active = sort?.key === col.sortKey;
                const sortable = Boolean(col.sortKey && onSortChange);
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={clsx('th', col.numeric && 'text-right', sortable && 'cursor-pointer select-none hover:text-ink-100')}
                    aria-sort={active ? (sort?.order === 'asc' ? 'ascending' : 'descending') : undefined}
                    onClick={sortable ? () => onSortChange?.(col.sortKey as string) : undefined}
                  >
                    <span className={clsx('inline-flex items-center gap-1', col.numeric && 'flex-row-reverse')}>
                      {col.header}
                      {sortable ? (
                        <Icon.Chevron
                          className={clsx(
                            'h-3.5 w-3.5 transition-transform',
                            active ? 'opacity-100' : 'opacity-25',
                            active && sort?.order === 'asc' && 'rotate-[-90deg]',
                            active && sort?.order === 'desc' && 'rotate-90',
                          )}
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  {empty ?? <EmptyState title="Nothing to show" description="No records match the current filters." />}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    'border-b border-ink-800/60 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-ink-800/40',
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={clsx('td', col.numeric && 'num text-right')}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-ink-700/70 px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="mb-1 rounded-full bg-ink-800 p-3 text-ink-400">{icon ?? <Icon.Box className="h-6 w-6" />}</div>
      <p className="text-sm font-medium text-ink-200">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-400">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Client-side pager for endpoints that return the full page slice. */
export function Pager({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return <span className="text-xs text-ink-400">{total.toLocaleString('en-US')} record{total === 1 ? '' : 's'}</span>;
  }
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-xs text-ink-400">
        Page {page} of {pageCount} &middot; {total.toLocaleString('en-US')} records
      </span>
      <div className="flex gap-1.5">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary btn-sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Debounced free-text input, so typing does not fire a request per keystroke. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  delay = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<number | null>(null);

  // Re-sync when the parent resets the filter externally.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Clear the pending timer on unmount so a late write cannot hit a dead page.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const update = (next: string) => {
    setDraft(next);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onChange(next), delay);
  };

  return (
    <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
      <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        className="input pl-9"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => update(event.target.value)}
        aria-label={placeholder}
      />
      {draft ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-100"
          onClick={() => update('')}
          aria-label="Clear search"
        >
          <Icon.Close className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
