import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, metaOf, rowsOf } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_FILTERS, FilterBar } from '../components/FilterBar';
import { PageHeader, StatGrid, StatCard } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { Icon } from '../components/ui';
import { date, dateTime, qty, signedQty } from '../lib/format';
import type { LedgerBalance, MovementRow, ReportFilters } from '../types';

const TXN_TONE: Record<string, string> = {
  PURCHASE: 'badge-info',
  TRANSFER_IN: 'badge-success',
  TRANSFER_OUT: 'badge-danger',
  ASSIGNMENT: 'badge-warning',
  ASSIGNMENT_RETURN: 'badge-success',
  EXPENDITURE: 'badge-danger',
  OPENING_BALANCE: 'badge-neutral',
  CANCELLATION: 'badge-danger',
};

const TXN_LABEL: Record<string, string> = {
  PURCHASE: 'Purchase',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  ASSIGNMENT: 'Assigned',
  ASSIGNMENT_RETURN: 'Returned',
  EXPENDITURE: 'Expended',
  OPENING_BALANCE: 'Opening',
  CANCELLATION: 'Cancelled',
};

export function LedgerPage() {
  const { isGlobal, baseId } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>(() => ({ ...DEFAULT_FILTERS, baseId: isGlobal ? null : (baseId ?? null) }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [txnType, setTxnType] = useState('');
  const [tab, setTab] = useState<'movements' | 'balances'>('movements');

  const enabled = filters.dateFrom <= filters.dateTo;

  const movements = useQuery({
    queryKey: ['ledger', 'movements', { ...filters, page, pageSize, search, txnType }],
    queryFn: () =>
      api.get<MovementRow[]>('/ledger', {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        baseId: filters.baseId,
        equipmentTypeId: filters.equipmentTypeId,
        txnType: txnType || null,
        search,
        page,
        pageSize,
      }),
    enabled: enabled && tab === 'movements',
    placeholderData: (previous) => previous,
  });

  const balances = useQuery({
    queryKey: ['ledger', 'balances', filters],
    queryFn: () =>
      api.get<LedgerBalance[]>('/ledger/balances', {
        baseId: filters.baseId,
        equipmentTypeId: filters.equipmentTypeId,
        category: filters.category,
      }),
    enabled: tab === 'balances',
    placeholderData: (previous) => previous,
  });

  const meta = metaOf(movements);
  const summary = (meta.summary ?? {}) as Record<string, number>;

  const movementColumns: Column<MovementRow>[] = [
    { key: 'id', header: '#', cell: (row) => <span className="num text-[0.7rem] text-ink-500">{row.id}</span>, width: '3.5rem' },
    { key: 'date', header: 'Effective', cell: (row) => date(row.effective_date) },
    { key: 'type', header: 'Movement', cell: (row) => (
      <span className={clsx(TXN_TONE[row.txn_type] ?? 'badge-neutral')}>{TXN_LABEL[row.txn_type] ?? row.txn_type}</span>
    ) },
    { key: 'base', header: 'Base', cell: (row) => <span title={row.base_name}>{row.base_code}</span> },
    { key: 'equipment', header: 'Equipment', cell: (row) => (
      <div className="min-w-0">
        <p className="truncate">{row.equipment_name}</p>
        <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.equipment_code}</p>
      </div>
    ) },
    { key: 'ref', header: 'Document', cell: (row) => (
      <div className="min-w-0">
        <p className="num truncate text-xs text-ink-200">{row.ref_reference}</p>
        <p className="truncate text-[0.68rem] uppercase text-ink-500">{row.ref_type.replace(/_/g, ' ')}</p>
      </div>
    ) },
    { key: 'qty', header: 'Units', numeric: true, cell: (row) => qty(row.quantity) },
    { key: 'delta', header: 'Change', numeric: true, cell: (row) => (
      <span className={row.delta_on_hand >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signedQty(row.delta_on_hand)}</span>
    ) },
    { key: 'committed', header: 'Committed', numeric: true, cell: (row) => (
      <span className={row.delta_committed ? (row.delta_committed > 0 ? 'text-amber-300' : 'text-emerald-300') : 'text-ink-600'}>
        {row.delta_committed ? signedQty(row.delta_committed) : '-'}
      </span>
    ) },
    { key: 'balance', header: 'On hand', numeric: true, cell: (row) => (
      <span className="font-semibold text-ink-100">{row.balance_on_hand === undefined ? '-' : qty(row.balance_on_hand)}</span>
    ) },
    { key: 'actor', header: 'Recorded by', cell: (row) => <span className="text-xs text-ink-400">{row.actor_username ?? 'system'}</span> },
    { key: 'logged', header: 'Logged', cell: (row) => <span className="text-[0.7rem] text-ink-500">{dateTime(row.created_at)}</span> },
  ];

  const balanceColumns: Column<LedgerBalance>[] = [
    { key: 'base', header: 'Base', cell: (row) => <span title={row.base_name}>{row.base_code}</span> },
    { key: 'equipment', header: 'Equipment', cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-100">{row.equipment_name}</p>
        <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.equipment_code} &middot; {row.equipment_category.toLowerCase()}</p>
      </div>
    ) },
    { key: 'onhand', header: 'On hand', numeric: true, cell: (row) => <span className="font-semibold">{qty(row.on_hand)}</span> },
    { key: 'committed', header: 'Committed', numeric: true, cell: (row) => <span className="text-amber-300">{qty(row.committed)}</span> },
    { key: 'available', header: 'Available', numeric: true, cell: (row) => <span className="font-semibold text-emerald-300">{qty(row.available)}</span> },
    { key: 'last', header: 'Last movement', cell: (row) => date(row.last_movement_date) },
    {
      key: 'check',
      header: 'Check',
      cell: (row) =>
        row.on_hand - row.committed === row.available ? (
          <span className="badge-success">
            <Icon.Check className="h-3 w-3" />
            Balances
          </span>
        ) : (
          <span className="badge-danger">
            <Icon.Alert className="h-3 w-3" />
            Mismatch
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Movement ledger"
        subtitle="An append-only record. Nothing here can be edited or deleted through the API - corrections are made by posting a balancing entry."
      />

      <FilterBar value={filters} onChange={(next) => { setFilters(next); setPage(1); }} hideCategory={tab === 'movements' ? false : false} />

      <div className="mb-4 flex gap-1 border-b border-ink-700/70">
        {(['movements', 'balances'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTab(option)}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition',
              tab === option ? 'border-accent-500 text-accent-400' : 'border-transparent text-ink-400 hover:text-ink-200',
            )}
          >
            {option === 'movements' ? 'Movements' : 'Current balances'}
          </button>
        ))}
      </div>

      {tab === 'movements' ? (
        <>
          <StatGrid cols={4} className="mb-4">
            <StatCard label="Movements" value={qty(meta.total ?? 0)} icon={<Icon.Ledger className="h-5 w-5" />} />
            <StatCard label="Units in" value={qty(summary.inbound ?? 0)} accent="positive" icon={<Icon.Box className="h-5 w-5" />} />
            <StatCard label="Units out" value={qty(summary.outbound ?? 0)} accent="negative" icon={<Icon.Trend className="h-5 w-5" />} />
            <StatCard label="Net change" value={signedQty((summary.inbound ?? 0) - (summary.outbound ?? 0))} accent="info" icon={<Icon.Transfer className="h-5 w-5" />} />
          </StatGrid>

          <div className="card">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Reference, document or note..." />
              <select className="input w-auto" value={txnType} onChange={(e) => { setTxnType(e.target.value); setPage(1); }}>
                <option value="">All movement types</option>
                {Object.keys(TXN_LABEL).map((type) => (
                  <option key={type} value={type}>
                    {TXN_LABEL[type]}
                  </option>
                ))}
              </select>
              <select className="input w-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[25, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </div>

            <DataTable
              rows={rowsOf(movements)}
              columns={movementColumns}
              loading={movements.isLoading}
              rowKey={(row) => row.id}
              empty={<span className="text-sm text-ink-400">No movements match the current filters.</span>}
              footer={<Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />}
            />
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Position by base and equipment type</h2>
            <span className="text-[0.7rem] text-ink-500">As at now, not restricted by date</span>
          </div>
          <DataTable
            rows={rowsOf(balances)}
            columns={balanceColumns}
            loading={balances.isLoading}
            rowKey={(row) => `${row.base_id}-${row.equipment_type_id}`}
            empty={<span className="text-sm text-ink-400">No balances match the current filters.</span>}
          />
        </div>
      )}
    </>
  );
}
