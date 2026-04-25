
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Override Slate scale with CSS variables using RGB channels for opacity support
        slate: {
          50: 'rgb(var(--c-slate-50) / <alpha-value>)',
          100: 'rgb(var(--c-slate-100) / <alpha-value>)',
          200: 'rgb(var(--c-slate-200) / <alpha-value>)',
          300: 'rgb(var(--c-slate-300) / <alpha-value>)',
          400: 'rgb(var(--c-slate-400) / <alpha-value>)',
          500: 'rgb(var(--c-slate-500) / <alpha-value>)',
          600: 'rgb(var(--c-slate-600) / <alpha-value>)',
          700: 'rgb(var(--c-slate-700) / <alpha-value>)',
          750: 'rgb(var(--c-slate-750) / <alpha-value>)',
          800: 'rgb(var(--c-slate-800) / <alpha-value>)',
          850: 'rgb(var(--c-slate-850) / <alpha-value>)',
          900: 'rgb(var(--c-slate-900) / <alpha-value>)',
          950: 'rgb(var(--c-slate-950) / <alpha-value>)',
        },
        // Override basic White/Black to flip in light mode
        white: 'rgb(var(--c-white) / <alpha-value>)',
        black: 'rgb(var(--c-black) / <alpha-value>)',

        // Map all primary semantic colors to CSS variables
        emerald: {
          400: 'rgb(var(--c-emerald-400) / <alpha-value>)',
          500: 'rgb(var(--c-emerald-500) / <alpha-value>)',
          600: 'rgb(var(--c-emerald-600) / <alpha-value>)',
          900: 'rgb(var(--c-emerald-900) / <alpha-value>)',
        },
        indigo: {
          300: 'rgb(var(--c-indigo-300) / <alpha-value>)',
          400: 'rgb(var(--c-indigo-400) / <alpha-value>)',
          500: 'rgb(var(--c-indigo-500) / <alpha-value>)',
          600: 'rgb(var(--c-indigo-600) / <alpha-value>)',
          900: 'rgb(var(--c-indigo-900) / <alpha-value>)',
        },
        sky: {
          300: 'rgb(var(--c-sky-300) / <alpha-value>)',
          400: 'rgb(var(--c-sky-400) / <alpha-value>)',
          500: 'rgb(var(--c-sky-500) / <alpha-value>)',
          600: 'rgb(var(--c-sky-600) / <alpha-value>)',
        },
        amber: {
          400: 'rgb(var(--c-amber-400) / <alpha-value>)',
          500: 'rgb(var(--c-amber-500) / <alpha-value>)',
          900: 'rgb(var(--c-amber-900) / <alpha-value>)',
        },
        yellow: {
          400: 'rgb(var(--c-yellow-400) / <alpha-value>)',
        },
        red: {
          400: 'rgb(var(--c-red-400) / <alpha-value>)',
          500: 'rgb(var(--c-red-500) / <alpha-value>)',
          900: 'rgb(var(--c-red-900) / <alpha-value>)',
        },

        // --- Semantic Tokens (The "Alias" Layer) ---
        app: {
          bg: {
            DEFAULT: 'rgb(var(--c-app-bg) / <alpha-value>)',
            deep: 'rgb(var(--c-app-bg-deep) / <alpha-value>)',
          },
        },
        txt: {
          primary: 'rgb(var(--c-txt-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-txt-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-txt-muted) / <alpha-value>)',
          'card-hover': 'rgb(var(--c-card-txt-hover) / <alpha-value>)',
        },
        surface: {
          bg: 'rgb(var(--c-surface-bg) / <alpha-value>)',
          hover: 'rgb(var(--c-surface-hover) / <alpha-value>)',
          alt: 'rgb(var(--c-surface-bg-alt) / <alpha-value>)',
          border: 'rgb(var(--c-surface-border) / <alpha-value>)',
          'border-hover': 'rgb(var(--c-surface-border-hover) / <alpha-value>)',
        },
        modal: {
          bg: {
            DEFAULT: 'rgb(var(--c-modal-bg) / <alpha-value>)',
            elevated: 'rgb(var(--c-modal-bg-elevated) / <alpha-value>)',
            recessed: 'rgb(var(--c-modal-bg-recessed) / <alpha-value>)',
          },
          border: 'rgb(var(--c-modal-border) / <alpha-value>)',
          backdrop: 'rgb(var(--c-modal-backdrop) / <alpha-value>)',
        },
        brand: {
          primary: 'rgb(var(--c-brand-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-brand-secondary) / <alpha-value>)',
        },
        status: {
          success: 'rgb(var(--c-status-success) / <alpha-value>)',
          info: 'rgb(var(--c-status-info) / <alpha-value>)',
          warning: 'rgb(var(--c-status-warning) / <alpha-value>)',
          danger: 'rgb(var(--c-status-danger) / <alpha-value>)',
        },
      },
      boxShadow: {
        'ui-soft': 'var(--shadow-soft)',
        'ui-floating': 'var(--shadow-floating)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
