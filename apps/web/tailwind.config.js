/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background layers
        bg: {
          base: '#0a0a0b',
          surface: '#111113',
          elevated: '#18181b',
          overlay: '#1f1f23',
        },
        // Border tones
        border: {
          subtle: '#1f1f23',
          default: '#27272a',
          muted: '#3f3f46',
        },
        // Text
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
          disabled: '#52525b',
        },
        // Accent — electric blue
        accent: {
          DEFAULT: '#3b82f6',
          dim: '#1d4ed8',
          hover: '#60a5fa',
          subtle: 'rgba(59,130,246,0.08)',
          ring: 'rgba(59,130,246,0.25)',
        },
        // Status
        success: { DEFAULT: '#22c55e', subtle: 'rgba(34,197,94,0.08)' },
        warning: { DEFAULT: '#f59e0b', subtle: 'rgba(245,158,11,0.08)' },
        danger: { DEFAULT: '#ef4444', subtle: 'rgba(239,68,68,0.08)' },
        info: { DEFAULT: '#06b6d4', subtle: 'rgba(6,182,212,0.08)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.4)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.4)',
        md: '0 4px 16px rgba(0,0,0,0.5)',
        lg: '0 8px 32px rgba(0,0,0,0.6)',
        inner: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast: '100ms',
        slow: '200ms',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 150ms ease-out',
        'slide-right': 'slideRight 150ms ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight: { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
