import { useTheme } from '../context/ThemeContext';
import { Icon } from './ui';

export function ThemeToggle() {
  const { compact, setCompact } = useTheme();
  return (
    <button
      className="btn-secondary btn-sm"
      onClick={() => setCompact(!compact)}
      title={compact ? 'Comfortable row spacing' : 'Denser row spacing'}
      aria-pressed={compact}
    >
      <Icon.Menu className="h-4 w-4" />
      <span className="hidden sm:inline">{compact ? 'Dense' : 'Roomy'}</span>
    </button>
  );
}
