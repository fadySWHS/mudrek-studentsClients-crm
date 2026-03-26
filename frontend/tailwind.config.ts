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
          DEFAULT: '#007A82',
          dark: '#00464b',
          container: '#006066',
          light: '#e0f4f5',
        },
        surface: {
          DEFAULT: '#F8F9FA',
          low: '#f0f2f3',
          lowest: '#ffffff',
        },
        secondary: {
          DEFAULT: '#455A64',
          light: '#eceff1',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        tertiary: '#62330f',
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
        elevated: '0 4px 16px rgba(0,122,130,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
