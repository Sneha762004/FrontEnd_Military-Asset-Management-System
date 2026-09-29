import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import clsx from 'clsx';
import { api, dataOf, metaOf, rowsOf } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_FILTERS, FilterBar } from '../components/FilterBar';
import { BalanceWalkDown, PageHeader, StatCard, StatGrid } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { Modal, Spinner } from '../components/Modal';
import { Icon } from '../components/ui';
import { date, month, plural, qty, signedQty } from '../lib/format';
import type {
  ByBaseRow,
  ByEquipmentRow,
  DashboardSummary,
  MovementRow,
  ReportFilters,
  TrendPoint,
} from '../types';

const CHART_COLOURS = { purchases: '#0ea5e9', transferIn: '#10b981', transferOut: '#f43f5e', expended: '#f59e0b' };

export function DashboardPage() {
  const { user, isGlobal } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>(() => ({ ...DEFAULT_FILTERS, baseId: isGlobal ? null : (user?.baseId ?? null) }));
  const [netMovementOpen, setNetMovementOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);

  const query = { dateFrom: filters.dateFrom, dateTo: filters.dateTo, baseId: filters.baseId, equipmentTypeId: filters.equipmentTypeId, category: filters.category };
  const enabled = filters.dateFrom <= filters.dateTo;

  const summary = useQuery({
    queryKey: ['dashboard', 'summary', query],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary', query),
    enabled,
  });

  const byEquipment = useQuery({
    queryKey: ['dashboard', 'by-equipment', query],
    queryFn: () => api.get<ByEquipmentRow[]>('/dashboard/by-equipment', query),
    enabled,
  });

  const byBase = useQuery({
    queryKey: ['dashboard', 'by-base', query],
    queryFn: () => api.get<ByBaseRow[]>('/dashboard/by-base', query),
    enabled,
  });

  const trend = useQuery({
    queryKey: ['dashboard', 'trend', query],
    queryFn: () => api.get<TrendPoint[]>('/dashboard/trend', query),
    enabled,
  });

  const movements = useQuery({
    queryKey: ['dashboard', 'movements', query],
    queryFn: () => api.get<MovementRow[]>('/dashboard/movements', { ...query, pageSize: 12 }),
    enabled,
  });

  const overview = dataOf(summary);
  const totals = overview?.totals;
  const counts = overview?.document_counts;
  const loading = summary.isLoading || byEquipment.isLoading;

  const trendRows = rowsOf(trend);
  const baseRows = rowsOf(byBase);
  const maxClosing = baseRows.reduce((highest, row) => Math.max(highest, row.closing_balance), 0);

  const unit = totals?.unit ?? 'units';

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user?.fullName?.split(' ')[0] ?? 'there'}`}
        subtitle={
          overview
            ? `${overview.scope.baseLabel} \u00b7 ${plural(counts?.purchases.n ?? 0, 'purchase', 'purchases')}, ${plural(
                counts?.transfers.documents ?? 0,
                'transfer',
                'transfers',
              )}, ${plural(counts?.assignments.documents ?? 0, 'open assignment')} in this window.`
            : 'Loading the current position\u2026'
        }
        actions={
          <button className="btn-secondary btn-sm" onClick={() => void summary.refetch()} disabled={summary.isFetching}>
            <Icon.Refresh className={clsx('h-4 w-4', summary.isFetching && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      <FilterBar value={filters} onChange={setFilters} />

      {/*
        The API refuses to add up quantities of different things. Across several
        equipment types the closing balance is "mixed units", so presenting it as
        one number would be misleading - say so instead of implying a total.
      */}
      {totals && !totals.totals_are_meaningful && !filters.equipmentTypeId ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <Icon.Alert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            These totals cover more than one equipment type, so the quantities are not additive
            {' '}(<span className="font-semibold">{totals.unit}</span>). Pick a single equipment type above for
            figures that can be summed and reconciled.
          </p>
        </div>
      ) : null}

      {summary.isError ? (
        <div className="card border-rose-500/30 p-6 text-sm text-rose-300">
          <Icon.Alert className="mr-2 inline h-4 w-4" />
          {(summary.error as Error).message}
        </div>
      ) : null}

      {/* Headline position */}
      <StatGrid cols={5} className="mb-4">
        <StatCard
          label="Closing balance"
          value={loading ? <span className="skeleton inline-block h-7 w-20" /> : qty(totals?.closing_balance)}
          unit={unit}
          hint={`Opening ${qty(totals?.opening_balance)}`}
          icon={<Icon.Box className="h-5 w-5" />}
          accent="info"
        />
        <StatCard
          label="Available"
          value={loading ? <span className="skeleton inline-block h-7 w-20" /> : qty(totals?.available)}
          unit={unit}
          hint="Closing minus assigned"
          icon={<Icon.Check className="h-5 w-5" />}
          accent={totals && totals.available > 0 ? 'positive' : 'warning'}
        />
        <StatCard
          label="Assigned"
          value={loading ? <span className="skeleton inline-block h-7 w-20" /> : qty(totals?.assigned)}
          unit={unit}
          hint={`${plural(counts?.assignments.documents ?? 0, 'open assignment')}`}
          icon={<Icon.Assign className="h-5 w-5" />}
          accent="warning"
        />
        <StatCard
          label="Expended"
          value={loading ? <span className="skeleton inline-block h-7 w-20" /> : qty(totals?.expended)}
          unit={unit}
          hint="Written off in period"
          icon={<Icon.Trend className="h-5 w-5" />}
          accent="negative"
        />
        <StatCard
          label="In transit"
          value={loading ? <span className="skeleton inline-block h-7 w-20" /> : qty(counts?.transfers.units)}
          unit={unit}
          hint={`${plural(counts?.transfers.documents ?? 0, 'transfer')} awaiting receipt`}
          icon={<Icon.Transfer className="h-5 w-5" />}
          accent="info"
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {totals ? (
            <BalanceWalkDown
              opening={totals.opening_balance}
              purchases={totals.purchases}
              transferIn={totals.transfer_in}
              transferOut={totals.transfer_out}
              expended={totals.expended}
              assigned={totals.assigned}
              closing={totals.closing_balance}
              available={totals.available}
              unit={unit}
              onNetMovementClick={() => setNetMovementOpen(true)}
            />
          ) : (
            <div className="card skeleton h-96" />
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {/* Movement mix over time */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Movement by month</h2>
              <span className="text-[0.7rem] text-ink-500">Units in and out</span>
            </div>
            <div className="h-64 p-3">
              {trendRows.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendRows} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2f36" vertical={false} />
                    <XAxis dataKey="period" tickFormatter={month} tick={{ fill: '#718c99', fontSize: 11 }} axisLine={{ stroke: '#1f2f36' }} tickLine={false} />
                    <YAxis tick={{ fill: '#718c99', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#16262d', border: '1px solid #344953', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(label) => month(String(label))}
                      formatter={(value, name) => [qty(Number(value)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#a1b3bc' }} iconType="circle" iconSize={8} />
                    <Bar dataKey="purchases" name="Purchases" stackId="in" fill={CHART_COLOURS.purchases} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="transfer_in" name="Transfers in" stackId="in" fill={CHART_COLOURS.transferIn} />
                    <Bar dataKey="transfer_out" name="Transfers out" stackId="out" fill={CHART_COLOURS.transferOut} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="expended" name="Expended" stroke={CHART_COLOURS.expended} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-500">
                  {trend.isLoading ? <Spinner /> : 'No movement in this period.'}
                </div>
              )}
            </div>
          </div>

          {/* Recent movement feed */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent movement</h2>
              <a className="link text-xs" href="/ledger">
                Open full ledger
              </a>
            </div>
            <DataTable
              rows={rowsOf(movements)}
              loading={movements.isLoading}
              rowKey={(row) => row.id}
              empty={<><span className="text-sm text-ink-400">No movement in this window.</span></>}
              columns={movementColumns}
              maxHeight="21rem"
            />
          </div>
        </div>
      </div>

      {/* Per-equipment reconciliation */}
      <div className="card mt-4">
        <div className="card-header">
          <h2 className="card-title">Position by equipment type</h2>
          <span className="text-[0.7rem] text-ink-500">Each row independently satisfies the closing identity</span>
        </div>
        <DataTable
          rows={rowsOf(byEquipment)}
          loading={byEquipment.isLoading}
          rowKey={(row) => row.equipment_type_id}
          empty={<span className="text-sm text-ink-400">No equipment matches the current filters.</span>}
          columns={byEquipmentColumns}
          maxHeight="30rem"
        />
      </div>

      {/* Per-base walk-down, admin only */}
      {isGlobal ? (
        <div className="card mt-4">
          <div className="card-header">
            <h2 className="card-title">Position by base</h2>
            <button className="btn-secondary btn-sm" onClick={() => setBaseOpen((open) => !open)}>
              {baseOpen ? 'Hide chart' : 'Compare bases'}
              <Icon.Chevron className={clsx('h-3.5 w-3.5 transition-transform', baseOpen && 'rotate-90')} />
            </button>
          </div>
          {baseOpen ? (
            <div className="h-64 p-3">
              {baseRows.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={baseRows} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2f36" vertical={false} />
                    <XAxis dataKey="base_code" tick={{ fill: '#718c99', fontSize: 11 }} axisLine={{ stroke: '#1f2f36' }} tickLine={false} />
                    <YAxis tick={{ fill: '#718c99', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#16262d', border: '1px solid #344953', borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name) => [qty(Number(value)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="closing_balance" name="Closing" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="assigned" name="Assigned" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="available" name="Available" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-500">No data.</div>
              )}
            </div>
          ) : null}
          <DataTable
            rows={rowsOf(byBase)}
            loading={byBase.isLoading}
            rowKey={(row) => row.base_id}
            empty={<span className="text-sm text-ink-400">No bases match the current filters.</span>}
            columns={buildByBaseColumns(maxClosing)}
          />
        </div>
      ) : null}

      <NetMovementModal open={netMovementOpen} onClose={() => setNetMovementOpen(false)} filters={filters} />
    </>
  );
}

/* ------------------------------------------------------------------ modal -- */

function NetMovementModal({
  open,
  onClose,
  filters,
}: {
  open: boolean;
  onClose: () => void;
  filters: ReportFilters;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);

  const query = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    baseId: filters.baseId,
    equipmentTypeId: filters.equipmentTypeId,
    category: filters.category,
    page,
    pageSize,
  };

  const result = useQuery({
    queryKey: ['dashboard', 'net-movement', query],
    queryFn: () => api.get<MovementRow[]>('/dashboard/net-movement', query),
    enabled: open,
    placeholderData: (previous) => previous,
  });
  const { isLoading, isFetching, error } = result;

  const meta = metaOf(result);
  const breakdown = meta.breakdown ?? null;
  const rows = rowsOf(result);

  // Running contribution, so the reader can see net movement accumulate.
  const rowsWithRunning = useMemo(() => {
    let running = 0;
    return rows.map((row) => {
      const contribution = row.txn_type === 'TRANSFER_OUT' ? -row.quantity : row.quantity;
      running += contribution;
      return { ...row, contribution, running };
    });
  }, [rows]);

  const columns: Column<(typeof rowsWithRunning)[number]>[] = [
    { key: 'date', header: 'Date', cell: (row) => date(row.effective_date), width: '7rem' },
    { key: 'base', header: 'Base', cell: (row) => <span title={row.base_name}>{row.base_code}</span> },
    { key: 'ref', header: 'Reference', cell: (row) => <span className="num text-xs text-ink-200">{row.ref_reference}</span> },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <span
          className={clsx(
            'badge',
            row.txn_type === 'PURCHASE'
              ? 'badge-info'
              : row.txn_type === 'TRANSFER_IN'
                ? 'badge-success'
                : 'badge-danger',
          )}
        >
          {row.txn_type === 'TRANSFER_OUT' ? 'Transfer out' : row.txn_type === 'TRANSFER_IN' ? 'Transfer in' : 'Purchase'}
        </span>
      ),
    },
    { key: 'equipment', header: 'Equipment', cell: (row) => `${row.equipment_code} \u00b7 ${row.equipment_name}` },
    { key: 'qty', header: 'Units', numeric: true, cell: (row) => qty(row.quantity) },
    {
      key: 'contribution',
      header: 'Contribution',
      numeric: true,
      cell: (row) => <span className={row.contribution >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signedQty(row.contribution)}</span>,
    },
    { key: 'running', header: 'Running net', numeric: true, cell: (row) => <span className="text-ink-300">{signedQty(row.running)}</span> },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Net movement drill-down"
      description="Every receipt and issue behind the single netted number for this window."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {breakdown ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Purchases', value: breakdown.purchases, tone: 'text-accent-400' },
            { label: 'Transfers in', value: breakdown.transfer_in, tone: 'text-emerald-300' },
            { label: 'Transfers out', value: breakdown.transfer_out, tone: 'text-rose-300' },
            { label: 'Net movement', value: breakdown.net_movement, tone: 'text-ink-100' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">{item.label}</p>
              <p className={clsx('num mt-1 text-lg font-semibold tabular-nums', item.tone)}>{qty(item.value)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mb-3 font-mono text-[0.7rem] text-ink-500">
        {breakdown ? breakdown.formula : 'net movement = purchases + transfer in - transfer out'}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Filter by reference, base or equipment..." />
        <select className="input w-auto" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
        {isFetching && !isLoading ? <Spinner className="h-4 w-4 text-ink-400" /> : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{(error as Error).message}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-ink-700/70">
          <DataTable
            rows={rowsWithRunning}
            loading={isLoading}
            rowKey={(row) => row.id}
            columns={columns}
            empty={<span className="text-sm text-ink-400">No movement documents in this window.</span>}
          />
        </div>
      )}

      {rowsWithRunning.length > 0 ? (
        <p className="mt-3 text-[0.7rem] text-ink-500">
          Rows are newest-first, so the running column reads bottom-up in time order. The last value in date order
          equals the net movement shown above ({qty(breakdown?.net_movement)}).
        </p>
      ) : null}
    </Modal>
  );
}

/* ---------------------------------------------------------------- columns -- */

const movementColumns: Column<MovementRow>[] = [
  { key: 'date', header: 'Date', cell: (row) => date(row.effective_date), width: '6.5rem' },
  { key: 'base', header: 'Base', cell: (row) => row.base_code },
  { key: 'ref', header: 'Reference', cell: (row) => <span className="num text-xs text-ink-200">{row.ref_reference}</span> },
  {
    key: 'type',
    header: 'Type',
    cell: (row) => (
      <span className={clsx('badge', row.direction === 'IN' ? 'badge-success' : 'badge-danger')}>
        {row.direction === 'IN' ? '\u2193 In' : '\u2191 Out'}
      </span>
    ),
  },
  { key: 'equipment', header: 'Equipment', cell: (row) => row.equipment_name },
  { key: 'qty', header: 'Units', numeric: true, cell: (row) => qty(row.quantity) },
  { key: 'balance', header: 'On hand', numeric: true, cell: (row) => (row.balance_on_hand === undefined ? '-' : qty(row.balance_on_hand)) },
  {
    key: 'actor',
    header: 'Recorded by',
    cell: (row) => <span className="text-xs text-ink-400">{row.actor_username ?? 'system'}</span>,
  },
];

const byEquipmentColumns: Column<ByEquipmentRow>[] = [
  {
    key: 'equipment',
    header: 'Equipment',
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-100">{row.equipment_name}</p>
        <p className="truncate font-mono text-[0.7rem] text-ink-500">
          {row.equipment_code} &middot; {row.equipment_category.toLowerCase()}
        </p>
      </div>
    ),
  },
  { key: 'opening', header: 'Opening', numeric: true, cell: (row) => qty(row.opening_balance) },
  { key: 'purchases', header: 'Purchases', numeric: true, cell: (row) => <span className="text-accent-400">+{qty(row.purchases)}</span> },
  { key: 'in', header: 'Transfers in', numeric: true, cell: (row) => <span className="text-emerald-300">+{qty(row.transfer_in)}</span> },
  { key: 'out', header: 'Transfers out', numeric: true, cell: (row) => <span className="text-rose-300">-{qty(row.transfer_out)}</span> },
  { key: 'net', header: 'Net movement', numeric: true, cell: (row) => <span className="font-medium text-accent-400">{signedQty(row.net_movement)}</span> },
  { key: 'expended', header: 'Expended', numeric: true, cell: (row) => <span className="text-amber-300">-{qty(row.expended)}</span> },
  { key: 'closing', header: 'Closing', numeric: true, cell: (row) => <span className="font-semibold text-ink-100">{qty(row.closing_balance)}</span> },
  { key: 'assigned', header: 'Assigned', numeric: true, cell: (row) => <span className="text-amber-300">{qty(row.assigned)}</span> },
  { key: 'available', header: 'Available', numeric: true, cell: (row) => <span className="font-semibold text-emerald-300">{qty(row.available)}</span> },
  {
    key: 'check',
    header: 'Check',
    cell: (row) => {
      const ok = row.opening_balance + row.net_movement - row.expended === row.closing_balance && row.closing_balance - row.assigned === row.available;
      return ok ? (
        <span className="badge-success">
          <Icon.Check className="h-3 w-3" />
          Balances
        </span>
      ) : (
        <span className="badge-danger">
          <Icon.Alert className="h-3 w-3" />
          Mismatch
        </span>
      );
    },
  },
];

/** A per-base share bar, so the table reads at a glance without a chart. */
function UnitBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="num w-12 text-right text-xs text-ink-400">{pct}%</span>
    </div>
  );
}

const buildByBaseColumns = (maxClosing: number): Column<ByBaseRow>[] => [
  {
    key: 'base',
    header: 'Base',
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-100">{row.base_name}</p>
        <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.base_code}</p>
      </div>
    ),
  },
  { key: 'opening', header: 'Opening', numeric: true, cell: (row) => qty(row.opening_balance) },
  { key: 'purchases', header: 'Purchases', numeric: true, cell: (row) => <span className="text-accent-400">+{qty(row.purchases)}</span> },
  { key: 'net', header: 'Net movement', numeric: true, cell: (row) => <span className="text-accent-400">{signedQty(row.net_movement)}</span> },
  { key: 'expended', header: 'Expended', numeric: true, cell: (row) => <span className="text-amber-300">-{qty(row.expended)}</span> },
  { key: 'closing', header: 'Closing', numeric: true, cell: (row) => <span className="font-semibold">{qty(row.closing_balance)}</span> },
  { key: 'assigned', header: 'Assigned', numeric: true, cell: (row) => <span className="text-amber-300">{qty(row.assigned)}</span> },
  { key: 'available', header: 'Available', numeric: true, cell: (row) => <span className="font-semibold text-emerald-300">{qty(row.available)}</span> },
  {
    key: 'share',
    header: 'Share of holding',
    numeric: true,
    cell: (row) => <UnitBar value={row.closing_balance} max={maxClosing} />,
  },
];