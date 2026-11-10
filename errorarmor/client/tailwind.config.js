/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#070d1a', 900: '#0b1220', 800: '#101a2e', 700: '#18243d', 600: '#243453', 500: '#33466b' },
        brand: { 400: '#5b9bff', 500: '#3b82f6', 600: '#2563eb' },
        ai: { 400: '#22d3ee', 500: '#8b5cf6' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'], mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
      keyframes: { scan: { '0%': { transform: 'translateY(-10%)' }, '100%': { transform: 'translateY(110%)' } }, rise: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } } },
      animation: { scan: 'scan 3.5s ease-in-out infinite alternate', rise: 'rise .35s ease-out both' },
    },
  },
  plugins: [],
};
