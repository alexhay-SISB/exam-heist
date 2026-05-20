/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        heist: {
          dark: '#0a0a0f',
          black: '#000000',
          gold: '#FFD700',
          red: '#DC143C',
          neon: '#39FF14',
          purple: '#8A2BE2'
        }
      },
      fontFamily: {
        heist: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'flash': 'flash 0.3s ease-in-out 2'
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-10px)' },
          '75%': { transform: 'translateX(10px)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #FFD700' },
          '100%': { boxShadow: '0 0 20px #FFD700, 0 0 30px #FFD700' }
        },
        flash: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.3 }
        }
      }
    },
  },
  plugins: [],
}
