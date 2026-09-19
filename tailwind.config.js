/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/renderer/**/*.{html,js,ts,svelte}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          app: 'var(--color-bg-app)',
          surface: 'var(--color-bg-surface)',
          card: 'var(--color-bg-card)',
          border: 'var(--color-border)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius-base, 8px)',
      }
    },
  },
  plugins: [],
}
