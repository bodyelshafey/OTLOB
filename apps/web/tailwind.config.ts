import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#12bfe5',
          50: '#eefcff',
          100: '#dff7ff',
          600: '#0da3c4',
          700: '#0b84a0',
        },
        accent: {
          DEFAULT: '#ff8a3d',
          600: '#f26a15',
        },
        ink: '#0b2530',
      },
      fontFamily: {
        display: ['var(--font-cairo)', 'sans-serif'],
        body: ['var(--font-tajawal)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 8px 24px -8px rgba(11,37,48,0.12)',
        card: '0 4px 16px -4px rgba(18,191,229,0.18)',
      },
    },
  },
  plugins: [],
};
export default config;
