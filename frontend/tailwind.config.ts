import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#9436FE',
          dark: '#6C24C2',
          container: '#781FD6',
          light: '#F3E8FF',
        },
        surface: {
          DEFAULT: '#F8F9FA',
          low: '#f0f2f3',
          lowest: '#ffffff',
        },
        secondary: {
          DEFAULT: '#8D62C3',
          light: '#F3EDF7',
        },
        neutral: {
          DEFAULT: '#7C7482',
          light: '#EBE9EC',
          dark: '#48444B',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        tertiary: '#974700',
        success: '#2e7d32',
        warning: '#e65100',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
        elevated: '0 4px 16px rgba(148, 54, 254, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
