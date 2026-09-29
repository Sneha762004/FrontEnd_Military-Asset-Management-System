/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A muted, institutional palette. Colour is reserved for meaning here:
        // teal = stock in, amber = in transit / committed, rose = out of service.
        ink: {
          50: '#f5f7f8',
          100: '#e7ecee',
          200: '#c9d4d9',
          300: '#a1b3bc',
          400: '#718c99',
          500: '#52707f',
          600: '#3f5a67',
          700: '#344953',
          800: '#2d3e46',
          900: '#1b282e',
          950: '#101a1f',
        },
        field: '#0e1a1f',
        panel: '#16262d',
        accent: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        lift: '0 12px 40px -12px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
