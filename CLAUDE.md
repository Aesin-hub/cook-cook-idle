# Cooking Fantasy — Claude Code Context

## Projet
Jeu idle / crafting / gestion en heroic fantasy inspiré de Dungeon Meshi.
Boucle de gameplay en 3 couches : **Récolte → Craft → Cook**.
Développement solo. Cible : web + mobile (Capacitor).

---

## Stack technique
| Couche | Technologie |
|---|---|
| Front | React + Vite + TypeScript + Tailwind CSS v3 |
| Composants | shadcn/ui |
| State | Zustand (avec persist middleware → localStorage) |
| Backend | Supabase (auth + sauvegarde cloud) |
| Mobile | Capacitor |

---

## Structure du projet
```
src/
├── data/             ← TOUTES les données du jeu en JSON (ne jamais coder en dur)
│   ├── resources.json
│   ├── regions.json
│   ├── craft-recipes.json
│   ├── cook-recipes.json
│   └── index.ts      ← point d'entrée unique pour importer les données
├── types/            ← types TypeScript
│   ├── game.ts       ← Resource, Region, CraftRecipe, CookRecipe
│   ├── harvest.ts    ← Camp, Expedition, HarvestYield
│   └── craft.ts      ← CraftJob, CraftResult
├── stores/           ← stores Zustand (persistés localStorage)
│   ├── useHarvestStore.ts   ← camp, expéditions, tick(), offline progress
│   ├── useInventoryStore.ts ← resources: Record<string, number>
│   └── useCraftStore.ts     ← file d'attente craft, XP, craftedOnce
├── hooks/
│   ├── useGameLoop.ts       ← tick 1s (harvest + craft), monté une seule fois dans App.tsx
│   └── useOfflineProgress.ts ← calcul unique au chargement, retourne OfflineProgressDisplay
├── pages/
│   ├── HarvestPage.tsx
│   ├── CraftPage.tsx
│   └── InventoryPage.tsx
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx     ← wrapper global fond + nav
│   │   └── BottomNav.tsx    ← navigation 5 onglets fixe en bas
│   ├── shared/
│   │   ├── ProgressBar.tsx  ← barre réutilisable avec glow néon
│   │   ├── Tooltip.tsx      ← hover desktop + tap long mobile
│   │   ├── ToastManager.tsx ← toasts auto 3s + hook useToast()
│   │   └── OfflineModal.tsx ← modal retour joueur
│   ├── harvest/
│   │   ├── RegionCard.tsx
│   │   ├── CampPanel.tsx
│   │   ├── ExpeditionSlot.tsx
│   │   └── ExpeditionModal.tsx
│   ├── craft/
│   │   ├── RecipeCard.tsx
│   │   ├── IngredientRow.tsx
│   │   ├── CraftQueueBar.tsx  ← position: fixed, visible sur tous les onglets
│   │   └── XpBadge.tsx
│   └── inventory/
│       ├── InventoryFilters.tsx
│       ├── ResourceRow.tsx
│       └── InventorySummary.tsx
└── lib/
    ├── utils.ts         ← utilitaires shadcn
    └── craftHelpers.ts  ← canAffordRecipe, getMissingReason, formatCraftTime
```

---

## Design system

### Thème
Fond bleu nuit profond + accents néon vifs. Mobile-first.

### Couleurs (tokens Tailwind disponibles)
```
cf-bg       #0d1117   fond principal
cf-surface  #161b22   cartes / panneaux
cf-elevated #1c2333   modals / dropdowns
cf-hover    #21262d   états hover

cf-harvest  #00d2ff   cyan  — tout ce qui concerne la récolte
cf-craft    #bf5af2   violet — craft / transformation
cf-cook     #ff9500   orange — cook / cuisine
cf-success  #30d158   vert  — succès / complétion
cf-xp       #ffd500   or    — XP / rareté / inventaire
cf-danger   #ff453a   rouge — erreur / stock insuffisant
cf-muted    #636e8a   gris  — inactif / labels
cf-text     #e2e8f0   texte principal
cf-text-dim #8b949e   texte secondaire
```

### Règles UI impératives
- Couleur encode toujours le contexte gameplay (cyan = récolte, violet = craft, orange = cook)
- Navigation fixe en bas — 5 onglets, tout accessible en 1 clic
- Zéro scroll sur les écrans principaux (sauf Inventaire qui est une liste)
- Jamais d'ID technique visible dans l'UI — toujours `emoji + name`
- Tooltips sur toutes les ressources et recettes (champ `tooltip` des JSON)
- Progress bars avec box-shadow néon (showGlow)

---

## Règles de développement

### Données
- **Jamais de données de jeu en dur dans le code** — tout passe par `src/data/`
- Les ressources de base sont dans `resources.json`
- Les ressources craftées (bouillon_base, farine, lingot_fer) n'ont pas d'entrée
  dans `resources.json` — elles sont détectées dynamiquement dans l'inventaire

### Stores Zustand
- Tous les stores sont persistés via `persist` middleware → localStorage
- Clés de persistence : `cooking-fantasy-harvest`, `cooking-fantasy-inventory`, `cooking-fantasy-craft`
- `useGameLoop` est monté **une seule fois** dans `App.tsx` — ne jamais en créer d'autres instances

### Système de récolte
- **Camp** : 1 seul actif, génère toutes les ressources d'une région à 100% du `baseYieldPerMin`
- **Expéditions** : max 3 simultanées, ciblent 1 ressource, rendement 60%, durées 15/30/60/120 min
- **Offline progress** : plafonné à 8h, calculé au chargement dans `useOfflineProgress`
- Annulation d'expédition : toujours possible, toujours sans pénalité

### Système de craft
- File d'attente illimitée, un craft à la fois
- Ingrédients débités au lancement (pas à la fin)
- `firstTimeFast: true` sur une recette → 3s la première fois seulement
- `craftedOnce` persisté pour que le bonus 3s ne se redéclenche pas
- Annulation toujours possible avec remboursement intégral

### Monétisation
- **Zéro p2w. Zéro microtransaction. Décision ferme et définitive.**
- Aucun slot premium, aucun token, aucun mur de progression payant
- `MAX_EXPEDITIONS` (3) augmente uniquement via progression en jeu
- La file de craft est illimitée — la durée est le coût, pas les slots

---

## Conventions de code

### Nommage
- Composants : PascalCase (`RegionCard.tsx`)
- Stores : camelCase avec préfixe `use` (`useHarvestStore.ts`)
- Types : PascalCase (`HarvestYield`)
- Constantes de config : SCREAMING_SNAKE_CASE (`OFFLINE_CAP_MS`)
- IDs des ressources : snake_case (`baie_rouge`, `cristal_sel`)

### Imports data
```typescript
// Toujours importer depuis src/data/index.ts
import { RESOURCES, REGIONS, CRAFT_RECIPES, COOK_RECIPES } from '../data'

// Jamais importer directement les JSON
// ❌ import resources from '../data/resources.json'
```

### Stores Zustand entre eux
```typescript
// Pour accéder à un autre store depuis un store (ex: useCraftStore → useInventoryStore)
// Utiliser .getState() — ne jamais utiliser les hooks React dans les stores
useInventoryStore.getState().addResources([...])
useInventoryStore.getState().removeResources([...])
```

### Styles
- Styles inline pour les valeurs dynamiques et les couleurs spécifiques
- Classes Tailwind pour les utilitaires standards (`flex`, `items-center`, `gap-2`, etc.)
- Jamais de fichiers CSS séparés sauf `index.css` pour les `@keyframes` globaux
- Border-radius standard : `10px` (cards) / `12px` (panneaux) / `16px` (modals) / `20px` (pills/badges)

---

## Tâches et workflow

Les prompts sont dans `tasks/prompts/`.
Le backlog est dans `tasks/backlog.md`.
Le sprint actif est dans `tasks/sprint.md`.

Quand un prompt est exécuté :
1. Mettre à jour `tasks/backlog.md` : passer le prompt de "En cours" à "Fait"
2. Vider `tasks/sprint.md` ou y mettre le prochain prompt actif

---

## État actuel du projet (à mettre à jour après chaque prompt)

### Prompts exécutés
- [x] 001 — Init projet
- [x] 002 — Données JSON
- [x] 003 — Timers idle
- [x] 004 — Craft system
- [x] 005 — UI Récolte
- [x] 006 — UI Craft
- [x] 007 — UI Inventaire
- [x] 008 — Sauvegarde Supabase
- [x] 009 — Données Cook (machines + furnace-levels + types)
- [x] 010 — Store Cook (useCookStore + gameLoop + offline)
- [x] 011 — UI Cook (CookPage + FurnaceCard + modals)
- [x] AUDIT — Audit Phase 1 & 2
- [x] 012 — Migration JSON → Supabase (6 tables game data)
- [x] 013 — Admin Panel (CRUD complet)
- [x] 013-bis — Migration stores Phase 2 → Phase 3 (types carte, multiplicateurs)
- [x] 014 — usePlayerStore (XP global + 6 classes × 10 niveaux)
- [x] 015 — Données carte 31×31 + créatures + admin carte
- [x] 016 — useMapStore (brouillard de guerre + déplacement + quotas)
- [x] 017 — Extension usePlayerStore (classModifiers, activeEvents, prestigeLevel)
- [x] 018 — useBestiaryStore + Edge Function boss-spawner
- [x] 019 — UI Carte (grille 31×31, pan/zoom, bottom sheet)
- [x] 020 — UI Classes & Profil (ProfilePage + ClassCard + FamiliarCollection)
- [x] AUDIT Phase 3
- [x] 021 — Craft Automatique (useCraftAutoStore + onglet Auto dans CraftPage)
- [x] 022 — Cahier de Recettes (CookbookPage + RecipeBookCard/Detail + bouton dans ProfilePage)

### Pages disponibles
- `HarvestPage` — onglet Récolte (camp + expéditions + offline modal)
- `CraftPage` — onglet Craft (recettes + file + XP)
- `CookPage` — onglet Cook (fourneaux + machines + lignes de production)
- `ProfilePage` — onglet Profil ⭐ (classes + familiers + debug panel + bouton Cahier de Recettes)
- `CookbookPage` — Cahier de Recettes (vraies recettes, filtres catégorie/cuisine, bottom sheet détail)
- `MapPage` — onglet Carte 🗺️ (grille 31×31, pan/zoom, bottom sheet, boss indicators)
- `AdminPage` — route `/admin` (CRUD régions / ressources / recettes / machines / créatures / carte)

### Stores disponibles
- `useHarvestStore` — camp, expéditions, tick(), offline progress
- `useInventoryStore` — resources: Record<string, number>
- `useCraftStore` — file d'attente craft, XP artisan → usePlayerStore
- `useCookStore` — fourneaux, machines, lignes production, XP cuisinier → usePlayerStore
- `usePlayerStore` — totalXp, classLevels, classXp, classModifiers, activeEvents, prestigeLevel
- `useMapStore` — playerTiles, campTravel, quotas journaliers, fog of war
- `useBestiaryStore` — capturedCreatureIds, activeFamiliarId, huntHistory, boss spawns
- `useGameDataStore` — données Supabase (regions, resources, recipes, machines, creatures, map)
- `useAuthStore` — user Supabase

### Composants Phase 3
```
src/components/
├── map/
│   ├── MapGrid.tsx          ← grille 31×31 avec pan/zoom (useCallback, memo)
│   ├── MapTile.tsx          ← tuile individuelle (memo() pour perf)
│   ├── TileInfoSheet.tsx    ← bottom sheet détail tuile
│   ├── BossIndicator.tsx    ← indicateur boss actif (timer 60s)
│   ├── CampTravelBar.tsx    ← barre de progression déplacement camp
│   └── MapSearchBar.tsx     ← recherche de tuile par coordonnée
└── profile/
    ├── PlayerHeader.tsx     ← identité + XP total + familier actif
    ├── ClassCard.tsx        ← card classe expandable (niveau + XP + bonus)
    ├── FamiliarCollection.tsx ← grille familiers (capturés/silhouettes)
    └── DebugPanel.tsx       ← sliders niveaux (DEV uniquement)
```

### Supabase
- Tables de sauvegarde : `player_saves`, `save_inventory`, `save_harvest`, `save_craft`, `save_map`, `save_bestiary` + RLS
- Tables de données de jeu : `game_regions`, `game_resources`, `game_craft_recipes`, `game_cook_recipes`, `game_machines`, `game_furnace_levels`, `game_creatures`, `game_map` + RLS
- Table boss spawns : `game_boss_spawns` (lecture publique, écriture service_role)
- Edge Function : `supabase/functions/boss-spawner/index.ts` (cron quotidien)
- Auth email activée, `VITE_ADMIN_EMAIL=lewis.bock@gmail.com`

### Ressource eau
- `eau` est dans la région `foret` (déplacée depuis `plaine` pour éviter le deadlock de progression)

### Prochaine étape
**Prompt 023 — Assets Manager (Supabase Storage + game_assets + AssetsAdmin + SpriteDropdown)**

---

## Phase 3 — Architecture (complète)

### Carte 31×31
- Centre : { x: 15, y: 15 }
- Types dans `src/types/map.ts`
- `TileCoord`, `TileRarity`, `TileDifficulty`, `TileBiome`, `TileCulture`
- Fonctions utilitaires : `tileDistance()`, `travelTimeMs()`, `getAdjacentTiles()` (4 cardinaux),
  `getTileCulture()`, `getTileRarity()`
- `getAllAdjacentTiles()` existe mais N'EST JAMAIS utilisé pour le dévoilement (diagonales exclues)

### Types Phase 3
- `src/types/map.ts` — `TileCoord`, `HarvestMultipliers`, `DEFAULT_HARVEST_MULTIPLIERS`, `MAP_CENTER`, `MAP_SIZE`
- `src/types/mapState.ts` — `TilePlayerState`, `CampTravel`, `TileVisibility`
- `src/types/tile.ts` — `TileStatic`, `TileDynamic`, `TILE_RARITY_COLORS`
- `src/types/creature.ts` — `Creature`, `CreatureDrop`, `HuntSuccessEntry`, `xpOnSuccess`, `xpOnFailure`
- `src/types/bestiary.ts` — `HuntResult`, `ActiveBoss`, `BestiaryState`
- `src/types/player.ts` — `ClassId`, `ClassModifier`, `ActiveEvent`

### Multiplicateurs de classes
- `HarvestMultipliers` dans `src/types/map.ts`
- `DEFAULT_HARVEST_MULTIPLIERS` : toutes les valeurs à 1.0 (neutre)
- Passés à `useGameLoop()` via `usePlayerStore.getHarvestMultipliers()`
- Planchers : `Math.max(0.1, ...)` sur tous les multiplicateurs

### Classes (src/data/classes.json)
- 6 classes : recolteur, artisan, cuisinier, explorateur, chasseur, erudit
- 10 niveaux chacune, XP requis : 50/150/350/700/1200/2000/3000/4500/6500/9000
- XP craft → classXp.artisan, XP cook → classXp.cuisinier, XP hunt → classXp.chasseur
- `useCraftStore` et `useCookStore` délèguent tout XP à `usePlayerStore.addXp()`
- `classModifiers`, `activeEvents`, `prestigeLevel` persistés dans `usePlayerStore`

### Règles carte importantes
- Fog of war : 4 états (`hidden` → `revealed` → `explored` → `discovered`)
- Déplacement camp : `removeCamp()` avant `isInTransit: true` → aucune production pendant le trajet
- Quotas : reset à minuit (`getMidnightToday()`) — pas de 24h glissantes
- Explorateur niv 1 : révèle la rareté des tuiles cardinales adjacentes sans les explorer

### Rétrocompatibilité
- `Camp.tileCoord` et `Expedition.tileCoord` sont optionnels
- `RegionId` existant continue de fonctionner
