/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // `heist-*` token names preserved for backward compatibility across
        // components, but repointed to a sleek blue/violet palette.
        heist: {
          dark: '#0a0e1a',      // deep midnight blue (page bg)
          black: '#04060c',     // near-black with cool tint
          gold: '#a78bfa',      // PRIMARY — violet-400 (replaces gold)
          red: '#f43f5e',       // DANGER — rose-500
          neon: '#22d3ee',      // SUCCESS — cyan-400
          purple: '#c084fc'     // SECONDARY — purple-400
        },
        surface: {
          DEFAULT: '#0f172a',
          raised: '#1e293b',
          border: '#334155'
        },
        brand: {
          indigo: '#6366f1',
          violet: '#8b5cf6',
          fuchsia: '#d946ef',
          sky: '#38bdf8'
        }
      },
      fontFamily: {
        heist: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
        sans:  ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['"JetBrains Mono"', '"SFMono-Regular"', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shake':      'shake 0.5s ease-in-out',
        'glow':       'glow 2.4s ease-in-out infinite alternate',
        'flash':      'flash 0.3s ease-in-out 2',
        'shimmer':    'shimmer 3s linear infinite',
        'float':      'float 6s ease-in-out infinite'
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%':      { transform: 'translateX(-8px)' },
          '75%':      { transform: 'translateX(8px)' }
        },
        glow: {
          '0%':   { boxShadow: '0 0 12px rgba(167, 139, 250, 0.35)' },
          '100%': { boxShadow: '0 0 28px rgba(167, 139, 250, 0.7), 0 0 48px rgba(99, 102, 241, 0.4)' }
        },
        flash: {
          '0%, 100%': { opacity: 1 },
          '50%':      { opacity: 0.3 }
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' }
        }
      },
      backgroundImage: {
        'brand-gradient':         'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
        'brand-gradient-subtle':  'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 50%, rgba(217,70,239,0.15) 100%)'
      }
    },
  },
  plugins: [],
}
