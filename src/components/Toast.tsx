import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Icon } from './ui';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const tones: Record<ToastTone, { cls: string; icon: ReactNode }> = {
  success: { cls: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200', icon: <Icon.Check className="h-4 w-4" /> },
  error: { cls: 'border-rose-500/40 bg-rose-950/90 text-rose-200', icon: <Icon.Alert className="h-4 w-4" /> },
  info: { cls: 'border-ink-600 bg-ink-800/95 text-ink-100', icon: <Icon.Info className="h-4 w-4" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2" role="region" aria-label="Notifications">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={clsx(
                'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-lift backdrop-blur animate-slide-up',
                tones[toast.tone].cls,
              )}
            >
              <span className="mt-0.5 shrink-0">{tones[toast.tone].icon}</span>
              <span className="min-w-0 flex-1 break-words">{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
                <Icon.Close className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
