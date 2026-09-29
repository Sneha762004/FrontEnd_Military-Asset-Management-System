import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, metaOf, rowsOf } from '../lib/api';
import { PageHeader, StatGrid, StatCard } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { Icon } from '../components/ui';
import { dateTime, humanise, qty, relativeTime } from '../lib/format';
import type { AuditActivity, AuditLog } from '../types';

const OUTCOME_TONE: Record<string, string> = {
  SUCCESS: 'badge-success',
  DENIED: 'badge-warning',
  FAILURE: 'badge-danger',
};

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [actor, setActor] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const query = { page, pageSize, search, action: action || null, outcome: outcome || null, actor: actor || null, statusCode: statusCode || null };

  const list = useQuery({
    queryKey: ['audit', query],
    queryFn: () => api.get<AuditLog[]>('/audit-logs', query),
    placeholderData: (previous) => previous,
  });

  // The list response carries no counts of its own, so the headline figures come
  // from the 30-day activity endpoint rather than from the page being viewed.
  const activity = useQuery({
    queryKey: ['audit', 'summary'],
    queryFn: () => api.get<AuditActivity[]>('/audit-logs/summary'),
    staleTime: 30_000,
  });

  const meta = metaOf(list);
  const totals = rowsOf(activity).reduce(
    (acc, row) => ({ ...acc, [row.outcome]: (acc[row.outcome] ?? 0) + row.events }),
    {} as Record<string, number>,
  );
  const availableActions = (meta.actions ?? []) as { value: string; count: number }[];

  const columns: Column<AuditLog>[] = [
    { key: 'when', header: 'When', cell: (row) => (
      <span title={dateTime(row.created_at)} className="whitespace-nowrap text-xs text-ink-300">{relativeTime(row.created_at)}</span>
    ) },
    { key: 'actor', header: 'Actor', cell: (row) => (
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-100">{row.actor_username || 'anonymous'}</p>
        <p className="truncate text-[0.66rem] uppercase text-ink-500">{row.actor_role}</p>
      </div>
    ) },
    { key: 'action', header: 'Action', cell: (row) => <span className="num text-xs text-ink-200">{row.action}</span> },
    { key: 'entity', header: 'Entity', cell: (row) => (
      <span className="text-[0.7rem] text-ink-400">
        {row.entity_type.replace(/_/g, ' ')}{row.entity_id ? ` #${row.entity_id}` : ''}
      </span>
    ) },
    { key: 'request', header: 'Request', cell: (row) => (
      <span className="num whitespace-nowrap text-[0.7rem] text-ink-400">
        {row.method} {row.path.length > 34 ? `${row.path.slice(0, 34)}...` : row.path}
      </span>
    ) },
    { key: 'status', header: 'Status', numeric: true, cell: (row) => (
      <span
        className={clsx(
          'num text-xs font-semibold',
          row.status_code < 300 ? 'text-emerald-300' : row.status_code < 500 ? 'text-amber-300' : 'text-rose-300',
        )}
      >
        {row.status_code}
      </span>
    ) },
    { key: 'outcome', header: 'Outcome', cell: (row) => (
      <span className={OUTCOME_TONE[row.outcome] ?? 'badge-neutral'}>{row.outcome.toLowerCase()}</span>
    ) },
    { key: 'duration', header: 'Time', numeric: true, cell: (row) => (
      <span className="num text-[0.7rem] text-ink-400">{row.duration_ms === null ? '-' : `${row.duration_ms}ms`}</span>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every authenticated request, written after the response completes. Denied attempts are recorded too, so repeated privilege probing is visible."
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard label="Entries" value={qty(meta.total ?? 0)} hint="matching the filters" icon={<Icon.Shield className="h-5 w-5" />} />
        <StatCard label="Requests" value={qty(totals.SUCCESS ?? 0)} hint="last 30 days" accent="positive" icon={<Icon.Check className="h-5 w-5" />} />
        <StatCard label="Denied" value={qty(totals.DENIED ?? 0)} hint="last 30 days" accent={(totals.DENIED ?? 0) > 0 ? 'warning' : 'neutral'} icon={<Icon.Alert className="h-5 w-5" />} />
        <StatCard label="Failures" value={qty(totals.FAILURE ?? 0)} hint="last 30 days" accent={(totals.FAILURE ?? 0) > 0 ? 'negative' : 'neutral'} icon={<Icon.Close className="h-5 w-5" />} />
      </StatGrid>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Path, entity or request id..." />
          <select className="input w-auto max-w-[16rem]" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            {availableActions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} ({item.count})
              </option>
            ))}
          </select>
          <select className="input w-auto" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
            <option value="">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="DENIED">Denied</option>
            <option value="FAILURE">Failure</option>
          </select>
          <input
            className="input w-auto"
            value={actor}
            onChange={(e) => { setActor(e.target.value); setPage(1); }}
            placeholder="Username"
            aria-label="Filter by username"
          />
          <select className="input w-auto" value={statusCode} onChange={(e) => { setStatusCode(e.target.value); setPage(1); }}>
            <option value="">Any status</option>
            {[200, 201, 400, 401, 403, 404, 409, 422].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>

        <DataTable
          rows={rowsOf(list)}
          columns={columns}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          onRowClick={setDetail}
          empty={<span className="text-sm text-ink-400">No audit entries match the current filters.</span>}
          footer={<Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />}
        />
      </div>

      {detail ? (
        <div className="card mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="card-title">Entry #{detail.id}</h2>
            <button className="btn-ghost btn-sm" onClick={() => setDetail(null)}>
              <Icon.Close className="h-4 w-4" />
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm lg:grid-cols-4">
            {[
              ['When', dateTime(detail.created_at)],
              ['Actor', `${detail.actor_username} (${detail.actor_role})`],
              ['Action', detail.action],
              ['Outcome', humanise(detail.outcome)],
              ['Request id', detail.request_id],
              ['Method', detail.method],
              ['Path', detail.path],
              ['Status', String(detail.status_code)],
              ['Entity', `${detail.entity_type.replace(/_/g, ' ')}${detail.entity_id ? ` #${detail.entity_id}` : ''}`],
              ['Duration', detail.duration_ms === null ? '-' : `${detail.duration_ms} ms`],
            ].map(([term, value]) => (
              <div key={term}>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">{term}</dt>
                <dd className="mt-0.5 break-words text-ink-100">{value}</dd>
              </div>
            ))}
          </dl>
          {detail.message ? (
            <p className="mt-3 rounded-lg bg-ink-900/60 p-3 text-xs text-ink-300">{detail.message}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
