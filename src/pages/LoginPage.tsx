import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/ui';
import { InlineError, Spinner } from '../components/Modal';

/** Seeded demo accounts. Surfaced on the sign-in screen so the system can be
 *  evaluated without reading the seed script first. */
const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'Admin@12345', label: 'Administrator', scope: 'All bases' },
  { username: 'cmd.kilo', password: 'Commander@12345', label: 'Base Commander', scope: 'FWK-01 Forward' },
  { username: 'log.kilo', password: 'Logistics@12345', label: 'Logistics Officer', scope: 'FWK-01 Forward' },
];

export function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@12345');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (cause) {
      // The server returns one generic message for unknown users and wrong
      // passwords; do not leak which one it was.
      setError(cause instanceof ApiError ? cause.message : 'Sign-in failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-ink-700/70 bg-panel/80 shadow-lift lg:grid-cols-2">
        {/* Brand / explanation panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden border-r border-ink-700/70 bg-ink-900/60 p-8 lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'radial-gradient(circle at 80% 10%, rgba(14,165,233,0.18), transparent 55%), radial-gradient(circle at 10% 90%, rgba(16,185,129,0.12), transparent 50%)',
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
                <Icon.Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-ink-100">MiL-AMS</p>
                <p className="text-[0.7rem] uppercase tracking-widest text-ink-500">Asset Management System</p>
              </div>
            </div>
            <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight text-ink-100">
              Every asset accounted for, from purchase to final write-off.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-400">
              Purchases, inter-base transfers, assignments to personnel and expenditures are all recorded against an
              append-only movement ledger, so any balance on screen can be walked back to the documents that produced it.
            </p>
          </div>
          <ul className="relative mt-8 space-y-3 text-sm text-ink-300">
            {[
              ['Opening', 'Starting holding declared once per period'],
              ['Net movement', 'Purchases + transfers in - transfers out'],
              ['Closing', 'Opening + net movement - expended'],
              ['Available', 'Closing - assigned to personnel'],
            ].map(([term, description]) => (
              <li key={term} className="flex items-start gap-2.5">
                <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <span className="font-medium text-ink-100">{term}</span>
                  <span className="text-ink-500"> &mdash; {description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="p-7 sm:p-8">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
                <Icon.Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-ink-100">MiL-AMS</p>
                <p className="text-[0.7rem] uppercase tracking-widest text-ink-500">Asset Management System</p>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-ink-100">Sign in</h2>
          <p className="mt-1 text-sm text-ink-400">Use your issued credentials to continue.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {error ? <InlineError message={error} /> : null}

            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon.Lock className="h-4 w-4" />}
              {submitting ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>

          <div className="mt-7 border-t border-ink-700/70 pt-5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-500">Demo accounts</p>
            <div className="mt-2.5 space-y-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword(account.password);
                    setError(null);
                  }}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/40 px-3 py-2 text-left transition hover:border-accent-500/40 hover:bg-ink-800/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-ink-100">{account.username}</span>
                    <span className="block truncate text-[0.7rem] text-ink-500">{account.label}</span>
                  </span>
                  <span className="shrink-0 text-[0.68rem] text-ink-500 group-hover:text-accent-400">{account.scope}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-500">
              Each account sees a different slice of the system: the administrator spans all bases, the other two are
              restricted to FWK-01 and to their own role&rsquo;s operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
