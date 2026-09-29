import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface Theme {
  compact: boolean;
  setCompact: (value: boolean) => void;
}

const STORAGE_KEY = 'milams.compact';
const ThemeContext = createContext<Theme | null>(null);

/** The only persisted UI preference. Server-side settings belong to the API. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [compact, setCompactState] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setCompact = useCallback((value: boolean) => {
    setCompactState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('compact', compact);
  }, [compact]);

  const value = useMemo(() => ({ compact, setCompact }), [compact, setCompact]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
