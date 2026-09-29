import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError, metaOf, rowsOf } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PageHeader, StatGrid, StatCard } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { ConfirmDialog, InlineError, Modal, Spinner } from '../components/Modal';
import { Icon, statusTone } from '../components/ui';
import { date, plural, qty, today } from '../lib/format';
import type { Base, EquipmentType, Transfer } from '../types';

const STATUS_HELP: Record<string, string> = {
  IN_TRANSIT: 'Stock has left the sending base but is not yet confirmed as received. It is out of the sender and not yet the receiver&rsquo;s.',
  COMPLETED: 'Receipt confirmed. The stock has been added to the receiving base.',
  CANCELLED: 'Cancelled before receipt. Any movement already posted has been reversed.',
};

export function TransfersPage() {
  const { can, isGlobal, baseId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [baseFilter, setBaseFilter] = useState<number | ''>(isGlobal ? '' : (baseId ?? ''));
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [receiving, setReceiving] = useState<Transfer | null>(null);
  const [cancelling, setCancelling] = useState<Transfer | null>(null);
  const [detail, setDetail] = useState<Transfer | null>(null);

  const query = { page, pageSize, search, baseId: baseFilter === '' ? null : baseFilter, status: statusFilter || null };

  const list = useQuery({
    queryKey: ['transfers', query],
    queryFn: () => api.get<Transfer[]>('/transfers', query),
    placeholderData: (previous) => previous,
  });

  const bases = useQuery({ queryKey: ['bases', 'all'], queryFn: () => api.get<Base[]>('/catalogue/bases'), staleTime: 5 * 60 * 1000 });
  const meta = metaOf(list);
  const rows = rowsOf(list);
  const summary = (meta.summary ?? {}) as Record<string, number>;

  const receiveMutation = useMutation({
    mutationFn: (transfer: Transfer) => api.post<Transfer>(`/transfers/${transfer.id}/receive`, { receivedDate: today() }),
    onSuccess: () => {
      toast.success('Receipt confirmed. Stock is now held by the receiving base.');
      void queryClient.invalidateQueries();
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not confirm receipt.'),
    onSettled: () => setReceiving(null),
  });

  const cancelMutation = useMutation({
    mutationFn: (transfer: Transfer) => api.post<Transfer>(`/transfers/${transfer.id}/cancel`, { reason: 'Cancelled from the register' }),
    onSuccess: () => {
      toast.success('Transfer cancelled and the dispatch movement reversed.');
      void queryClient.invalidateQueries();
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not cancel the transfer.'),
    onSettled: () => setCancelling(null),
  });

  const columns: Column<Transfer>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (row) => (
        <button className="num text-xs font-medium text-accent-400 hover:underline" onClick={(e) => { e.stopPropagation(); setDetail(row); }}>
          {row.reference}
        </button>
      ),
    },
    { key: 'route', header: 'Route', cell: (row) => <span className="whitespace-nowrap font-mono text-xs">{row.from_base_code} &rarr; {row.to_base_code}</span> },
    { key: 'date', header: 'Dispatched', cell: (row) => date(row.transfer_date) },
    { key: 'lines', header: 'Lines', numeric: true, cell: (row) => qty(row.line_count) },
    { key: 'units', header: 'Units', numeric: true, cell: (row) => qty(row.total_quantity) },
    { key: 'vehicle', header: 'Vehicle ref', cell: (row) => <span className="text-xs text-ink-300">{row.vehicle_ref || '-'}</span> },
    { key: 'received', header: 'Received', cell: (row) => date(row.received_date) },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const tone = statusTone(row.status);
        return (
          <span className={tone === 'neutral' ? 'badge-neutral' : tone} title={STATUS_HELP[row.status]}>
            {row.status === 'IN_TRANSIT' ? 'In transit' : row.status.toLowerCase()}
          </span>
        );
      },
    },
    { key: 'by', header: 'Raised by', cell: (row) => <span className="text-xs text-ink-400">{row.created_by_username}</span> },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {can('transfer:update') && row.status === 'IN_TRANSIT' ? (
            <button className="btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setReceiving(row); }}>
              Confirm receipt
            </button>
          ) : null}
          {can('transfer:update') && row.status === 'IN_TRANSIT' ? (
            <button className="btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); setCancelling(row); }}>
              Cancel
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Transfers between bases"
        subtitle="Stock leaves the sending base on dispatch and arrives on confirmed receipt, so goods in transit are always visible."
        actions={
          can('transfer:create') ? (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Icon.Plus className="h-4 w-4" />
              Raise transfer
            </button>
          ) : null
        }
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard label="Documents" value={qty(meta.total ?? 0)} icon={<Icon.Transfer className="h-5 w-5" />} />
      <StatCard label="In transit" value={plural(summary.in_transit ?? 0, 'transfer')} accent="warning" icon={<Icon.Clock className="h-5 w-5" />} />
      <StatCard label="Completed" value={plural(summary.completed ?? 0, 'transfer')} accent="positive" icon={<Icon.Check className="h-5 w-5" />} />
      <StatCard label="Units in transit" value={qty(summary.units_in_transit ?? 0)} accent="info" icon={<Icon.Transfer className="h-5 w-5" />} />
      </StatGrid>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {Object.entries(STATUS_HELP).map(([status, help]) => (
          <div key={status} className="card flex items-start gap-2.5 p-3">
            <span className={clsx('badge mt-0.5 shrink-0', statusTone(status) === 'neutral' ? 'badge-neutral' : statusTone(status))}>
              {status === 'IN_TRANSIT' ? 'In transit' : status.toLowerCase()}
            </span>
            <p className="text-[0.7rem] leading-relaxed text-ink-400">{help}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Reference, vehicle or notes..." />
          {isGlobal ? (
            <select className="input w-auto" value={baseFilter} onChange={(e) => { setBaseFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
              <option value="">All bases</option>
              {(rowsOf(bases)).map((base) => (
                <option key={base.id} value={base.id}>
                  {base.code}
                </option>
              ))}
            </select>
          ) : null}
          <select className="input w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {['IN_TRANSIT', 'COMPLETED', 'CANCELLED'].map((status) => (
              <option key={status} value={status}>
                {status === 'IN_TRANSIT' ? 'In transit' : status.toLowerCase()}
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
          rows={rows}
          columns={columns}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          onRowClick={setDetail}
          empty={<span className="text-sm text-ink-400">No transfers match the current filters.</span>}
          footer={<Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />}
        />
      </div>

      <TransferForm open={formOpen} onClose={() => setFormOpen(false)} />
      {detail ? <TransferDetail transfer={detail} onClose={() => setDetail(null)} /> : null}

      <ConfirmDialog
        open={Boolean(receiving)}
        title="Confirm receipt of this transfer?"
        message={
          receiving
            ? `${receiving.reference}: ${plural(receiving.total_quantity, 'unit')} moving ${receiving.from_base_code} \u2192 ${receiving.to_base_code}.\n\nConfirming posts the inbound movement and closes the transfer. This cannot be undone.`
            : ''
        }
        confirmLabel="Confirm receipt"
        tone="primary"
        busy={receiveMutation.isPending}
        error={receiveMutation.isError ? (receiveMutation.error as Error).message : null}
        onConfirm={() => receiving && receiveMutation.mutate(receiving)}
        onCancel={() => setReceiving(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Cancel this transfer?"
        message={
          cancelling
            ? `${cancelling.reference} has already left ${cancelling.from_base_code}.\n\nCancelling reverses the outbound movement and returns the units to ${cancelling.from_base_code}. Confirm the goods are physically back before continuing.`
            : ''
        }
        confirmLabel="Cancel transfer"
        busy={cancelMutation.isPending}
        error={cancelMutation.isError ? (cancelMutation.error as Error).message : null}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling)}
        onCancel={() => setCancelling(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------- form -- */

interface DraftLine {
  key: number;
  equipmentTypeId: string;
  quantity: string;
}

function TransferForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isGlobal, baseId, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const bases = useQuery({ queryKey: ['bases', 'all'], queryFn: () => api.get<Base[]>('/catalogue/bases'), enabled: open, staleTime: 5 * 60 * 1000 });
  // A base-scoped officer's `/catalogue/bases` contains only their own base, so
  // it cannot populate the destination picker - the sole option would be their
  // own base, which is refused. The destination list is a separate endpoint for
  // exactly this reason; it widens where stock may be *sent*, never where it
  // may be sent *from*.
  const destinations = useQuery({
    queryKey: ['bases', 'transfer-destinations'],
    queryFn: () => api.get<Base[]>('/catalogue/bases/transfer-destinations'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const equipment = useQuery({
    queryKey: ['equipment-types', 'all'],
    queryFn: () => api.get<EquipmentType[]>('/catalogue/equipment'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const [toBaseId, setToBaseId] = useState('');
  const [fromBaseId, setFromBaseId] = useState(isGlobal ? '' : String(baseId ?? ''));
  const [transferDate, setTransferDate] = useState(today());
  const [vehicleRef, setVehicleRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ key: 1, equipmentTypeId: '', quantity: '' }]);
  const [nextKey, setNextKey] = useState(2);

  const errors: string[] = [];
  if (!toBaseId) errors.push('Choose a receiving base.');
  if (isGlobal && !fromBaseId) errors.push('Choose a sending base.');
  if (!isGlobal && fromBaseId && Number(fromBaseId) !== baseId) errors.push('You can only transfer out of your own base.');
  if (toBaseId && Number(toBaseId) === Number(fromBaseId || baseId)) errors.push('A base cannot transfer to itself.');
  if (lines.length === 0) errors.push('Add at least one asset line.');
  for (const line of lines) {
    if (!line.equipmentTypeId) errors.push('Every line needs an equipment type.');
    if (!line.quantity || Number(line.quantity) <= 0) errors.push('Every line needs a quantity of at least 1.');
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.equipmentTypeId) {
      if (seen.has(line.equipmentTypeId)) errors.push('The same equipment type appears twice - combine the quantities.');
      seen.add(line.equipmentTypeId);
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Transfer>('/transfers', {
        // Left undefined for a base-scoped role so the server resolves it from
        // the token rather than trusting anything the client sends.
        ...(isGlobal ? { fromBaseId: Number(fromBaseId) } : {}),
        toBaseId: Number(toBaseId),
        transferDate,
        vehicleRef: vehicleRef.trim(),
        notes: notes.trim(),
        items: lines.map((line) => ({ equipmentTypeId: Number(line.equipmentTypeId), quantity: Number(line.quantity) })),
      }),
    onSuccess: (res) => {
      toast.success(`Transfer ${res.data.reference} raised. Stock is now in transit to ${res.data.to_base_code}.`);
      setToBaseId('');
      setVehicleRef('');
      setNotes('');
      setLines([{ key: nextKey, equipmentTypeId: '', quantity: '' }]);
      setNextKey((key) => key + 1);
      onClose();
      void queryClient.invalidateQueries();
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (errors.length > 0) return;
    mutation.mutate();
  };

  // Never offer the base the stock is leaving from as a destination.
  const chosenFrom = isGlobal ? Number(fromBaseId || 0) : (baseId ?? 0);
  const otherBases = rowsOf(destinations).filter((base) => base.id !== chosenFrom);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Raise an inter-base transfer"
      description="Posts an outbound movement immediately. The receiving base must confirm receipt before the stock is counted as arrived."
      busy={mutation.isPending}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSubmit} disabled={mutation.isPending || errors.length > 0}>
            {mutation.isPending ? <Spinner /> : <Icon.Transfer className="h-4 w-4" />}
            Raise transfer
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {mutation.isError ? <InlineError message={(mutation.error as Error).message} /> : null}

        {errors.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
            <ul className="list-inside list-disc space-y-0.5">
              {[...new Set(errors)].map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="t-from">From base</label>
            {isGlobal ? (
              <select id="t-from" className="input" value={fromBaseId} onChange={(e) => setFromBaseId(e.target.value)}>
                <option value="">Sending base</option>
                {(rowsOf(bases)).map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.code} &middot; {base.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input id="t-from" className="input opacity-60" value={`${user?.baseCode} \u00b7 ${user?.baseName}`} readOnly />
                <p className="mt-1 text-[0.7rem] text-ink-500">Taken from your credentials, not the request.</p>
              </>
            )}
          </div>

          <div>
            <label className="label" htmlFor="t-to">To base</label>
            <select id="t-to" className="input" value={toBaseId} onChange={(e) => setToBaseId(e.target.value)}>
              <option value="">Receiving base</option>
              {otherBases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.code} &middot; {base.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="t-date">Dispatch date</label>
            <input id="t-date" type="date" className="input" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="t-vehicle">Vehicle / transport reference</label>
            <input id="t-vehicle" className="input" value={vehicleRef} onChange={(e) => setVehicleRef(e.target.value)} maxLength={100} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Assets being moved</span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setLines((current) => [...current, { key: nextKey, equipmentTypeId: '', quantity: '' }]);
                setNextKey((key) => key + 1);
              }}
            >
              <Icon.Plus className="h-3.5 w-3.5" />
              Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={line.key} className="flex items-end gap-2 rounded-lg border border-ink-700/70 bg-ink-900/40 p-2.5">
                <div className="min-w-0 flex-1">
                  <label className="label text-[0.65rem]" htmlFor={`t-eq-${line.key}`}>
                    Equipment
                  </label>
                  <select
                    id={`t-eq-${line.key}`}
                    className="input"
                    value={line.equipmentTypeId}
                    onChange={(e) =>
                      setLines((current) => current.map((item) => (item.key === line.key ? { ...item, equipmentTypeId: e.target.value } : item)))
                    }
                  >
                    <option value="">Select a type</option>
                    {(rowsOf(equipment)).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} &middot; {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="label text-[0.65rem]" htmlFor={`t-qty-${line.key}`}>
                    Quantity
                  </label>
                  <input
                    id={`t-qty-${line.key}`}
                    type="number"
                    min={1}
                    step={1}
                    className="input num"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((current) => current.map((item) => (item.key === line.key ? { ...item, quantity: e.target.value } : item)))
                    }
                  />
                </div>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm mb-0.5"
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Icon.Close className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-notes">Notes</label>
          <textarea id="t-notes" className="input min-h-[4rem]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- detail -- */

function TransferDetail({ transfer, onClose }: { transfer: Transfer | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['transfers', 'detail', transfer?.id],
    queryFn: () => api.get<Transfer>(`/transfers/${transfer?.id}`),
    enabled: Boolean(transfer?.id),
  });

  if (!transfer) return null;

  const full = query.data?.data ?? transfer;

  return (
    <Modal open={Boolean(transfer)} onClose={onClose} title={`Transfer ${full?.reference ?? ''}`} size="lg" description={full ? STATUS_HELP[full.status] : undefined}>
      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-ink-400" />
        </div>
      ) : full ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            {[
              ['From', `${full.from_base_code} \u00b7 ${full.from_base_name}`],
              ['To', `${full.to_base_code} \u00b7 ${full.to_base_name}`],
              ['Dispatched', date(full.transfer_date)],
              ['Received', date(full.received_date)],
              ['Status', full.status],
              ['Transport', full.vehicle_ref || '-'],
              ['Lines', qty(full.line_count)],
              ['Total units', qty(full.total_quantity)],
            ].map(([term, value]) => (
              <div key={term}>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">{term}</dt>
                <dd className="mt-0.5 break-words text-ink-100">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="overflow-hidden rounded-lg border border-ink-700/70">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-700/70">
                  <th className="th">Equipment</th>
                  <th className="th text-right">Dispatched</th>
                  <th className="th text-right">Received</th>
                </tr>
              </thead>
              <tbody>
                {(full.items ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-ink-800/60 last:border-0">
                    <td className="td">
                      <span className="font-medium text-ink-100">{item.equipment_name}</span>
                      <span className="ml-2 font-mono text-[0.7rem] text-ink-500">{item.equipment_code}</span>
                    </td>
                    <td className="td num text-right">{qty(item.quantity)}</td>
                    <td className="td num text-right">{item.quantity_received === null ? '-' : qty(item.quantity_received)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {full.notes ? <div className="rounded-lg bg-ink-900/60 p-3 text-sm text-ink-300">{full.notes}</div> : null}
          <p className="text-[0.7rem] text-ink-500">Raised by {full.created_by_username} on {date(full.created_at)}.</p>
        </div>
      ) : (
        <p className="text-sm text-ink-400">Transfer not found.</p>
      )}
    </Modal>
  );
}
