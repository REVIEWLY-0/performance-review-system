import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Design System colour tokens ──────────────────────────────────────
      // Each value maps to a CSS variable defined in globals.css.
      // Usage: bg-surface, text-on-surface, border-outline, etc.
      colors: {
        primary: {
          DEFAULT:   'var(--primary)',
          dim:       'var(--primary-dim)',
          'fixed-dim': 'var(--primary-fixed-dim)',
        },
        'on-primary': 'var(--on-primary)',

        surface: {
          DEFAULT:            'var(--surface)',
          dim:                'var(--surface-dim)',
          'container-lowest': 'var(--surface-container-lowest)',
          'container-low':    'var(--surface-container-low)',
          container:          'var(--surface-container)',
          'container-high':   'var(--surface-container-high)',
          'container-highest':'var(--surface-container-highest)',
          variant:            'var(--surface-variant)',
        },

        'on-surface': {
          DEFAULT: 'var(--on-surface)',
          variant: 'var(--on-surface-variant)',
        },

        outline: {
          DEFAULT: 'var(--outline)',
          variant: 'var(--outline-variant)',
        },

        error: {
          DEFAULT: 'var(--error)',
          on:      'var(--on-error)',
        },

        'secondary-container':    'var(--secondary-container)',
        'on-secondary-container': 'var(--on-secondary-container)',
        'tertiary-container':     'var(--tertiary-container)',
        'on-tertiary-container':  'var(--on-tertiary-container)',
      },

      // ── Typography tokens ────────────────────────────────────────────────
      fontFamily: {
        // Manrope — Display & Headline (editorial headings)
        display: ['var(--font-manrope)', 'sans-serif'],
        // Inter — Body & Labels (data-heavy content)
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
