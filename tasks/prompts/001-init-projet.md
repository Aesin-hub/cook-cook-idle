# Prompt 001 — Init projet Cooking Fantasy

## Contexte
Nouveau projet de jeu web/mobile : **Cooking Fantasy** (nom de travail).
Jeu idle / crafting / gestion en heroic fantasy (inspiré Dungeon Meshi).
Développement solo. Zéro fichier existant — tout est à créer.

## Décisions de design (issues de l'analyse marché)
- **Zéro p2w, zéro microtransaction** — décision ferme et définitive. Aucun système
  de monnaie premium, de token, de loot box payante ou de mur de progression.
  Monétisation future = cosmétique uniquement (skins, thèmes visuels).
- **Thème visuel** : bleu nuit profond (`#0d1117`) + accents néon vifs.
  Couleurs codées par boucle : cyan = récolte, violet = craft, orange = cook.
- **Navigation fixe en bas** : 5 onglets (Récolte / Craft / Cook / Sac / Carte).
  Tout accessible en 1 clic. Zéro scroll inutile sur les écrans principaux.
- **Tailwind config** : étendre avec les tokens de couleur du design system CF
  dès l'init pour que tous les prompts suivants utilisent les mêmes valeurs.

## Objectif
Initialiser le projet complet avec la bonne stack et la bonne structure de dossiers,
prête pour le développement du jeu.

## Stack à installer
- **Vite + React** (template react-ts)
- **Tailwind CSS v3**
- **shadcn/ui** (init avec thème neutral, style default)
- **Zustand** (state management)

## Structure de dossiers à créer

```
cooking-fantasy/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   └── ui/          ← composants shadcn générés ici
│   ├── data/            ← fichiers JSON de config du jeu (ressources, recettes, etc.)
│   ├── stores/          ← stores Zustand
│   ├── hooks/
│   ├── pages/
│   ├── lib/
│   │   └── utils.ts     ← utilitaires shadcn
│   └── main.tsx
├── tasks/
│   ├── backlog.md
│   ├── sprint.md
│   └── prompts/
│       └── 001-init-projet.md
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Fichiers à créer

### `tailwind.config.ts`
Étendre la config Tailwind avec les tokens de couleur du design system :

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'cf-bg':        '#0d1117',
        'cf-surface':   '#161b22',
        'cf-elevated':  '#1c2333',
        'cf-hover':     '#21262d',
        // Accents — codés par boucle de gameplay
        'cf-harvest':   '#00d2ff',   // récolte (cyan néon)
        'cf-craft':     '#bf5af2',   // craft (violet)
        'cf-cook':      '#ff9500',   // cook (orange feu)
        'cf-success':   '#30d158',   // succès / complétion
        'cf-xp':        '#ffd500',   // XP / rarité (or vif)
        'cf-danger':    '#ff453a',   // erreur / stock insuffisant
        'cf-muted':     '#636e8a',   // inactif / labels secondaires
        // Texte
        'cf-text':      '#e2e8f0',
        'cf-text-dim':  '#8b949e',
      },
      borderRadius: {
        'cf': '10px',
        'cf-lg': '16px',
      },
    },
  },
  plugins: [],
}

export default config
```

### `tasks/backlog.md`
```markdown
# Backlog — Cooking Fantasy

## ✅ Fait
- 001 — Init projet (Vite + React + Tailwind + Zustand + shadcn)

## 🔄 En cours
_(vide)_

## 📋 À faire
- 002 — Modélisation données ressources (JSON config)
- 003 — Système de timers idle (récolte)
- 004 — Craft basique
- 005 — UI Récolte (page Forêt)
- 006 — UI Craft
- 007 — Sauvegarde Supabase
```

### `tasks/sprint.md`
```markdown
# Sprint actif

_(aucun sprint actif — en attente du prochain prompt)_
```

### `tasks/prompts/001-init-projet.md`
Copie de ce fichier prompt.

### `src/App.tsx`
Remplacer le contenu par défaut par :

```tsx
import { useGameLoop } from './hooks/useGameLoop'

function App() {
  useGameLoop()

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}
         className="flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2 text-cf-text">🍖 Cooking Fantasy</h1>
        <p className="text-cf-muted">Core loop en construction...</p>
      </div>
    </div>
  )
}

export default App
```

## Critères de succès
- [ ] `npm run dev` lance l'app sans erreur
- [ ] La page affiche "🍖 Cooking Fantasy" sur fond `#0d1117`
- [ ] Les classes Tailwind `text-cf-text`, `text-cf-harvest`, etc. fonctionnent
- [ ] La structure de dossiers `src/data/`, `src/stores/`, `src/pages/` existe
- [ ] Le dossier `tasks/` existe avec `backlog.md`, `sprint.md`, et `prompts/`
- [ ] Zustand est installé (visible dans `package.json`)
- [ ] Aucun composant de démo Vite ne subsiste
