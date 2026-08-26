/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b0d10',
          850: '#101318',
          800: '#151a21',
          700: '#1d232c',
          600: '#2a323e',
          500: '#3b4552',
        },
        paper: '#e8eaed',
        muted: '#8b96a5',
        accent: '#c9a227',
        ok: '#4a9d5f',
        warn: '#c98a27',
        bad: '#c95a4a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
