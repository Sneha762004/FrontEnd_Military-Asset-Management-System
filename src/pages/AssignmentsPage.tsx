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
import { date, daysFromNow, plural, qty, today } from '../lib/format';
import type { Assignment, Base, EquipmentType, Personnel } from '../types';

const STATUS_HELP: Record<string, string> = {
  ACTIVE: 'All of the assigned quantity is still held by the personnel named on the document.',
  PARTIALLY_RETURNED: 'Some of the quantity has come back; the rest is still outstanding.',
  RETURNED: 'Everything issued has been returned to the base.',
  EXPENDED: 'The asset was consumed in the field and has been written off.',
  CANCELLED: 'The issue was reversed and the units returned to available stock.',
};

export function AssignmentsPage() {
  const { can, isGlobal, baseId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [baseFilter, setBaseFilter] = useState<number | ''>(isGlobal ? '' : (baseId ?? ''));
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [returning, setReturning] = useState<Assignment | null>(null);
  const [cancelling, setCancelling] = useState<Assignment | null>(null);

  const query = { page, pageSize, search, baseId: baseFilter === '' ? null : baseFilter, status: statusFilter || null };

  const list = useQuery({
    queryKey: ['assignments', query],
    queryFn: () => api.get<Assignment[]>('/assignments', query),
    placeholderData: (previous) => previous,
  });

  // The list response has no base list of its own, so the filter dropdown reads
  // the catalogue - the same source every other page uses.
  const bases = useQuery({
    queryKey: ['bases'],
    queryFn: () => api.get<Base[]>('/catalogue/bases'),
    enabled: isGlobal,
    staleTime: 300_000,
  });

  const meta = metaOf(list);
  const rows = rowsOf(list);
  const summary = (meta.summary ?? {}) as Record<string, number>;

  const cancelMutation = useMutation({
    mutationFn: (assignment: Assignment) => api.post<Assignment>(`/assignments/${assignment.id}/cancel`, { reason: 'Cancelled from the register' }),
    onSuccess: () => {
      toast.success('Assignment cancelled. The units are available again.');
      void queryClient.invalidateQueries();
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not cancel the assignment.'),
    onSettled: () => setCancelling(null),
  });

  const columns: Column<Assignment>[] = [
    { key: 'ref', header: 'Reference', cell: (row) => <span className="num text-xs text-ink-200">{row.reference}</span> },
    { key: 'date', header: 'Issued', cell: (row) => date(row.assigned_date) },
    { key: 'base', header: 'Base', cell: (row) => row.base_code },
    { key: 'personnel', header: 'Issued to', cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-100">{row.personnel_name}</p>
        <p className="truncate text-[0.7rem] text-ink-500">
          {row.personnel_rank} &middot; {row.service_number} &middot; {row.unit}
        </p>
      </div>
    ) },
    { key: 'equipment', header: 'Equipment', cell: (row) => (
      <div className="min-w-0">
        <p className="truncate">{row.equipment_name}</p>
        <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.equipment_code}</p>
      </div>
    ) },
    { key: 'qty', header: 'Issued', numeric: true, cell: (row) => qty(row.quantity) },
    { key: 'returned', header: 'Returned', numeric: true, cell: (row) => <span className="text-emerald-300">{qty(row.quantity_returned)}</span> },
    { key: 'expended', header: 'Written off', numeric: true, cell: (row) => <span className="text-amber-300">{qty(row.quantity_expended)}</span> },
    {
      key: 'outstanding',
      header: 'Outstanding',
      numeric: true,
      cell: (row) => <span className={row.quantity_outstanding > 0 ? 'font-semibold text-rose-300' : 'text-ink-500'}>{qty(row.quantity_outstanding)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const tone = statusTone(row.status);
        return (
          <span className={tone === 'neutral' ? 'badge-neutral' : tone} title={STATUS_HELP[row.status]}>
            {row.status.replace(/_/g, ' ').toLowerCase()}
          </span>
        );
      },
    },
    { key: 'due', header: 'Due', cell: (row) => date(row.due_date) },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {can('assignment:update') && row.quantity_outstanding > 0 && row.status !== 'CANCELLED' ? (
            <button className="btn-secondary btn-sm" onClick={() => setReturning(row)}>
              Return
            </button>
          ) : null}
          {can('assignment:update') && row.status === 'ACTIVE' && row.quantity_outstanding === row.quantity ? (
            <button className="btn-danger btn-sm" onClick={() => setCancelling(row)}>
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
        title="Assignments to personnel"
        subtitle="Assets issued to named individuals. They stay part of the base holding but are committed, so they cannot be transferred or re-issued."
        actions={
          can('assignment:create') ? (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Icon.Plus className="h-4 w-4" />
              Assign assets
            </button>
          ) : null
        }
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard label="Documents" value={qty(meta.total ?? 0)} icon={<Icon.Assign className="h-5 w-5" />} />
        <StatCard label="Active" value={plural(summary.active_count ?? 0, 'active assignment')} accent="warning" icon={<Icon.Clock className="h-5 w-5" />} />
        <StatCard label="Units outstanding" value={qty(summary.units_outstanding ?? 0)} accent="negative" icon={<Icon.Alert className="h-5 w-5" />} />
        <StatCard label="Units issued" value={qty(summary.units_issued ?? 0)} accent="positive" icon={<Icon.Check className="h-5 w-5" />} />
      </StatGrid>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Reference, service number or name..." />
          {isGlobal ? (
            <select className="input w-auto" value={baseFilter} onChange={(e) => { setBaseFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
              <option value="">All bases</option>
              {rowsOf(bases).map((base) => (
                <option key={base.id} value={base.id}>
                  {base.code}
                </option>
              ))}
            </select>
          ) : null}
          <select className="input w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {['ACTIVE', 'PARTIALLY_RETURNED', 'RETURNED', 'EXPENDED', 'CANCELLED'].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ').toLowerCase()}
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
          empty={<span className="text-sm text-ink-400">No assignments match the current filters.</span>}
          footer={<Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />}
        />
      </div>

      <AssignmentForm open={formOpen} onClose={() => setFormOpen(false)} />
      <ReturnDialog assignment={returning} onClose={() => setReturning(null)} />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Cancel this assignment?"
        message={
          cancelling
            ? `${cancelling.reference}: ${plural(cancelling.quantity, 'unit')} of ${cancelling.equipment_name} held by ${cancelling.personnel_name}.\n\nCancelling reverses the issue and returns the units to available stock. Confirm the assets are physically back at the base.`
            : ''
        }
        confirmLabel="Cancel assignment"
        busy={cancelMutation.isPending}
        error={cancelMutation.isError ? (cancelMutation.error as Error).message : null}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling)}
        onCancel={() => setCancelling(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------- form -- */

function AssignmentForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isGlobal, baseId, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const personnel = useQuery({
    queryKey: ['personnel', 'all'],
    queryFn: () => api.get<Personnel[]>('/catalogue/personnel'),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const equipment = useQuery({
    queryKey: ['equipment-types', 'all'],
    queryFn: () => api.get<EquipmentType[]>('/catalogue/equipment'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [personnelId, setPersonnelId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [assignedDate, setAssignedDate] = useState(today());
  const [dueDate, setDueDate] = useState(daysFromNow(30));
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  const errors: string[] = [];
  if (!equipmentTypeId) errors.push('Choose an equipment type.');
  if (!personnelId) errors.push('Choose the receiving member of personnel.');
  if (!quantity || Number(quantity) <= 0) errors.push('Enter a quantity of at least 1.');
  if (dueDate < assignedDate) errors.push('The due date cannot be before the issue date.');

  // Personnel are listed for the base the document will be raised against.
  const eligible = (rowsOf(personnel)).filter((person) => isGlobal || person.base_id === baseId);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Assignment>('/assignments', {
        equipmentTypeId: Number(equipmentTypeId),
        personnelId: Number(personnelId),
        quantity: Number(quantity),
        assignedDate,
        dueDate: dueDate || null,
        purpose: purpose.trim(),
        notes: notes.trim(),
      }),
    onSuccess: (res) => {
      toast.success(`Assignment ${res.data.reference} created. The units are now committed to ${res.data.personnel_name}.`);
      setEquipmentTypeId('');
      setPersonnelId('');
      setQuantity('');
      setPurpose('');
      setNotes('');
      onClose();
      void queryClient.invalidateQueries();
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (errors.length > 0) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign assets to personnel"
      description={`The units stay in ${user?.baseCode ?? 'your base'}'s holding but move to committed stock, so they cannot be transferred or issued again until returned.`}
      busy={mutation.isPending}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSubmit} disabled={mutation.isPending || errors.length > 0}>
            {mutation.isPending ? <Spinner /> : <Icon.Check className="h-4 w-4" />}
            Create assignment
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
            <label className="label" htmlFor="a-equipment">Equipment type</label>
            <select id="a-equipment" className="input" value={equipmentTypeId} onChange={(e) => setEquipmentTypeId(e.target.value)}>
              <option value="">Select a type</option>
              {(rowsOf(equipment)).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} &middot; {item.name} ({item.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="a-personnel">Issued to</label>
            <select id="a-personnel" className="input" value={personnelId} onChange={(e) => setPersonnelId(e.target.value)}>
              <option value="">Select personnel</option>
              {eligible.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.service_number} &middot; {person.rank} {person.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="a-qty">Quantity</label>
            <input id="a-qty" type="number" min={1} step={1} className="input num" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="a-date">Issue date</label>
            <input id="a-date" type="date" className="input" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="a-due">Due back</label>
            <input id="a-due" type="date" className="input" value={dueDate} min={assignedDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="a-purpose">Purpose</label>
            <input id="a-purpose" className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} placeholder="e.g. Unit training deployment" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="a-notes">Notes</label>
          <textarea id="a-notes" className="input min-h-[4rem]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- return -- */

function ReturnDialog({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post<Assignment>(`/assignments/${assignment?.id}/return`, { quantity: Number(quantity), returnedDate: today() }),
    onSuccess: (res) => {
      toast.success(`${res.data.quantity_returned} of ${res.data.quantity} returned. ${res.data.quantity_outstanding} still outstanding.`);
      setQuantity('');
      onClose();
      void queryClient.invalidateQueries();
    },
  });

  if (!assignment) return null;
  const requested = Number(quantity || 0);
  const invalid = requested <= 0 || requested > assignment.quantity_outstanding;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Record a return"
      description={`${assignment.reference} - ${assignment.personnel_name}`}
      busy={mutation.isPending}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={mutation.isPending || invalid}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner /> : <Icon.Check className="h-4 w-4" />}
            Record return
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.isError ? <InlineError message={(mutation.error as Error).message} /> : null}

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-ink-900/60 p-3 text-sm">
          <div>
            <p className="text-[0.68rem] uppercase tracking-wider text-ink-500">Issued</p>
            <p className="num mt-0.5 text-ink-100">{qty(assignment.quantity)} {assignment.equipment_unit}</p>
          </div>
          <div>
            <p className="text-[0.68rem] uppercase tracking-wider text-ink-500">Outstanding</p>
            <p className="num mt-0.5 font-semibold text-amber-300">{qty(assignment.quantity_outstanding)} {assignment.equipment_unit}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="r-qty">Quantity returning now</label>
          <input
            id="r-qty"
            type="number"
            min={1}
            max={assignment.quantity_outstanding}
            step={1}
            className={clsx('input num', invalid && 'input-error')}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={`Up to ${assignment.quantity_outstanding}`}
            autoFocus
          />
          {invalid && quantity !== '' ? (
            <p className="mt-1 text-xs text-rose-300">Enter between 1 and {assignment.quantity_outstanding}.</p>
          ) : (
            <button type="button" className="mt-1.5 text-xs text-accent-400 hover:underline" onClick={() => setQuantity(String(assignment.quantity_outstanding))}>
              Return everything outstanding
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
