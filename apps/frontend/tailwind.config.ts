import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          purple: 'var(--color-brand-purple)',
          'purple-dark': 'var(--color-brand-purple-dark)',
          orange: 'var(--color-brand-orange)',
          blue: 'var(--color-brand-blue)',
          'blue-dark': 'var(--color-brand-blue-dark)',
          cyan: 'var(--color-brand-cyan)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
        },
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'app-bg': 'var(--color-app-bg)',
        sidebar: 'var(--color-sidebar)',
        ink: 'var(--color-ink)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
