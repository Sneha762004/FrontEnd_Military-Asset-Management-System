import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { Icon, type IconName } from './ui';
import { initials, humanise } from '../lib/format';
import { ThemeToggle } from './ThemeToggle';
import type { Permission } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Hidden unless the signed-in principal holds this permission. */
  permission?: Permission;
  end?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: 'Dashboard', end: true },
      { to: '/ledger', label: 'Movement ledger', icon: 'Ledger' },
    ],
  },
  {
    section: 'Transactions',
    items: [
      { to: '/purchases', label: 'Purchases', icon: 'Cart', permission: 'purchase:read' },
      { to: '/transfers', label: 'Transfers', icon: 'Transfer', permission: 'transfer:read' },
      { to: '/assignments', label: 'Assignments', icon: 'Assign', permission: 'assignment:read' },
      { to: '/expenditures', label: 'Expenditures', icon: 'Trend', permission: 'expenditure:read' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/users', label: 'Users & roles', icon: 'Users', permission: 'user:read' },
      { to: '/audit', label: 'Audit log', icon: 'Shield', permission: 'audit:read' },
    ],
  },
];

export function AppLayout() {
  const { user, signOut, can, isGlobal } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Navigating on a phone should close the drawer.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const sections = useMemo(
    () =>
      NAV.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) })).filter(
        (group) => group.items.length > 0,
      ),
    [can],
  );

  return (
    <div className="flex min-h-full">
      {/* Scrim for the mobile drawer */}
      {navOpen ? (
        <div
          className="fixed inset-0 z-30 bg-ink-950/70 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-800 bg-panel/95 backdrop-blur transition-transform lg:static lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
            <Icon.Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-wide text-ink-100">MiL-AMS</p>
            <p className="truncate text-[0.68rem] uppercase tracking-wider text-ink-500">Asset Management</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {sections.map((group) => (
            <div key={group.section} className="mb-5">
              <p className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-ink-500">{group.section}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const IconComponent = Icon[item.icon];
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                            isActive
                              ? 'bg-accent-500/10 font-medium text-accent-400 ring-1 ring-inset ring-accent-500/25'
                              : 'text-ink-300 hover:bg-ink-800/50 hover:text-ink-100',
                          )
                        }
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold text-ink-100">
              {initials(user?.fullName ?? user?.username)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink-100">{user?.fullName ?? user?.username}</p>
              <p className="truncate text-[0.68rem] text-ink-500">
                {user?.role === 'ADMIN' ? 'System-wide' : (user?.baseCode ?? 'Unassigned')}
              </p>
            </div>
            <button className="btn-ghost btn-sm" onClick={signOut} title="Sign out" aria-label="Sign out">
              <Icon.Logout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-800 bg-field/85 px-4 py-3 backdrop-blur lg:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Icon.Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-300">
              Signed in as{' '}
              <span className="font-medium text-ink-100">
                {user?.rank ? `${user.rank} ` : ''}
                {user?.fullName}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'badge hidden sm:inline-flex',
                isGlobal ? 'badge-info' : 'badge-neutral',
              )}
            >
              <Icon.Building className="h-3 w-3" />
              {isGlobal ? 'All bases' : `${user?.baseCode} \u00b7 ${user?.baseName}`}
            </span>
            <span className="badge-neutral hidden md:inline-flex">{humanise(user?.role)}</span>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>

        <footer className="border-t border-ink-800 px-4 py-3 text-center text-[0.7rem] text-ink-600 lg:px-6">
          MiL-AMS &middot; Every transaction is written to an append-only movement ledger and an audit trail.
        </footer>
      </div>
    </div>
  );
}

/** Guard for routes the user lacks permission for. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <div className="mx-auto mb-3 w-fit rounded-full bg-rose-500/10 p-3 text-rose-400">
          <Icon.Lock className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-ink-100">Access denied</h2>
        <p className="mt-1.5 text-sm text-ink-400">
          Your role does not include <code className="text-ink-300">{permission}</code>. Ask an administrator if you need it.
        </p>
        <div className="mt-5 flex justify-center">
          <Link to="/" className="btn-primary btn-sm">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
