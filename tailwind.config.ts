import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'cf-bg':       '#0d1117',
        'cf-surface':  '#161b22',
        'cf-elevated': '#1c2333',
        'cf-hover':    '#21262d',
        // Accents — codés par boucle de gameplay
        'cf-harvest':  '#00d2ff',  // récolte (cyan néon)
        'cf-craft':    '#bf5af2',  // craft (violet)
        'cf-cook':     '#ff9500',  // cook (orange feu)
        'cf-success':  '#30d158',  // succès / complétion
        'cf-xp':       '#ffd500',  // XP / rarité (or vif)
        'cf-danger':   '#ff453a',  // erreur / stock insuffisant
        'cf-muted':    '#636e8a',  // inactif / labels secondaires
        // Texte
        'cf-text':     '#e2e8f0',
        'cf-text-dim': '#8b949e',
      },
      borderRadius: {
        'cf':    '10px',
        'cf-lg': '16px',
      },
    },
  },
  plugins: [],
}

export default config
