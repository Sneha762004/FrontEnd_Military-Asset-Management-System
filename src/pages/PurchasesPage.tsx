import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError, metaOf, rowsOf } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PageHeader, StatGrid, StatCard } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { ConfirmDialog, InlineError, InlineSuccess, Modal, Spinner } from '../components/Modal';
import { Icon, statusTone } from '../components/ui';
import { date, money, plural, qty, today } from '../lib/format';
import type { Base, EquipmentType, Purchase } from '../types';

export function PurchasesPage() {
  const { can, isGlobal, baseId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [baseFilter, setBaseFilter] = useState<number | ''>(isGlobal ? '' : (baseId ?? ''));
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);

  const query = { page, pageSize, search, baseId: baseFilter === '' ? null : baseFilter, status: statusFilter || null };

  const list = useQuery({
    queryKey: ['purchases', query],
    queryFn: () => api.get<Purchase[]>('/purchases', query),
    placeholderData: (previous) => previous,
  });

  const bases = useQuery({ queryKey: ['bases', 'all'], queryFn: () => api.get<Base[]>('/catalogue/bases'), staleTime: 5 * 60 * 1000 });

  const meta = metaOf(list);
  const rows = rowsOf(list);
  const summary = (meta.summary ?? {}) as Record<string, number>;

  const cancelMutation = useMutation({
    mutationFn: (purchase: Purchase) => api.post<Purchase>(`/purchases/${purchase.id}/cancel`, { reason: 'Cancelled from the register' }),
    onSuccess: () => {
      toast.success('Purchase cancelled and its stock movement reversed.');
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Cancellation failed.'),
    onSettled: () => setCancelling(null),
  });

  const columns: Column<Purchase>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (row) => (
        <button className="num text-xs font-medium text-accent-400 hover:underline" onClick={() => setDetail(row)}>
          {row.reference}
        </button>
      ),
    },
    { key: 'date', header: 'Purchased', cell: (row) => date(row.purchase_date) },
    { key: 'base', header: 'Base', cell: (row) => <span title={row.base_name}>{row.base_code}</span> },
    { key: 'equipment', header: 'Equipment', cell: (row) => `${row.equipment_name}` },
    { key: 'category', header: 'Category', cell: (row) => <span className="badge-neutral text-[0.68rem]">{row.equipment_category.toLowerCase()}</span> },
    { key: 'qty', header: 'Qty', numeric: true, cell: (row) => qty(row.quantity) },
    { key: 'value', header: 'Value', numeric: true, cell: (row) => money(row.total_cost) },
    { key: 'supplier', header: 'Supplier', cell: (row) => <span className="text-xs text-ink-300">{row.supplier || '-'}</span> },
    { key: 'received', header: 'Received', cell: (row) => date(row.received_date) },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const tone = statusTone(row.status);
        return <span className={tone === 'neutral' ? 'badge-neutral' : tone}>{row.status.toLowerCase()}</span>;
      },
    },
    { key: 'by', header: 'Recorded by', cell: (row) => <span className="text-xs text-ink-400">{row.created_by_username}</span> },
    {
      key: 'actions',
      header: '',
      cell: (row) =>
        can('purchase:update') && row.status !== 'CANCELLED' ? (
          <button className="btn-danger btn-sm" onClick={() => setCancelling(row)}>
            Cancel
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase register"
        subtitle="Assets acquired into a base. A cancelled purchase writes a reversing movement rather than deleting the record."
        actions={
          can('purchase:create') ? (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Icon.Plus className="h-4 w-4" />
              Record purchase
            </button>
          ) : null
        }
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard label="Documents" value={qty(meta.total ?? 0)} hint="matching the filters" icon={<Icon.Cart className="h-5 w-5" />} />
        <StatCard label="Units received" value={qty(summary.total_quantity ?? 0)} hint="received documents only" accent="info" icon={<Icon.Box className="h-5 w-5" />} />
        <StatCard label="Value received" value={money(summary.total_value ?? 0)} accent="positive" icon={<Icon.Trend className="h-5 w-5" />} />
        <StatCard
          label="Awaiting receipt"
          value={plural(rows.filter((row) => row.status === 'DRAFT').length, 'order')}
          hint="drafts on this page"
          accent="warning"
          icon={<Icon.Clock className="h-5 w-5" />}
        />
      </StatGrid>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Reference, supplier, equipment..." />
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
            {['RECEIVED', 'CANCELLED'].map((status) => (
              <option key={status} value={status}>
                {status.toLowerCase()}
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
          <div className="ml-auto">
            <button className="btn-ghost btn-sm" onClick={() => void list.refetch()} disabled={list.isFetching}>
              <Icon.Refresh className={clsx('h-4 w-4', list.isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          onRowClick={setDetail}
          empty={<span className="text-sm text-ink-400">No purchases match the current filters.</span>}
          footer={
            <Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />
          }
        />
      </div>

      <PurchaseForm open={formOpen} onClose={() => setFormOpen(false)} />
      <PurchaseDetail purchase={detail} onClose={() => setDetail(null)} />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Cancel this purchase?"
        message={
          cancelling
            ? `${cancelling.reference} recorded ${plural(cancelling.quantity, 'unit')} of ${cancelling.equipment_name} into ${cancelling.base_code}.\n\nThe original stock movement is reversed and a cancelling entry is written to the ledger. The document is retained for audit.`
            : ''
        }
        confirmLabel="Cancel purchase"
        busy={cancelMutation.isPending}
        error={cancelMutation.isError ? ((cancelMutation.error as Error).message) : null}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling)}
        onCancel={() => setCancelling(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------- form -- */

function PurchaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isGlobal, baseId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const bases = useQuery({ queryKey: ['bases', 'all'], queryFn: () => api.get<Base[]>('/catalogue/bases'), enabled: open, staleTime: 5 * 60 * 1000 });
  const equipment = useQuery({
    queryKey: ['equipment-types', 'all'],
    queryFn: () => api.get<EquipmentType[]>('/catalogue/equipment'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const initial = {
    baseId: isGlobal ? '' : String(baseId ?? ''),
    equipmentTypeId: '',
    quantity: '',
    unitCost: '',
    supplier: '',
    contractRef: '',
    purchaseDate: today(),
    receivedDate: today(),
    notes: '',
  };

  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const errors: Partial<Record<keyof typeof initial, string>> = {};
  if (!form.baseId) errors.baseId = 'Choose a base.';
  if (!form.equipmentTypeId) errors.equipmentTypeId = 'Choose an equipment type.';
  if (!form.quantity || Number(form.quantity) <= 0) errors.quantity = 'Enter a quantity of at least 1.';
  if (!form.unitCost || Number(form.unitCost) < 0) errors.unitCost = 'Enter the unit cost.';
  if (form.receivedDate < form.purchaseDate) errors.receivedDate = 'Receipt cannot precede the purchase date.';

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Purchase>('/purchases', {
        baseId: Number(form.baseId),
        equipmentTypeId: Number(form.equipmentTypeId),
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        supplier: form.supplier.trim(),
        contractRef: form.contractRef.trim(),
        purchaseDate: form.purchaseDate,
        receivedDate: form.receivedDate,
        notes: form.notes.trim(),
      }),
    onSuccess: (res) => {
      toast.success(`Purchase ${res.data.reference} recorded. Stock has been added to the base.`);
      setForm(initial);
      onClose();
      void queryClient.invalidateQueries();
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate();
  };

  const total = Number(form.quantity || 0) * Number(form.unitCost || 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a purchase"
      description="Creates a purchase document and posts a PURCHASE movement to the ledger in the same transaction."
      busy={mutation.isPending}
      footer={
        <>
          <div className="mr-auto text-sm text-ink-300">
            Total <span className="num font-semibold text-ink-100">{money(total)}</span>
          </div>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Icon.Check className="h-4 w-4" />}
            Record purchase
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {mutation.isError ? <InlineError message={(mutation.error as Error).message} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-base">Base</label>
            <select
              id="p-base"
              className={clsx('input', submitted && errors.baseId && 'input-error')}
              value={form.baseId}
              onChange={(e) => set('baseId', e.target.value)}
              disabled={!isGlobal}
            >
              <option value="">{isGlobal ? 'Select a base' : 'Your base'}</option>
              {(rowsOf(bases)).map((base) => (
                <option key={base.id} value={base.id}>
                  {base.code} &middot; {base.name}
                </option>
              ))}
            </select>
            {submitted && errors.baseId ? <p className="mt-1 text-xs text-rose-300">{errors.baseId}</p> : null}
            {!isGlobal ? <p className="mt-1 text-[0.7rem] text-ink-500">Locked to your base by your role.</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="p-equipment">Equipment type</label>
            <select
              id="p-equipment"
              className={clsx('input', submitted && errors.equipmentTypeId && 'input-error')}
              value={form.equipmentTypeId}
              onChange={(e) => set('equipmentTypeId', e.target.value)}
            >
              <option value="">Select a type</option>
              {(rowsOf(equipment)).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} &middot; {item.name} ({item.unit})
                </option>
              ))}
            </select>
            {submitted && errors.equipmentTypeId ? <p className="mt-1 text-xs text-rose-300">{errors.equipmentTypeId}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="p-qty">Quantity</label>
            <input
              id="p-qty"
              type="number"
              min={1}
              step={1}
              className={clsx('input num', submitted && errors.quantity && 'input-error')}
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
            {submitted && errors.quantity ? <p className="mt-1 text-xs text-rose-300">{errors.quantity}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="p-cost">Unit cost</label>
            <input
              id="p-cost"
              type="number"
              min={0}
              step="0.01"
              className={clsx('input num', submitted && errors.unitCost && 'input-error')}
              value={form.unitCost}
              onChange={(e) => set('unitCost', e.target.value)}
            />
            {submitted && errors.unitCost ? <p className="mt-1 text-xs text-rose-300">{errors.unitCost}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="p-supplier">Supplier</label>
            <input id="p-supplier" className="input" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} maxLength={150} />
          </div>

          <div>
            <label className="label" htmlFor="p-contract">Contract reference</label>
            <input id="p-contract" className="input" value={form.contractRef} onChange={(e) => set('contractRef', e.target.value)} maxLength={100} />
          </div>

          <div>
            <label className="label" htmlFor="p-pdate">Purchase date</label>
            <input id="p-pdate" type="date" className="input" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="p-rdate">Date received</label>
            <input
              id="p-rdate"
              type="date"
              className={clsx('input', submitted && errors.receivedDate && 'input-error')}
              value={form.receivedDate}
              onChange={(e) => set('receivedDate', e.target.value)}
            />
            {submitted && errors.receivedDate ? <p className="mt-1 text-xs text-rose-300">{errors.receivedDate}</p> : null}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="p-notes">Notes</label>
          <textarea id="p-notes" className="input min-h-[4.5rem]" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} />
        </div>

        <InlineSuccess message="Stock is added to the base on the date received, and the document is locked afterwards." />
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- detail -- */

function PurchaseDetail({ purchase, onClose }: { purchase: Purchase | null; onClose: () => void }) {
  if (!purchase) return null;
  return (
    <Modal open onClose={onClose} title={`Purchase ${purchase.reference}`} size="md">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        {[
          ['Base', `${purchase.base_code} \u00b7 ${purchase.base_name}`],
          ['Equipment', purchase.equipment_name],
          ['Category', purchase.equipment_category.toLowerCase()],
          ['Quantity', `${qty(purchase.quantity)} ${purchase.equipment_unit}`],
          ['Unit cost', money(purchase.unit_cost)],
          ['Total', money(purchase.total_cost)],
          ['Supplier', purchase.supplier || '-'],
          ['Contract', purchase.contract_ref || '-'],
          ['Purchased', date(purchase.purchase_date)],
          ['Received', date(purchase.received_date)],
          ['Status', purchase.status],
          ['Recorded by', purchase.created_by_username],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">{term}</dt>
            <dd className="mt-0.5 break-words text-ink-100">{value}</dd>
          </div>
        ))}
      </dl>
      {purchase.notes ? (
        <div className="mt-4 rounded-lg bg-ink-900/60 p-3 text-sm text-ink-300">{purchase.notes}</div>
      ) : null}
    </Modal>
  );
}
