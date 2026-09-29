import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Icon } from './ui';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Blocks backdrop/Escape dismissal while a write is in flight. */
  busy?: boolean;
}

const sizes: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', busy = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      // Keep focus inside the dialog: a keyboard user must not tab behind it.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the panel so screen readers announce the dialog.
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
      target?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-ink-700 bg-panel shadow-lift animate-slide-up sm:rounded-2xl',
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-700/70 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-100">{title}</h2>
            {description ? <div className="mt-1 text-xs text-ink-400">{description}</div> : null}
          </div>
          <button className="btn-ghost btn-sm -mr-1 shrink-0" onClick={onClose} disabled={busy} aria-label="Close dialog">
            <Icon.Close className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-700/70 px-5 py-4">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-200">
        <div className="whitespace-pre-line">{message}</div>
        {error ? <InlineError message={error} /> : null}
      </div>
    </Modal>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
      <Icon.Alert className="mt-px h-4 w-4 shrink-0" />
      <span className="whitespace-pre-line">{message}</span>
    </div>
  );
}

export function InlineSuccess({ message }: { message: string }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
      <Icon.Check className="mt-px h-4 w-4 shrink-0" />
      <span className="whitespace-pre-line">{message}</span>
    </div>
  );
}
