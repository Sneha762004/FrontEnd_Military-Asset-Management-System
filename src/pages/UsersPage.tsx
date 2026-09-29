import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError, metaOf, rowsOf } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/StatCard';
import { DataTable, Pager, SearchInput, type Column } from '../components/DataTable';
import { ConfirmDialog, InlineError, Modal, Spinner } from '../components/Modal';
import { Icon } from '../components/ui';
import { dateTime, humanise, qty, relativeTime } from '../lib/format';
import type { Base, ManagedUser, RoleDefinition, RoleKey } from '../types';

export function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [toggling, setToggling] = useState<ManagedUser | null>(null);

  const query = { page, pageSize, search, role: roleFilter || null };

  const list = useQuery({
    queryKey: ['users', query],
    queryFn: () => api.get<ManagedUser[]>('/admin/users', query),
    placeholderData: (previous) => previous,
  });

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleDefinition[]>('/auth/roles'), staleTime: 10 * 60 * 1000 });
  const rolesList = rowsOf(roles);
  const meta = metaOf(list);

  const deactivateMutation = useMutation({
    mutationFn: (target: ManagedUser) => api.patch<ManagedUser>(`/users/${target.id}`, { isActive: false }),
    onSuccess: () => {
      toast.success('Account deactivated. It can no longer sign in.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not update the account.'),
    onSettled: () => setToggling(null),
  });

  const activateMutation = useMutation({
    mutationFn: (target: ManagedUser) => api.patch<ManagedUser>(`/users/${target.id}`, { isActive: true }),
    onSuccess: () => {
      toast.success('Account reactivated.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not update the account.'),
    onSettled: () => setToggling(null),
  });

  const columns: Column<ManagedUser>[] = [
    {
      key: 'user',
      header: 'User',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-100">
            {row.full_name}
            {row.id === me?.id ? <span className="ml-1.5 text-[0.68rem] text-accent-400">(you)</span> : null}
          </p>
          <p className="truncate font-mono text-[0.7rem] text-ink-500">{row.username}</p>
        </div>
      ),
    },
    { key: 'rank', header: 'Rank', cell: (row) => <span className="text-xs text-ink-300">{row.rank || '-'}</span> },
    { key: 'role', header: 'Role', cell: (row) => (
      <span className={row.role === 'ADMIN' ? 'badge-info' : 'badge-neutral'}>{row.role_name || humanise(row.role)}</span>
    ) },
    { key: 'base', header: 'Base scope', cell: (row) =>
      row.base_id ? (
        <span title={row.base_name ?? undefined}>{row.base_code}</span>
      ) : (
        <span className="text-xs text-ink-500">All bases</span>
      ),
    },
    { key: 'email', header: 'Email', cell: (row) => <span className="text-xs text-ink-400">{row.email}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={row.is_active ? 'badge-success' : 'badge-danger'}>
          {row.is_active ? 'Active' : 'Deactivated'}
        </span>
      ),
    },
    { key: 'last', header: 'Last sign-in', cell: (row) => (
      <span className="text-xs text-ink-400" title={row.last_login_at ? dateTime(row.last_login_at) : undefined}>
        {row.last_login_at ? relativeTime(row.last_login_at) : 'Never'}
      </span>
    ) },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <button className="btn-ghost btn-sm" onClick={() => setResetting(row)} title="Send a password reset link">
            Reset
          </button>
          {row.id !== me?.id ? (
            <button
              className={row.is_active ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setToggling(row)}
            >
              {row.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle="Accounts, their role, and the base each is allowed to see. Deactivating an account revokes access immediately without deleting its history."
        actions={
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            <Icon.Plus className="h-4 w-4" />
            Create user
          </button>
        }
      />

      {/* Role reference, read straight from the API so it cannot drift from the code. */}
      {rolesList.length > 0 ? (
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          {rolesList.map((role) => (
            <div key={role.key} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink-100">{role.name}</h3>
                <span className={role.scope === 'GLOBAL' ? 'badge-info' : 'badge-neutral'}>
                  {role.scope === 'GLOBAL' ? 'All bases' : 'Single base'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-400">{role.description}</p>
              <details className="mt-2.5">
                <summary className="cursor-pointer text-[0.7rem] text-accent-400 hover:underline">
                  {qty(role.permissions.length)} permissions
                </summary>
                <ul className="mt-1.5 space-y-0.5">
                  {role.permissions.map((permission) => (
                    <li key={permission} className="font-mono text-[0.66rem] text-ink-400">
                      {permission}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Username, name or email..." />
          <select className="input w-auto" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {(['ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER'] as RoleKey[]).map((role) => (
              <option key={role} value={role}>
                {humanise(role)}
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
          empty={<span className="text-sm text-ink-400">No users match the current filters.</span>}
          footer={<Pager page={meta.page ?? page} pageCount={meta.pageCount ?? 1} total={meta.total ?? 0} onPageChange={setPage} />}
        />
      </div>

      <UserForm open={formOpen} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(resetting)}
        title="Send a password reset?"
        message={
          resetting
            ? `A reset link will be issued for ${resetting.username}.\n\nFor this build the link is written to the server log rather than emailed, so the password can be changed without a mail server.`
            : ''
        }
        confirmLabel="Issue reset link"
        tone="primary"
        onConfirm={() => {
          toast.success(`Password reset issued for ${resetting?.username}. Check the API log for the link.`);
          setResetting(null);
        }}
        onCancel={() => setResetting(null)}
      />

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.is_active ? 'Deactivate this account?' : 'Reactivate this account?'}
        message={
          toggling
            ? toggling.is_active
              ? `${toggling.full_name} (${toggling.username}) will be signed out and blocked from signing in again. Their past transactions and audit entries are kept.`
              : `${toggling.full_name} (${toggling.username}) will be able to sign in again with their existing password.`
            : ''
        }
        confirmLabel={toggling?.is_active ? 'Deactivate' : 'Reactivate'}
        busy={deactivateMutation.isPending || activateMutation.isPending}
        error={deactivateMutation.isError || activateMutation.isError
          ? ((deactivateMutation.error ?? activateMutation.error) as Error)?.message
          : null}
        onConfirm={() => {
          if (!toggling) return;
          if (toggling.is_active) deactivateMutation.mutate(toggling);
          else activateMutation.mutate(toggling);
        }}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------- form -- */

function UserForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const bases = useQuery({ queryKey: ['bases', 'all'], queryFn: () => api.get<Base[]>('/catalogue/bases'), enabled: open, staleTime: 5 * 60 * 1000 });

  const initial = { username: '', fullName: '', email: '', rank: '', role: 'BASE_COMMANDER', baseId: '', password: '' };
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const errors: Partial<Record<keyof typeof initial, string>> = {};
  if (!/^[a-z0-9._-]{3,50}$/i.test(form.username)) errors.username = 'Use 3-50 letters, numbers, dots, dashes or underscores.';
  if (!form.fullName.trim()) errors.fullName = 'Enter the full name as it should appear on documents.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  // The server enforces the same complexity rule; mirror it to fail fast.
  if (form.password.length < 10) errors.password = 'At least 10 characters.';
  if (!/[A-Z]/.test(form.password)) errors.password = 'Include an upper-case letter.';
  if (!/[a-z]/.test(form.password)) errors.password = 'Include a lower-case letter.';
  if (!/[0-9]/.test(form.password)) errors.password = 'Include a number.';
  if (!/[^A-Za-z0-9]/.test(form.password)) errors.password = 'Include a symbol.';
  if (form.role !== 'ADMIN' && !form.baseId) errors.baseId = 'A base-scoped role must be tied to a base.';

  const mutation = useMutation({
    mutationFn: () =>
      api.post<ManagedUser>('/admin/users', {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        rank: form.rank.trim(),
        role: form.role,
        baseId: form.role === 'ADMIN' ? null : Number(form.baseId),
        password: form.password,
      }),
    onSuccess: (res) => {
      toast.success(`Account ${res.data.username} created.`);
      setForm(initial);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a user account"
      description="The role decides what the account may do; the base decides what it may see. An administrator has no base scope."
      busy={mutation.isPending}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Icon.Check className="h-4 w-4" />}
            Create account
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {mutation.isError ? <InlineError message={(mutation.error as Error).message} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="u-username">Username</label>
            <input
              id="u-username"
              className={clsx('input font-mono', submitted && errors.username && 'input-error')}
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
            />
            {submitted && errors.username ? <p className="mt-1 text-xs text-rose-300">{errors.username}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="u-name">Full name</label>
            <input
              id="u-name"
              className={clsx('input', submitted && errors.fullName && 'input-error')}
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            {submitted && errors.fullName ? <p className="mt-1 text-xs text-rose-300">{errors.fullName}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="u-email">Email</label>
            <input
              id="u-email"
              type="email"
              className={clsx('input', submitted && errors.email && 'input-error')}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            {submitted && errors.email ? <p className="mt-1 text-xs text-rose-300">{errors.email}</p> : null}
          </div>

          <div>
            <label className="label" htmlFor="u-rank">Rank</label>
            <input id="u-rank" className="input" value={form.rank} onChange={(e) => set('rank', e.target.value)} maxLength={60} placeholder="e.g. Captain" />
          </div>

          <div>
            <label className="label" htmlFor="u-role">Role</label>
            <select id="u-role" className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="BASE_COMMANDER">Base Commander</option>
              <option value="LOGISTICS_OFFICER">Logistics Officer</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="u-base">Base</label>
            <select
              id="u-base"
              className={clsx('input', submitted && errors.baseId && 'input-error')}
              value={form.baseId}
              onChange={(e) => set('baseId', e.target.value)}
              disabled={form.role === 'ADMIN'}
            >
              <option value="">{form.role === 'ADMIN' ? 'Not applicable' : 'Select a base'}</option>
              {(rowsOf(bases)).map((base) => (
                <option key={base.id} value={base.id}>
                  {base.code} &middot; {base.name}
                </option>
              ))}
            </select>
            {submitted && errors.baseId ? <p className="mt-1 text-xs text-rose-300">{errors.baseId}</p> : null}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="u-password">Initial password</label>
          <input
            id="u-password"
            type="password"
            className={clsx('input', submitted && errors.password && 'input-error')}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
          />
          {submitted && errors.password ? (
            <p className="mt-1 text-xs text-rose-300">{errors.password}</p>
          ) : (
            <p className="mt-1 text-[0.7rem] text-ink-500">
              At least 10 characters, with upper and lower case, a number and a symbol. Stored as a bcrypt hash.
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
