# Prompt 002 — Modélisation données ressources & recettes

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Le projet est initialisé (prompt 001 exécuté).
Stack : React + Vite + TypeScript + Tailwind + Zustand.

Toutes les données du jeu doivent être dans des fichiers JSON/config dans `src/data/`.
**Jamais de données en dur dans le code.**

## Décisions de design (issues de l'analyse marché)
- **Tooltip sur chaque ressource et recette** : chaque entrée JSON a un champ
  `tooltip` court (1 phrase) affiché au survol dans l'UI. Les joueurs détestent
  ne pas comprendre ce qu'ils font — la documentation doit être inline, pas dans un wiki.
- **Premier craft rapide** : le champ `firstTimeFast` sur les recettes de craft
  permet de réduire le `craftTimeSeconds` à 3s pour la toute première fois
  qu'un joueur craft cette recette. Leçon "générosité perçue" — donner vite,
  puis laisser le rythme normal s'installer.
- **Zéro ressource "premium"** : aucune ressource ne sera obtainable uniquement
  via un achat. Toutes les raretés sont obtainable en jouant.
- **Rareté lisible** : le champ `rarityLabel` donne le nom affiché en français
  (Commun, Peu commun, Rare, Épique) indépendamment de l'ID technique.

## Objectif
Créer les fichiers de données de base du jeu :
- Les ressources récoltables (par région)
- Les recettes de craft (assemblage → transformation)
- Les recettes de cook (lignes de production avec ratios)
- Les types TypeScript correspondants

## Fichiers à créer

---

### `src/data/resources.json`

```json
{
  "resources": [
    {
      "id": "herbe", "name": "Herbe", "emoji": "🌿",
      "region": "foret", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 10,
      "tooltip": "Une herbe aromatique qui pousse partout en forêt. Base de nombreux bouillons."
    },
    {
      "id": "champignon", "name": "Champignon", "emoji": "🍄",
      "region": "foret", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 6,
      "tooltip": "Champignon des sous-bois. Saveur terreuse, idéal en soupe."
    },
    {
      "id": "baie_rouge", "name": "Baie Rouge", "emoji": "🍓",
      "region": "foret", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 8,
      "tooltip": "Petite baie acidulée. Apporte de la couleur et du goût aux desserts."
    },
    {
      "id": "bois", "name": "Bois", "emoji": "🪵",
      "region": "foret", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 5,
      "tooltip": "Bois de chauffe. Nécessaire pour alimenter les fours et braseros."
    },
    {
      "id": "pierre", "name": "Pierre", "emoji": "🪨",
      "region": "caverne", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 8,
      "tooltip": "Pierre brute extraite des cavernes. Utilisée pour construire des équipements."
    },
    {
      "id": "minerai_fer", "name": "Minerai de Fer", "emoji": "⛏️",
      "region": "caverne", "rarity": "uncommon", "rarityLabel": "Peu commun",
      "baseYieldPerMin": 3,
      "tooltip": "Minerai brut à fondre. Donne des lingots utiles pour les outils de cuisine."
    },
    {
      "id": "cristal_sel", "name": "Cristal de Sel", "emoji": "💎",
      "region": "caverne", "rarity": "uncommon", "rarityLabel": "Peu commun",
      "baseYieldPerMin": 4,
      "tooltip": "Sel cristallisé des profondeurs. Exhausteur de goût naturel et conservateur."
    },
    {
      "id": "slime", "name": "Slime", "emoji": "🟢",
      "region": "marais", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 7,
      "tooltip": "Substance gluante récoltée sur les slimes du marais. Épaississant culinaire unique."
    },
    {
      "id": "algue", "name": "Algue", "emoji": "🌱",
      "region": "marais", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 9,
      "tooltip": "Algue de marais riche en minéraux. Goût iodé, parfaite en bouillon."
    },
    {
      "id": "oeuf_grenouille", "name": "Œuf de Grenouille", "emoji": "🥚",
      "region": "marais", "rarity": "uncommon", "rarityLabel": "Peu commun",
      "baseYieldPerMin": 3,
      "tooltip": "Œufs gélatineux de grenouille des marais. Ingrédient rare pour recettes avancées."
    },
    {
      "id": "ble", "name": "Blé", "emoji": "🌾",
      "region": "plaine", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 10,
      "tooltip": "Blé doré des plaines. Base de la farine et de nombreuses pâtes."
    },
    {
      "id": "lait", "name": "Lait", "emoji": "🥛",
      "region": "plaine", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 5,
      "tooltip": "Lait frais des vaches des plaines. Onctueux, indispensable en pâtisserie."
    },
    {
      "id": "miel", "name": "Miel", "emoji": "🍯",
      "region": "plaine", "rarity": "uncommon", "rarityLabel": "Peu commun",
      "baseYieldPerMin": 3,
      "tooltip": "Miel des ruches sauvages. Sucrant naturel aux arômes floraux."
    },
    {
      "id": "eau", "name": "Eau", "emoji": "💧",
      "region": "plaine", "rarity": "common", "rarityLabel": "Commun",
      "baseYieldPerMin": 20,
      "tooltip": "Eau de source pure. Ingrédient de base de presque toutes les recettes."
    }
  ]
}
```

---

### `src/data/regions.json`

```json
{
  "regions": [
    {
      "id": "foret",
      "name": "Forêt des Elfes",
      "emoji": "🌲",
      "unlocked": true,
      "description": "Une forêt dense aux ressources variées.",
      "tooltip": "Ta région de départ. Herbes, champignons et bois y abondent.",
      "unlockCondition": null
    },
    {
      "id": "caverne",
      "name": "Cavernes de Fer",
      "emoji": "⛰️",
      "unlocked": false,
      "description": "Des grottes sombres riches en minerais.",
      "tooltip": "Débloque cette région pour accéder aux métaux et cristaux de sel.",
      "unlockCondition": "Craft 10 Bouillons de Base"
    },
    {
      "id": "marais",
      "name": "Marais des Slimes",
      "emoji": "🌿",
      "unlocked": false,
      "description": "Un marais trouble peuplé de créatures gluantes.",
      "tooltip": "Région mystérieuse. Les slimes y prospèrent, source d'ingrédients uniques.",
      "unlockCondition": "Craft 5 Lingots de Fer"
    },
    {
      "id": "plaine",
      "name": "Plaines Dorées",
      "emoji": "🌾",
      "unlocked": false,
      "description": "De vastes plaines agricoles au soleil.",
      "tooltip": "Les plaines fournissent blé, lait et miel en abondance.",
      "unlockCondition": "Cuisiner 1 Soupe aux Champignons"
    }
  ]
}
```

---

### `src/data/craft-recipes.json`

```json
{
  "craftRecipes": [
    {
      "id": "bouillon_base",
      "name": "Bouillon de Base",
      "emoji": "🍵",
      "description": "Un bouillon simple mais fondamental.",
      "tooltip": "La base de presque toutes les soupes. Rapide à préparer.",
      "inputs": [
        { "resourceId": "herbe",      "quantity": 2 },
        { "resourceId": "champignon", "quantity": 1 },
        { "resourceId": "eau",        "quantity": 3 }
      ],
      "output": { "resourceId": "bouillon_base", "quantity": 1 },
      "craftTimeSeconds": 10,
      "firstTimeFast": true,
      "xpReward": 5
    },
    {
      "id": "farine",
      "name": "Farine",
      "emoji": "🌾",
      "description": "De la farine obtenue en broyant du blé.",
      "tooltip": "Ingrédient de base pour les pâtes et pains. Simple à obtenir.",
      "inputs": [
        { "resourceId": "ble", "quantity": 3 },
        { "resourceId": "eau", "quantity": 1 }
      ],
      "output": { "resourceId": "farine", "quantity": 2 },
      "craftTimeSeconds": 8,
      "firstTimeFast": true,
      "xpReward": 4
    },
    {
      "id": "lingot_fer",
      "name": "Lingot de Fer",
      "emoji": "🔩",
      "description": "Un lingot fondu, utile pour les outils.",
      "tooltip": "Fond le minerai pour obtenir un métal pur. Nécessaire pour débloquer la région Marais.",
      "inputs": [
        { "resourceId": "minerai_fer", "quantity": 3 }
      ],
      "output": { "resourceId": "lingot_fer", "quantity": 1 },
      "craftTimeSeconds": 15,
      "firstTimeFast": true,
      "xpReward": 8
    }
  ]
}
```

---

### `src/data/cook-recipes.json`

```json
{
  "cookRecipes": [
    {
      "id": "gelee_slime",
      "name": "Gelée de Slime",
      "emoji": "🟢",
      "description": "Un dessert translucide aux reflets irisés. Spécialité des marais.",
      "tooltip": "Recette signature inspirée de Dungeon Meshi. Surprenante mais délicieuse.",
      "inspired": "Dungeon Meshi",
      "productionLine": [
        { "resourceId": "slime",       "perMin": 30 },
        { "resourceId": "cristal_sel", "perMin": 10 },
        { "resourceId": "baie_rouge",  "perMin": 20 }
      ],
      "optimalRatio": {
        "description": "3 slimes / 1 cristal de sel / 2 baies rouges",
        "ratios": [3, 1, 2]
      },
      "cookTimeSeconds": 20,
      "outputPerBatch": 1,
      "xpReward": 15,
      "unlocked": true
    },
    {
      "id": "soupe_champignons",
      "name": "Soupe aux Champignons des Cavernes",
      "emoji": "🍲",
      "description": "Une soupe fumante aux saveurs terreuses profondes.",
      "tooltip": "Recette emblématique des aventuriers des cavernes. Réconfortante et nourrissante.",
      "inspired": "Dungeon Meshi",
      "productionLine": [
        { "resourceId": "champignon",    "perMin": 30 },
        { "resourceId": "bouillon_base", "perMin": 10 },
        { "resourceId": "herbe",         "perMin": 20 }
      ],
      "optimalRatio": {
        "description": "3 champignons / 1 bouillon / 2 herbes",
        "ratios": [3, 1, 2]
      },
      "cookTimeSeconds": 25,
      "outputPerBatch": 1,
      "xpReward": 20,
      "unlocked": false
    },
    {
      "id": "pizza_fantastique",
      "name": "Pizza Fantastique",
      "emoji": "🍕",
      "description": "[PLACEHOLDER] Une pizza aux ingrédients magiques. Recette à affiner.",
      "tooltip": "Recette placeholder — sera remplacée par une vraie recette heroic fantasy.",
      "inspired": "placeholder",
      "productionLine": [
        { "resourceId": "farine",        "perMin": 30 },
        { "resourceId": "bouillon_base", "perMin": 90 },
        { "resourceId": "lait",          "perMin": 60 }
      ],
      "optimalRatio": {
        "description": "1 farine / 3 bouillons / 2 laits",
        "ratios": [1, 3, 2]
      },
      "cookTimeSeconds": 40,
      "outputPerBatch": 1,
      "xpReward": 30,
      "unlocked": false
    }
  ]
}
```

---

### `src/types/game.ts`

```typescript
export type RegionId = 'foret' | 'caverne' | 'marais' | 'plaine'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic'

export interface Resource {
  id: string
  name: string
  emoji: string
  region: RegionId
  rarity: Rarity
  rarityLabel: string          // Commun / Peu commun / Rare / Épique
  baseYieldPerMin: number
  tooltip: string              // Affiché au survol dans l'UI
}

export interface Region {
  id: RegionId
  name: string
  emoji: string
  unlocked: boolean
  description: string
  tooltip: string
  unlockCondition: string | null  // null = disponible dès le départ
}

export interface RecipeInput {
  resourceId: string
  quantity: number
}

export interface CraftRecipe {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  inputs: RecipeInput[]
  output: { resourceId: string; quantity: number }
  craftTimeSeconds: number
  firstTimeFast: boolean       // true = 3s la première fois (générosité perçue)
  xpReward: number
}

export interface ProductionStep {
  resourceId: string
  perMin: number
}

export interface CookRecipe {
  id: string
  name: string
  emoji: string
  description: string
  tooltip: string
  inspired: string
  productionLine: ProductionStep[]
  optimalRatio: {
    description: string
    ratios: number[]
  }
  cookTimeSeconds: number
  outputPerBatch: number
  xpReward: number
  unlocked: boolean
}
```

---

### `src/data/index.ts`

```typescript
import resourcesData from './resources.json'
import regionsData from './regions.json'
import craftRecipesData from './craft-recipes.json'
import cookRecipesData from './cook-recipes.json'

export const RESOURCES = resourcesData.resources
export const REGIONS = regionsData.regions
export const CRAFT_RECIPES = craftRecipesData.craftRecipes
export const COOK_RECIPES = cookRecipesData.cookRecipes
```

---

## Critères de succès
- [ ] Les 4 fichiers JSON existent dans `src/data/`
- [ ] Chaque ressource a un champ `tooltip` et `emoji` non vide
- [ ] Chaque recette de craft a `firstTimeFast: true` et un `tooltip`
- [ ] Chaque région a un `unlockCondition` (string ou null)
- [ ] `src/types/game.ts` compile sans erreur (`npm run build`)
- [ ] Aucune donnée de jeu en dur hors `src/data/`

## Notes pour la suite
- `firstTimeFast` sera lu par `useCraftStore` (prompt 004) : si c'est la première
  fois que le joueur craft cette recette, `craftTimeSeconds` est remplacé par 3s.
- Les conditions de déblocage des régions seront vérifiées par un futur store
  `useProgressStore` (Phase 3). Pour l'instant elles sont juste affichées dans l'UI.
