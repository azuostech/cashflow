import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1D9E75',
          dark: '#0F6E56'
        },
        secondary: '#378ADD',
        success: '#639922',
        warning: '#BA7517',
        danger: '#E24B4A',
        app: {
          bg: '#ffffff',
          muted: '#f8f9fa',
          text: '#1a1a1a',
          subtle: '#6b7280',
          border: '#e5e7eb'
        }
      },
      boxShadow: {
        card: '0 8px 24px rgba(17, 24, 39, 0.06)'
      }
    }
  },
  plugins: []
};

export default config;
