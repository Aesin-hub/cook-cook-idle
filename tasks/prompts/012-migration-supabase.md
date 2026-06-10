# Prompt 012 — Migration JSON → Supabase (données du jeu)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 011 + AUDIT ont été exécutés. Phase 2.5.

Structure existante pertinente :
- `src/data/resources.json` — 14 ressources
- `src/data/regions.json` — 4 régions
- `src/data/craft-recipes.json` — 3 recettes de craft
- `src/data/cook-recipes.json` — 3 recettes de cook
- `src/data/machines.json` — 5 machines
- `src/data/furnace-levels.json` — 5 paliers
- `src/data/index.ts` — exports centralisés
- `src/lib/supabase.ts` — client Supabase existant

## Objectif
Migrer toutes les données de configuration du jeu (ressources, régions, recettes, machines)
des fichiers JSON locaux vers des tables Supabase dédiées.

Après ce prompt :
- Le jeu charge ses données de configuration depuis Supabase au démarrage
- Les fichiers JSON locaux restent en place comme **fallback** si Supabase est inaccessible
- Un hook `useGameData` expose les données de config à toute l'app
- L'admin panel (prompt 013) pourra modifier ces données en direct

## Décisions d'architecture

### Tables Supabase — données de jeu (lecture seule pour les joueurs)
```
game_regions       ← contenu de regions.json
game_resources     ← contenu de resources.json
game_craft_recipes ← contenu de craft-recipes.json
game_cook_recipes  ← contenu de cook-recipes.json
game_machines      ← contenu de machines.json
game_furnace_levels← contenu de furnace-levels.json
```

### Stratégie de chargement
- Au démarrage : `useGameData` charge toutes les tables en parallèle
- Si succès → données Supabase utilisées, stockées dans un store Zustand léger
- Si échec (réseau, etc.) → fallback sur les JSON locaux
- Les données sont **mises en cache** dans le store — pas de rechargement à chaque render

### RLS — données de jeu publiques
Les données de jeu sont **en lecture publique** (pas besoin d'être connecté pour les lire).
Seul l'admin peut écrire (géré via une policy admin en prompt 013).

### Schéma SQL — stocker le JSON tel quel
Chaque table a une colonne `data JSONB` qui contient l'objet complet.
C'est la stratégie la plus simple et la plus flexible pour un jeu en développement —
la structure peut évoluer sans migration de schéma.

---

## Prérequis — Script SQL à exécuter dans Supabase

Aller dans **SQL Editor** et exécuter :

```sql
-- Tables de données de jeu
CREATE TABLE game_regions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_resources (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_craft_recipes (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_cook_recipes (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_machines (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_furnace_levels (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : lecture publique, écriture admin uniquement
ALTER TABLE game_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_craft_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_cook_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_furnace_levels ENABLE ROW LEVEL SECURITY;

-- Lecture publique (joueurs non connectés inclus)
CREATE POLICY "Public read regions" ON game_regions FOR SELECT USING (true);
CREATE POLICY "Public read resources" ON game_resources FOR SELECT USING (true);
CREATE POLICY "Public read craft recipes" ON game_craft_recipes FOR SELECT USING (true);
CREATE POLICY "Public read cook recipes" ON game_cook_recipes FOR SELECT USING (true);
CREATE POLICY "Public read machines" ON game_machines FOR SELECT USING (true);
CREATE POLICY "Public read furnace levels" ON game_furnace_levels FOR SELECT USING (true);

-- Écriture admin (l'email admin sera défini dans le prompt 013)
-- Pour l'instant : écriture ouverte aux utilisateurs authentifiés
-- Sera restreint à l'admin dans le prompt 013
CREATE POLICY "Auth write regions" ON game_regions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write resources" ON game_resources FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write craft recipes" ON game_craft_recipes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write cook recipes" ON game_cook_recipes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write machines" ON game_machines FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write furnace levels" ON game_furnace_levels FOR ALL USING (auth.role() = 'authenticated');
```

---

## Fichiers à créer / modifier

---

### `src/lib/seedGameData.ts`

Script de seed — insère les données JSON dans Supabase.
À exécuter UNE SEULE FOIS après la création des tables.
Peut être relancé sans risque (upsert).

```typescript
import { supabase } from './supabase'
import resourcesData from '../data/resources.json'
import regionsData from '../data/regions.json'
import craftRecipesData from '../data/craft-recipes.json'
import cookRecipesData from '../data/cook-recipes.json'
import machinesData from '../data/machines.json'
import furnaceLevelsData from '../data/furnace-levels.json'

/**
 * Insère toutes les données de jeu dans Supabase.
 * Utilise upsert — peut être relancé sans risque.
 * À appeler depuis la console du navigateur ou un script de dev.
 */
export async function seedGameData(): Promise<void> {
  console.log('[Seed] Début de la migration des données de jeu...')

  // Régions
  const regions = regionsData.regions.map((r) => ({ id: r.id, data: r }))
  const { error: regionsError } = await supabase
    .from('game_regions')
    .upsert(regions, { onConflict: 'id' })
  if (regionsError) console.error('[Seed] Régions:', regionsError.message)
  else console.log(`[Seed] ✅ ${regions.length} régions migrées`)

  // Ressources
  const resources = resourcesData.resources.map((r) => ({ id: r.id, data: r }))
  const { error: resourcesError } = await supabase
    .from('game_resources')
    .upsert(resources, { onConflict: 'id' })
  if (resourcesError) console.error('[Seed] Ressources:', resourcesError.message)
  else console.log(`[Seed] ✅ ${resources.length} ressources migrées`)

  // Recettes de craft
  const craftRecipes = craftRecipesData.craftRecipes.map((r) => ({ id: r.id, data: r }))
  const { error: craftError } = await supabase
    .from('game_craft_recipes')
    .upsert(craftRecipes, { onConflict: 'id' })
  if (craftError) console.error('[Seed] Craft recipes:', craftError.message)
  else console.log(`[Seed] ✅ ${craftRecipes.length} recettes craft migrées`)

  // Recettes de cook
  const cookRecipes = cookRecipesData.cookRecipes.map((r) => ({ id: r.id, data: r }))
  const { error: cookError } = await supabase
    .from('game_cook_recipes')
    .upsert(cookRecipes, { onConflict: 'id' })
  if (cookError) console.error('[Seed] Cook recipes:', cookError.message)
  else console.log(`[Seed] ✅ ${cookRecipes.length} recettes cook migrées`)

  // Machines
  const machines = machinesData.machines.map((m) => ({ id: m.id, data: m }))
  const { error: machinesError } = await supabase
    .from('game_machines')
    .upsert(machines, { onConflict: 'id' })
  if (machinesError) console.error('[Seed] Machines:', machinesError.message)
  else console.log(`[Seed] ✅ ${machines.length} machines migrées`)

  // Paliers fourneaux (id séquentiel)
  const furnaceLevels = furnaceLevelsData.furnaceLevels.map((f, i) => ({
    id: i + 1,
    data: f,
  }))
  const { error: furnaceError } = await supabase
    .from('game_furnace_levels')
    .upsert(furnaceLevels, { onConflict: 'id' })
  if (furnaceError) console.error('[Seed] Furnace levels:', furnaceError.message)
  else console.log(`[Seed] ✅ ${furnaceLevels.length} paliers fourneaux migrés`)

  console.log('[Seed] Migration terminée !')
}

// Exposer sur window pour pouvoir l'appeler depuis la console du navigateur en dev
if (import.meta.env.DEV) {
  (window as any).seedGameData = seedGameData
}
```

---

### `src/stores/useGameDataStore.ts`

Store Zustand qui contient les données de configuration du jeu.
Chargé depuis Supabase au démarrage, avec fallback sur les JSON locaux.

```typescript
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Imports JSON locaux — utilisés comme fallback
import resourcesData from '../data/resources.json'
import regionsData from '../data/regions.json'
import craftRecipesData from '../data/craft-recipes.json'
import cookRecipesData from '../data/cook-recipes.json'
import machinesData from '../data/machines.json'
import furnaceLevelsData from '../data/furnace-levels.json'

import type { Resource, Region, CraftRecipe, CookRecipe } from '../types/game'
import type { Machine, FurnaceLevel } from '../types/cook'

interface GameDataState {
  resources: Resource[]
  regions: Region[]
  craftRecipes: CraftRecipe[]
  cookRecipes: CookRecipe[]
  machines: Machine[]
  furnaceLevels: FurnaceLevel[]
  loaded: boolean
  source: 'supabase' | 'local' | 'none'
}

interface GameDataActions {
  loadFromSupabase: () => Promise<void>
}

// Données locales par défaut (fallback)
const LOCAL_DEFAULTS: Omit<GameDataState, 'loaded' | 'source'> = {
  resources: resourcesData.resources as Resource[],
  regions: regionsData.regions as Region[],
  craftRecipes: craftRecipesData.craftRecipes as CraftRecipe[],
  cookRecipes: cookRecipesData.cookRecipes as CookRecipe[],
  machines: machinesData.machines as Machine[],
  furnaceLevels: furnaceLevelsData.furnaceLevels as FurnaceLevel[],
}

export const useGameDataStore = create<GameDataState & GameDataActions>((set) => ({
  ...LOCAL_DEFAULTS,
  loaded: false,
  source: 'none',

  loadFromSupabase: async () => {
    try {
      // Charger toutes les tables en parallèle
      const [
        regionsRes,
        resourcesRes,
        craftRes,
        cookRes,
        machinesRes,
        furnaceRes,
      ] = await Promise.all([
        supabase.from('game_regions').select('data').order('id'),
        supabase.from('game_resources').select('data').order('id'),
        supabase.from('game_craft_recipes').select('data').order('id'),
        supabase.from('game_cook_recipes').select('data').order('id'),
        supabase.from('game_machines').select('data').order('id'),
        supabase.from('game_furnace_levels').select('data').order('id'),
      ])

      // Vérifier les erreurs
      const hasError = [regionsRes, resourcesRes, craftRes, cookRes, machinesRes, furnaceRes]
        .some((r) => r.error)

      if (hasError) {
        console.warn('[GameData] Erreur Supabase — fallback sur données locales')
        set({ ...LOCAL_DEFAULTS, loaded: true, source: 'local' })
        return
      }

      // Extraire les données (chaque row a un champ `data`)
      const regions = regionsRes.data!.map((r) => r.data) as Region[]
      const resources = resourcesRes.data!.map((r) => r.data) as Resource[]
      const craftRecipes = craftRes.data!.map((r) => r.data) as CraftRecipe[]
      const cookRecipes = cookRes.data!.map((r) => r.data) as CookRecipe[]
      const machines = machinesRes.data!.map((r) => r.data) as Machine[]
      const furnaceLevels = furnaceRes.data!.map((r) => r.data) as FurnaceLevel[]

      // Vérifier que les tables ne sont pas vides (pas encore seedées)
      if (resources.length === 0) {
        console.warn('[GameData] Tables vides — fallback sur données locales. Lance seedGameData() dans la console.')
        set({ ...LOCAL_DEFAULTS, loaded: true, source: 'local' })
        return
      }

      set({ regions, resources, craftRecipes, cookRecipes, machines, furnaceLevels, loaded: true, source: 'supabase' })
      console.log('[GameData] ✅ Données chargées depuis Supabase')

    } catch (err) {
      console.warn('[GameData] Exception — fallback sur données locales:', err)
      set({ ...LOCAL_DEFAULTS, loaded: true, source: 'local' })
    }
  },
}))
```

---

### `src/hooks/useGameData.ts`

Hook de chargement des données. Appelé une fois dans App.tsx.
Retourne `loaded` pour bloquer l'affichage tant que les données ne sont pas prêtes.

```typescript
import { useEffect } from 'react'
import { useGameDataStore } from '../stores/useGameDataStore'

/**
 * useGameData
 *
 * Charge les données de configuration du jeu depuis Supabase.
 * À monter UNE SEULE FOIS dans App.tsx, avant le rendu du jeu.
 * Retourne `loaded` — tant que false, afficher un écran de chargement.
 */
export function useGameData(): { loaded: boolean; source: 'supabase' | 'local' | 'none' } {
  const loaded = useGameDataStore((state) => state.loaded)
  const source = useGameDataStore((state) => state.source)
  const loadFromSupabase = useGameDataStore((state) => state.loadFromSupabase)

  useEffect(() => {
    if (!loaded) {
      loadFromSupabase()
    }
  }, [loaded, loadFromSupabase])

  return { loaded, source }
}
```

---

### Mise à jour `src/data/index.ts`

Le fichier `index.ts` doit maintenant lire depuis le store Zustand plutôt
que directement depuis les JSON. Mais les stores métier (`useCookStore`, etc.)
importent encore les constantes `RESOURCES`, `COOK_RECIPES`, etc.

Solution : créer des fonctions getter qui lisent depuis le store si chargé,
sinon depuis les JSON locaux.

```typescript
// src/data/index.ts
// Les imports JSON restent pour le fallback et les helpers qui s'exécutent
// avant le chargement Supabase
import resourcesData from './resources.json'
import regionsData from './regions.json'
import craftRecipesData from './craft-recipes.json'
import cookRecipesData from './cook-recipes.json'
import machinesData from './machines.json'
import furnaceLevelsData from './furnace-levels.json'

// Exports statiques (fallback + utilisés dans les stores avant chargement)
export const RESOURCES = resourcesData.resources
export const REGIONS = regionsData.regions
export const CRAFT_RECIPES = craftRecipesData.craftRecipes
export const COOK_RECIPES = cookRecipesData.cookRecipes
export const MACHINES = machinesData.machines
export const FURNACE_LEVELS = furnaceLevelsData.furnaceLevels

/**
 * Getters dynamiques — lisent depuis useGameDataStore si chargé.
 * À utiliser dans les composants React (pas dans les stores Zustand).
 */
export function getResources() {
  const { useGameDataStore } = require('../stores/useGameDataStore')
  const store = useGameDataStore.getState()
  return store.loaded ? store.resources : RESOURCES
}

export function getCookRecipes() {
  const { useGameDataStore } = require('../stores/useGameDataStore')
  const store = useGameDataStore.getState()
  return store.loaded ? store.cookRecipes : COOK_RECIPES
}

export function getCraftRecipes() {
  const { useGameDataStore } = require('../stores/useGameDataStore')
  const store = useGameDataStore.getState()
  return store.loaded ? store.craftRecipes : CRAFT_RECIPES
}

export function getMachines() {
  const { useGameDataStore } = require('../stores/useGameDataStore')
  const store = useGameDataStore.getState()
  return store.loaded ? store.machines : MACHINES
}

export function getRegions() {
  const { useGameDataStore } = require('../stores/useGameDataStore')
  const store = useGameDataStore.getState()
  return store.loaded ? store.regions : REGIONS
}

export function getFurnaceLevels() {
  const { useGameDataStore } = require('../stores/useGameDataStore')
  const store = useGameDataStore.getState()
  return store.loaded ? store.furnaceLevels : FURNACE_LEVELS
}
```

---

### Mise à jour `src/App.tsx`

Intégrer `useGameData` dans le flux de chargement.

```tsx
// Ajouter l'import :
import { useGameData } from './hooks/useGameData'

// Dans App() (avant GameApp), ajouter après initialize() :
const { loaded: gameDataLoaded, source } = useGameData()

// Modifier l'écran de chargement initial :
if (loading || !gameDataLoaded) {
  return (
    <div style={{
      minHeight: '100dvh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ fontSize: '40px' }}>🍖</div>
      <p style={{ fontSize: '13px', color: '#636e8a' }}>
        {!gameDataLoaded ? 'Chargement des données du jeu...' : 'Vérification de la session...'}
      </p>
    </div>
  )
}

// En mode dev, afficher la source des données dans la console :
if (import.meta.env.DEV) {
  console.log(`[App] Données de jeu : source = ${source}`)
}
```

---

### `src/lib/seedGameData.ts` — Exposer dans main.tsx en dev

Ajouter dans `src/main.tsx` pour pouvoir seeder depuis la console :

```typescript
// Ajouter en bas de main.tsx (dev uniquement)
if (import.meta.env.DEV) {
  import('./lib/seedGameData').then(({ seedGameData }) => {
    (window as any).seedGameData = seedGameData
    console.log('[Dev] seedGameData() disponible dans la console')
  })
}
```

---

## Procédure de migration (à faire ce soir)

1. Exécuter le script SQL dans Supabase SQL Editor
2. Vérifier que les 6 tables sont créées dans Table Editor
3. Lancer l'app en dev (`npm run dev`)
4. Ouvrir la console du navigateur
5. Exécuter : `await seedGameData()`
6. Vérifier dans Supabase Table Editor que les données sont présentes
7. Recharger l'app → console affiche "[GameData] ✅ Données chargées depuis Supabase"

---

## Critères de succès
- [ ] Les 6 tables existent dans Supabase avec les bonnes RLS policies
- [ ] `seedGameData()` s'exécute sans erreur dans la console
- [ ] Chaque table contient le bon nombre de lignes (14 ressources, 4 régions, etc.)
- [ ] `npm run dev` → console "[GameData] ✅ Données chargées depuis Supabase"
- [ ] Couper le réseau → l'app démarre quand même avec les données locales (fallback)
- [ ] `npm run build` passe sans erreur TypeScript

## Notes pour la suite
- Les stores métier (`useCookStore`, `useCraftStore`, etc.) continuent d'utiliser
  les constantes JSON statiques (`COOK_RECIPES`, `RESOURCES`, etc.) pour les calculs
  de tick — c'est intentionnel pour la performance (pas de lecture Zustand à chaque tick)
- Les composants UI passeront progressivement aux getters dynamiques (`getResources()`)
  pour refléter les changements admin en temps réel — à faire en prompt 013
- Le prompt 013 (Admin Panel) remplacera les policies "Auth write" par des policies
  "Admin only" plus restrictives
