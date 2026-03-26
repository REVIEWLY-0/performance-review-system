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

        // ── Stitch token names (dark-mode HSL vars, also usable in light) ──
        background: 'hsl(var(--background, var(--surface)))',
        foreground: 'hsl(var(--foreground, var(--on-surface)))',
        card: {
          DEFAULT:    'hsl(var(--card, var(--surface-container-lowest)))',
          foreground: 'hsl(var(--card-foreground, var(--on-surface)))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover, var(--surface-container-low)))',
          foreground: 'hsl(var(--popover-foreground, var(--on-surface)))',
        },
        border:     'hsl(var(--border, var(--outline-variant)))',
        input:      'hsl(var(--input,  var(--outline-variant)))',
        secondary: {
          DEFAULT:    'hsl(var(--secondary, var(--surface-container)))',
          foreground: 'hsl(var(--secondary-foreground, var(--on-surface)))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted, var(--surface-container-low)))',
          foreground: 'hsl(var(--muted-foreground, var(--on-surface-variant)))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent,  var(--surface-container)))',
          foreground: 'hsl(var(--accent-foreground, var(--on-surface)))',
        },
        ring:       'hsl(var(--ring, var(--primary)))',
        sidebar:    'hsl(var(--sidebar-bg,    var(--surface-container-highest)))',
        tableHover: 'hsl(var(--table-hover,   var(--surface-container-low)))',
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
