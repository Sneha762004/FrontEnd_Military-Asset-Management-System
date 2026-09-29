import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, metaOf, rowsOf } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PageHeader, StatGrid, StatCard } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { InlineError, Modal, Spinner } from '../components/Modal';
import { Icon } from '../components/ui';
import { date, plural, qty, today } from '../lib/format';
import type { Assignment, Base, EquipmentType, Expenditure } from '../types';

export function ExpendituresPage() {
  const { can, isGlobal, baseId } = useAuth();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [baseFilter, setBaseFilter] = useState<number | ''>(isGlobal ? '' : (baseId ?? ''));
  const [sourceFilter, setSourceFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Expenditure | null>(null);

  const query = { page, pageSize, search, baseId: baseFilter === '' ? null : baseFilter, source: sourceFilter || null };

  const list = useQuery({
    queryKey: ['expenditures', query],
    queryFn: () => api.get<Expenditure[]>('/expenditures', query),
    placeholderData: (previous) => previous,
  });

  const bases = useQuery({
    queryKey: ['bases'],
    queryFn: () => api.get<Base[]>('/catalogue/bases'),
    enabled: isGlobal,
    staleTime: 300_000,
  });

  const meta = metaOf(list);
  const rows = rowsOf(list);
  const summary = (meta.summary ?? {}) as Record<string, number>;

  const columns: Column<Expenditure>[] = [
    { key: 'ref', header: 'Reference', cell: (row) => <span className="num text-xs text-ink-200">{row.reference}</span> },
    { key: 'date', header: 'Date', cell: (row) => date(row.expended_date) },
    { key: 'base', header: 'Base', cell: (row) => row.base_code },
    { key: 'equipment', header: 'Equipment', cell: (row) => (
      <div className="min-w-0">
        <p className="truncate">{row.equipment_name}</p>
        <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.equipment_code}</p>
      </div>
    ) },
    { key: 'qty', header: 'Qty', numeric: true, cell: (row) => <span className="font-semibold text-rose-300">{qty(row.quantity)}</span> },
    {
      key: 'source',
      header: 'Source',
      cell: (row) => (
        <span className={clsx('badge', row.source === 'ASSIGNED' ? 'badge-warning' : 'badge-neutral')} title={
          row.source === 'ASSIGNED'
            ? 'Written off from an assignment held by personnel. Reduces both on-hand and committed stock.'
            : 'Written off straight from base stock.'
        }>
          {row.source === 'ASSIGNED' ? 'From assignment' : 'Direct'}
        </span>
      ),
    },
    {
      key: 'holder',
      header: 'Held by / assignment',
      cell: (row) =>
        row.source === 'ASSIGNED' ? (
          <div className="min-w-0">
            <p className="truncate text-xs text-ink-200">{row.assigned_to ?? '-'}</p>
            <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.assignment_reference}</p>
          </div>
        ) : (
          <span className="text-xs text-ink-500">Base stock</span>
        ),
    },
    { key: 'reason', header: 'Reason', cell: (row) => <span className="text-xs text-ink-300">{row.reason}</span> },
    { key: 'auth', header: 'Authorised by', cell: (row) => <span className="text-xs text-ink-400">{row.authorised_by || '-'}</span> },
    { key: 'by', header: 'Recorded by', cell: (row) => <span className="text-xs text-ink-400">{row.created_by_username}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Expenditures & write-offs"
        subtitle="Assets consumed, damaged or otherwise lost. An expenditure can come straight from base stock or be written off against an assignment already held by personnel."
        actions={
          can('expenditure:create') ? (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Icon.Plus className="h-4 w-4" />
              Record expenditure
            </button>
          ) : null
        }
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard label="Documents" value={qty(meta.total ?? 0)} icon={<Icon.Trend className="h-5 w-5" />} />
        <StatCard label="Units written off" value={qty(summary.units_written_off ?? 0)} accent="negative" icon={<Icon.Alert className="h-5 w-5" />} />
        <StatCard label="From base stock" value={plural(rows.filter((row) => row.source === 'DIRECT').length, 'row')} accent="neutral" icon={<Icon.Box className="h-5 w-5" />} />
        <StatCard label="From assignments" value={plural(rows.filter((row) => row.source === 'ASSIGNED').length, 'row')} accent="warning" icon={<Icon.Assign className="h-5 w-5" />} />
      </StatGrid>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Reference, reason or person..." />
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
          <select className="input w-auto" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
            <option value="">All sources</option>
            <option value="DIRECT">Direct from base</option>
            <option value="ASSIGNED">From an assignment</option>
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
          empty={<span className="text-sm text-ink-400">No expenditures match the current filters.</span>}
          footer={<Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />}
        />
      </div>

      <ExpenditureForm open={formOpen} onClose={() => setFormOpen(false)} />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `Expenditure ${detail.reference}` : ''} size="md">
        {detail ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {[
              ['Date', date(detail.expended_date)],
              ['Base', `${detail.base_code} \u00b7 ${detail.base_name}`],
              ['Equipment', detail.equipment_name],
              ['Quantity', `${qty(detail.quantity)} ${detail.equipment_unit}`],
              ['Source', detail.source === 'ASSIGNED' ? 'Written off from an assignment' : 'Direct from base stock'],
              ['Held by', detail.assigned_to ?? 'Base stock'],
              ['Assignment', detail.assignment_reference ?? '-'],
              ['Authorised by', detail.authorised_by || '-'],
              ['Recorded by', detail.created_by_username],
              ['Reason', detail.reason],
            ].map(([term, value]) => (
              <div key={term}>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">{term}</dt>
                <dd className="mt-0.5 break-words text-ink-100">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------- form -- */

function ExpenditureForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isGlobal, baseId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const equipment = useQuery({
    queryKey: ['equipment-types', 'all'],
    queryFn: () => api.get<EquipmentType[]>('/catalogue/equipment'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const [source, setSource] = useState<'DIRECT' | 'ASSIGNED'>('DIRECT');
  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expendedDate, setExpendedDate] = useState(today());
  const [reason, setReason] = useState('');
  const [authorisedBy, setAuthorisedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Only open assignments for this base can be written off against.
  const openAssignments = useQuery({
    queryKey: ['assignments', 'open', baseId],
    queryFn: () => api.get<Assignment[]>('/assignments', { status: 'ACTIVE', baseId: isGlobal ? undefined : (baseId ?? undefined), pageSize: 100 }),
    enabled: open && source === 'ASSIGNED',
    staleTime: 30 * 1000,
  });

  const selected = (rowsOf(openAssignments)).find((item) => item.id === Number(assignmentId));

  const errors: string[] = [];
  if (!equipmentTypeId) errors.push('Choose an equipment type.');
  if (!quantity || Number(quantity) <= 0) errors.push('Enter a quantity of at least 1.');
  if (source === 'ASSIGNED' && !assignmentId) errors.push('Choose the assignment the units were being held under.');
  if (!reason.trim()) errors.push('A reason is required so the write-off can be justified later.');

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Expenditure>('/expenditures', {
        equipmentTypeId: Number(equipmentTypeId),
        quantity: Number(quantity),
        source,
        ...(source === 'ASSIGNED' ? { assignmentId: Number(assignmentId) } : {}),
        expendedDate,
        reason: reason.trim(),
        authorisedBy: authorisedBy.trim(),
        notes: notes.trim(),
      }),
    onSuccess: (res) => {
      toast.success(`Expenditure ${res.data.reference} recorded. ${plural(res.data.quantity, 'unit')} removed from stock.`);
      setEquipmentTypeId('');
      setAssignmentId('');
      setQuantity('');
      setReason('');
      setAuthorisedBy('');
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
      title="Record an expenditure"
      description="Reduces the closing balance for the period. Writing off from an assignment also clears the commitment, so the units are not counted twice."
      busy={mutation.isPending}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSubmit} disabled={mutation.isPending || errors.length > 0}>
            {mutation.isPending ? <Spinner /> : <Icon.Check className="h-4 w-4" />}
            Record expenditure
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

        <fieldset>
          <legend className="label">Where does this come from?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['DIRECT', 'ASSIGNED'] as const).map((option) => (
              <label
                key={option}
                className={clsx(
                  'cursor-pointer rounded-lg border p-3 text-sm transition',
                  source === option ? 'border-accent-500/60 bg-accent-500/10 text-ink-100' : 'border-ink-700 text-ink-300 hover:border-ink-600',
                )}
              >
                <input
                  type="radio"
                  name="source"
                  value={option}
                  checked={source === option}
                  onChange={() => {
                    setSource(option);
                    if (option === 'DIRECT') setAssignmentId('');
                  }}
                  className="sr-only"
                />
                <span className="block font-medium">{option === 'DIRECT' ? 'Direct from base stock' : 'From an assignment'}</span>
                <span className="mt-0.5 block text-[0.7rem] text-ink-400">
                  {option === 'DIRECT'
                    ? 'Issued and written off in the same action. Reduces on-hand only.'
                    : 'Already held by personnel. Clears both the holding and the commitment.'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {source === 'ASSIGNED' ? (
          <div>
            <label className="label" htmlFor="e-assignment">Assignment</label>
            <select id="e-assignment" className="input" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              <option value="">Select an open assignment</option>
              {(rowsOf(openAssignments)).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.reference} &middot; {item.equipment_name} &middot; {item.personnel_name} ({item.quantity_outstanding} outstanding)
                </option>
              ))}
            </select>
            {selected ? (
              <p className="mt-1.5 text-[0.7rem] text-ink-500">
                At most {qty(selected.quantity_outstanding)} {selected.equipment_unit} can be written off under this assignment.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="e-equipment">Equipment type</label>
            <select
              id="e-equipment"
              className="input"
              value={equipmentTypeId}
              onChange={(e) => {
                setEquipmentTypeId(e.target.value);
                // The assignment already fixes the type; keep them in step.
                if (source === 'ASSIGNED' && selected) setEquipmentTypeId(String(selected.equipment_type_id));
              }}
              disabled={source === 'ASSIGNED'}
            >
              <option value="">Select a type</option>
              {(rowsOf(equipment)).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} &middot; {item.name}
                </option>
              ))}
            </select>
            {source === 'ASSIGNED' && selected ? (
              <p className="mt-1 text-[0.7rem] text-ink-500">Fixed by the selected assignment.</p>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="e-qty">Quantity</label>
            <input
              id="e-qty"
              type="number"
              min={1}
              step={1}
              max={source === 'ASSIGNED' ? selected?.quantity_outstanding : undefined}
              className="input num"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="e-date">Date</label>
            <input id="e-date" type="date" className="input" value={expendedDate} onChange={(e) => setExpendedDate(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="e-auth">Authorised by</label>
            <input id="e-auth" className="input" value={authorisedBy} onChange={(e) => setAuthorisedBy(e.target.value)} maxLength={150} placeholder="Rank and name" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="e-reason">Reason</label>
          <input id="e-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={250} placeholder="e.g. Written off after impact damage during training" />
        </div>

        <div>
          <label className="label" htmlFor="e-notes">Notes</label>
          <textarea id="e-notes" className="input min-h-[4rem]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
      </form>
    </Modal>
  );
}
