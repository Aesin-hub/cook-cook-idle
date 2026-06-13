# Prompt 018 — useBestiaryStore + Edge Function boss spawns

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 017 ont été exécutés.

Structure existante pertinente :
- `src/types/creature.ts` — `Creature`, `CreatureDrop`, `HuntSuccessEntry`, `FamiliarBonus`
- `src/types/tile.ts` — `TileStatic`
- `src/stores/useMapStore.ts` — `getStaticTile()`, `campCoord`
- `src/stores/usePlayerStore.ts` — `getClassLevel('chasseur')`, `addXp('hunt', amount)`
- `src/stores/useInventoryStore.ts` — `addResources()`
- `src/stores/useGameDataStore.ts` — `creatures` (chargées depuis Supabase)
- `src/hooks/useGameLoop.ts` — tick 1s
- `src/lib/supabase.ts` — client Supabase

## Objectif
1. Créer la table SQL `game_boss_spawns` + `save_bestiary`
2. Créer l'Edge Function Supabase pour le spawn des boss côté serveur
3. Créer `useBestiaryStore` — chasse, familiers, boss, production familier

---

## Prérequis — Script SQL à exécuter dans Supabase

```sql
-- Table des boss actifs (gérée par l'Edge Function)
CREATE TABLE game_boss_spawns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creature_id TEXT NOT NULL,
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  spawned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  zone INTEGER NOT NULL  -- 1, 2 ou 3 (proche, intermédiaire, lointaine)
);

-- Sauvegarde bestiaire par joueur
CREATE TABLE save_bestiary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  captured_creature_ids JSONB NOT NULL DEFAULT '[]',
  active_familiar_id TEXT,
  familiar_last_tick_at BIGINT DEFAULT 0,
  hunt_history JSONB NOT NULL DEFAULT '[]',  -- dernières 20 chasses
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE game_boss_spawns ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_bestiary ENABLE ROW LEVEL SECURITY;

-- Boss spawns : lecture publique, écriture Edge Function uniquement
CREATE POLICY "Public read boss spawns" ON game_boss_spawns FOR SELECT USING (true);
CREATE POLICY "Service write boss spawns" ON game_boss_spawns FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users manage own bestiary" ON save_bestiary FOR ALL
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX boss_spawns_active ON game_boss_spawns(is_active, expires_at);
```

---

## Edge Function Supabase — Boss Spawner

### Créer le fichier `supabase/functions/boss-spawner/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ─── Configuration des zones de spawn ─────────────────────────────────────────

const BOSS_ZONES = [
  {
    zone: 1,
    distanceMin: 5,
    distanceMax: 8,
    rarityWeights: { common: 60, uncommon: 30, rare: 10, epic: 0, legendary: 0 },
    durationHoursMin: 4,
    durationHoursMax: 6,
  },
  {
    zone: 2,
    distanceMin: 9,
    distanceMax: 14,
    rarityWeights: { common: 0, uncommon: 50, rare: 35, epic: 15, legendary: 0 },
    durationHoursMin: 4,
    durationHoursMax: 6,
  },
  {
    zone: 3,
    distanceMin: 15,
    distanceMax: 22,
    rarityWeights: { common: 0, uncommon: 0, rare: 40, epic: 40, legendary: 20 },
    durationHoursMin: 4,
    durationHoursMax: 6,
  },
]

const MAP_CENTER = { x: 15, y: 15 }
const MAP_SIZE = 31

function tileDistance(a: {x:number,y:number}, b: {x:number,y:number}): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

// Tirage pondéré selon les poids de rareté
function pickRarity(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  let rand = Math.random() * total
  for (const [rarity, weight] of Object.entries(weights)) {
    rand -= weight
    if (rand <= 0) return rarity
  }
  return 'common'
}

// Retourne une tuile aléatoire dans la zone de distance donnée
async function pickTileInZone(
  distMin: number,
  distMax: number,
  targetRarity: string
): Promise<{ x: number; y: number } | null> {
  // Récupérer les tuiles activées dans la zone de distance
  const { data: tiles } = await supabase
    .from('game_map')
    .select('x, y, data')
    .eq('data->>isEnabled', 'true')
    .neq('data->>specialType', 'village')

  if (!tiles || tiles.length === 0) return null

  // Filtrer par distance et rareté
  const candidates = tiles.filter((t) => {
    const dist = tileDistance({ x: t.x, y: t.y }, MAP_CENTER)
    const rarity = t.data?.rarity ?? 'common'
    return dist >= distMin && dist <= distMax && rarity === targetRarity
  })

  if (candidates.length === 0) {
    // Fallback : ignorer la rareté, juste la distance
    const fallback = tiles.filter((t) => {
      const dist = tileDistance({ x: t.x, y: t.y }, MAP_CENTER)
      return dist >= distMin && dist <= distMax
    })
    if (fallback.length === 0) return null
    const picked = fallback[Math.floor(Math.random() * fallback.length)]
    return { x: picked.x, y: picked.y }
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  return { x: picked.x, y: picked.y }
}

// Récupère une créature boss compatible avec une tuile
async function pickBossForTile(
  tileX: number,
  tileY: number,
  targetRarity: string
): Promise<string | null> {
  const { data: tileRow } = await supabase
    .from('game_map')
    .select('data')
    .eq('x', tileX)
    .eq('y', tileY)
    .single()

  if (!tileRow) return null

  const biome = tileRow.data?.biome ?? 'forest'
  const culture = tileRow.data?.culture ?? 'center'

  // Chercher un boss compatible avec ce biome/culture/rareté
  const { data: creatures } = await supabase
    .from('game_creatures')
    .select('id, data')

  if (!creatures) return null

  const compatible = creatures.filter((c) => {
    const d = c.data
    return (
      d.isBoss === true &&
      d.rarity === targetRarity &&
      d.compatibleBiomes?.includes(biome) &&
      d.compatibleCultures?.includes(culture)
    )
  })

  if (compatible.length === 0) {
    // Fallback : boss de n'importe quelle rareté compatible avec le biome
    const fallback = creatures.filter((c) =>
      c.data.isBoss === true &&
      c.data.compatibleBiomes?.includes(biome)
    )
    if (fallback.length === 0) return null
    return fallback[Math.floor(Math.random() * fallback.length)].id
  }

  return compatible[Math.floor(Math.random() * compatible.length)].id
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async () => {
  const now = new Date()

  // 1. Désactiver les boss expirés
  await supabase
    .from('game_boss_spawns')
    .update({ is_active: false })
    .lt('expires_at', now.toISOString())
    .eq('is_active', true)

  // 2. Compter les boss actifs par zone
  const { data: activeBosses } = await supabase
    .from('game_boss_spawns')
    .select('zone')
    .eq('is_active', true)

  const activeByZone: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  for (const boss of activeBosses ?? []) {
    activeByZone[boss.zone] = (activeByZone[boss.zone] ?? 0) + 1
  }

  // 3. Spawner un boss par zone manquante (max 1 par zone = 3 boss total)
  const spawned = []
  for (const zone of BOSS_ZONES) {
    if ((activeByZone[zone.zone] ?? 0) >= 1) continue  // zone déjà occupée

    const rarity = pickRarity(zone.rarityWeights)
    const tile = await pickTileInZone(zone.distanceMin, zone.distanceMax, rarity)
    if (!tile) continue

    const creatureId = await pickBossForTile(tile.x, tile.y, rarity)
    if (!creatureId) continue

    // Durée aléatoire entre min et max heures
    const durationHours = zone.durationHoursMin +
      Math.random() * (zone.durationHoursMax - zone.durationHoursMin)
    const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000)

    const { data: newBoss } = await supabase
      .from('game_boss_spawns')
      .insert({
        creature_id: creatureId,
        tile_x: tile.x,
        tile_y: tile.y,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        zone: zone.zone,
      })
      .select()
      .single()

    if (newBoss) spawned.push(newBoss)

    // TODO Phase 4 : envoyer notification push ici
    // await sendPushNotification(creatureId, tile, expiresAt)
  }

  return new Response(
    JSON.stringify({ ok: true, spawned: spawned.length, activeByZone }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### Activer le cron dans Supabase

Dans le dashboard Supabase → **Edge Functions → boss-spawner → Schedules** :
```
Cron expression : 0 * * * *   (toutes les heures)
```

---

## Fichiers à créer

---

### `src/types/bestiary.ts`

```typescript
// Résultat d'une expédition de chasse
export interface HuntResult {
  success: boolean
  creatureId: string
  creatureName: string
  creatureEmoji: string
  drops: { resourceId: string; amount: number }[]
  xpGained: number
  familiarCaptured: boolean
  message: string           // message affiché au joueur (succès ou échec)
}

// Boss actif sur la carte
export interface ActiveBoss {
  id: string                // uuid du spawn
  creatureId: string
  tileX: number
  tileY: number
  spawnedAt: number         // timestamp
  expiresAt: number         // timestamp
  zone: 1 | 2 | 3
}

// Entrée dans l'historique des chasses
export interface HuntHistoryEntry {
  timestamp: number
  creatureId: string
  success: boolean
  xpGained: number
}

// État global du store
export interface BestiaryState {
  // Familiers
  capturedCreatureIds: string[]
  activeFamiliarId: string | null
  familiarLastTickAt: number

  // Boss actifs (lus depuis Supabase)
  activeBosses: ActiveBoss[]
  bossesLastLoadedAt: number

  // Historique
  huntHistory: HuntHistoryEntry[]
}
```

---

### `src/stores/useBestiaryStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from './usePlayerStore'
import { useInventoryStore } from './useInventoryStore'
import { useMapStore } from './useMapStore'
import { useGameDataStore } from './useGameDataStore'
import type { BestiaryState, HuntResult, ActiveBoss, HuntHistoryEntry } from '../types/bestiary'
import type { Creature } from '../types/creature'

// Intervalle de rechargement des boss (30 minutes)
const BOSS_RELOAD_INTERVAL_MS = 30 * 60 * 1000

// XP de chasse en cas d'échec (20% du succès)
const FAILURE_XP_RATIO = 0.2

// Max entrées dans l'historique
const MAX_HUNT_HISTORY = 20

interface BestiaryActions {
  // Chargement
  loadBosses: () => Promise<void>
  loadPlayerSave: (userId: string) => Promise<void>
  saveToSupabase: (userId: string) => Promise<void>

  // Chasse
  hunt: (tileX: number, tileY: number) => HuntResult | null

  // Familiers
  setActiveFamiliar: (creatureId: string | null) => void
  getActiveFamiliar: () => Creature | null

  // Tick familier (appelé par useGameLoop)
  familiarTick: () => { resourceId: string; amount: number } | null

  // Boss
  getBossOnTile: (tileX: number, tileY: number) => ActiveBoss | null
  getActiveBosses: () => ActiveBoss[]
}

export const useBestiaryStore = create<BestiaryState & BestiaryActions>()(
  persist(
    (set, get) => ({
      capturedCreatureIds: [],
      activeFamiliarId: null,
      familiarLastTickAt: Date.now(),
      activeBosses: [],
      bossesLastLoadedAt: 0,
      huntHistory: [],

      // ─── Chargement ─────────────────────────────────────────────────────

      loadBosses: async () => {
        const { bossesLastLoadedAt } = get()
        // Ne pas recharger si récent
        if (Date.now() - bossesLastLoadedAt < BOSS_RELOAD_INTERVAL_MS) return

        const { data } = await supabase
          .from('game_boss_spawns')
          .select('*')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())

        const bosses: ActiveBoss[] = (data ?? []).map((row) => ({
          id: row.id,
          creatureId: row.creature_id,
          tileX: row.tile_x,
          tileY: row.tile_y,
          spawnedAt: new Date(row.spawned_at).getTime(),
          expiresAt: new Date(row.expires_at).getTime(),
          zone: row.zone,
        }))

        set({ activeBosses: bosses, bossesLastLoadedAt: Date.now() })
      },

      loadPlayerSave: async (userId) => {
        const { data } = await supabase
          .from('save_bestiary')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!data) return

        set({
          capturedCreatureIds: data.captured_creature_ids ?? [],
          activeFamiliarId: data.active_familiar_id ?? null,
          familiarLastTickAt: data.familiar_last_tick_at ?? Date.now(),
          huntHistory: data.hunt_history ?? [],
        })
      },

      saveToSupabase: async (userId) => {
        const { capturedCreatureIds, activeFamiliarId, familiarLastTickAt, huntHistory } = get()
        await supabase.from('save_bestiary').upsert({
          user_id: userId,
          captured_creature_ids: capturedCreatureIds,
          active_familiar_id: activeFamiliarId,
          familiar_last_tick_at: familiarLastTickAt,
          hunt_history: huntHistory.slice(0, MAX_HUNT_HISTORY),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      },

      // ─── Chasse ──────────────────────────────────────────────────────────

      hunt: (tileX, tileY) => {
        const tile = useMapStore.getState().getStaticTile({ x: tileX, y: tileY })
        if (!tile?.creatureId) return null

        const creatures = useGameDataStore.getState().creatures
        const creature = creatures.find((c) => c.id === tile.creatureId)
        if (!creature) return null

        const chasseurLevel = usePlayerStore.getState().getClassLevel('chasseur')
        const dropRateMultiplier = usePlayerStore.getState().getHarvestMultipliers().yieldMultiplier

        // Calculer le taux de succès selon le niveau Chasseur
        let successRate = 0.1  // défaut si pas d'entrée
        for (const entry of creature.huntSuccessRate) {
          if (chasseurLevel >= entry.chasseurLevel) {
            successRate = entry.successRate
          }
        }

        // Appliquer multiplicateur drop rate si applicable
        const dropMultiplier = usePlayerStore.getState()
          .getActiveBonuses('chasseur')
          .filter((b) => b.type === 'drop_rate_multiplier')
          .reduce((acc, b) => acc * b.value, 1.0)

        const isSuccess = Math.random() < successRate

        if (isSuccess) {
          // Calculer les drops
          const drops: { resourceId: string; amount: number }[] = []
          for (const drop of creature.dropResources) {
            const roll = Math.random()
            if (roll < drop.chance * dropMultiplier) {
              const amount = Math.floor(
                drop.minAmount + Math.random() * (drop.maxAmount - drop.minAmount + 1)
              )
              drops.push({ resourceId: drop.resourceId, amount })
            }
          }

          // Créditer l'inventaire
          if (drops.length > 0) {
            useInventoryStore.getState().addResources(drops)
          }

          // XP chasse
          const xpGained = creature.xpOnSuccess
          usePlayerStore.getState().addXp('hunt', xpGained)

          // Tentative de capture du familier (10% de base)
          let familiarCaptured = false
          const { capturedCreatureIds } = get()
          if (
            creature.isFamiliar &&
            !capturedCreatureIds.includes(creature.id) &&
            Math.random() < creature.captureChance
          ) {
            familiarCaptured = true
            set({ capturedCreatureIds: [...capturedCreatureIds, creature.id] })
          }

          // Message succès aléatoire
          const messages = creature.successMessages
          const message = messages[Math.floor(Math.random() * messages.length)]

          // Historique
          const entry: HuntHistoryEntry = {
            timestamp: Date.now(),
            creatureId: creature.id,
            success: true,
            xpGained,
          }
          set((s) => ({
            huntHistory: [entry, ...s.huntHistory].slice(0, MAX_HUNT_HISTORY),
          }))

          return {
            success: true,
            creatureId: creature.id,
            creatureName: creature.name,
            creatureEmoji: creature.emoji,
            drops,
            xpGained,
            familiarCaptured,
            message: familiarCaptured
              ? `${message} 🎉 Tu as capturé ${creature.emoji} ${creature.name} comme familier !`
              : message,
          }
        } else {
          // Échec — 20% XP + message encourageant
          const xpGained = Math.floor(creature.xpOnSuccess * FAILURE_XP_RATIO)
          usePlayerStore.getState().addXp('hunt', xpGained)

          const messages = creature.failMessages
          const message = messages[Math.floor(Math.random() * messages.length)]

          const entry: HuntHistoryEntry = {
            timestamp: Date.now(),
            creatureId: creature.id,
            success: false,
            xpGained,
          }
          set((s) => ({
            huntHistory: [entry, ...s.huntHistory].slice(0, MAX_HUNT_HISTORY),
          }))

          return {
            success: false,
            creatureId: creature.id,
            creatureName: creature.name,
            creatureEmoji: creature.emoji,
            drops: [],
            xpGained,
            familiarCaptured: false,
            message: `${message} (+${xpGained} XP Chasseur)`,
          }
        }
      },

      // ─── Familiers ───────────────────────────────────────────────────────

      setActiveFamiliar: (creatureId) => {
        set({ activeFamiliarId: creatureId, familiarLastTickAt: Date.now() })
      },

      getActiveFamiliar: () => {
        const { activeFamiliarId } = get()
        if (!activeFamiliarId) return null
        const creatures = useGameDataStore.getState().creatures
        return creatures.find((c) => c.id === activeFamiliarId) ?? null
      },

      // Tick du familier — appelé par useGameLoop toutes les secondes
      // Fonctionne comme le camp : produit en continu, offline inclus
      familiarTick: () => {
        const familiar = get().getActiveFamiliar()
        if (!familiar?.familiarBonus) return null

        const { familiarLastTickAt } = get()
        const now = Date.now()
        const elapsedMin = (now - familiarLastTickAt) / 60000

        const amount = familiar.familiarBonus.amountPerMin * elapsedMin

        set({ familiarLastTickAt: now })

        if (amount <= 0) return null
        return { resourceId: familiar.familiarBonus.resourceId, amount }
      },

      // ─── Boss ────────────────────────────────────────────────────────────

      getBossOnTile: (tileX, tileY) => {
        const now = Date.now()
        return get().activeBosses.find(
          (b) => b.tileX === tileX && b.tileY === tileY && b.expiresAt > now
        ) ?? null
      },

      getActiveBosses: () => {
        const now = Date.now()
        return get().activeBosses.filter((b) => b.expiresAt > now)
      },
    }),
    {
      name: 'cooking-fantasy-bestiary',
      partialize: (state) => ({
        capturedCreatureIds: state.capturedCreatureIds,
        activeFamiliarId: state.activeFamiliarId,
        familiarLastTickAt: state.familiarLastTickAt,
        huntHistory: state.huntHistory,
        // activeBosses non persisté — toujours rechargé depuis Supabase
      }),
    }
  )
)
```

---

### Mise à jour `src/hooks/useGameLoop.ts`

Ajouter le tick du familier.

```typescript
// Ajouter l'import :
import { useBestiaryStore } from '../stores/useBestiaryStore'

// Dans l'interval, après le tick Cook :
// 4. Tick familier
const familiarYield = useBestiaryStore.getState().familiarTick()
if (familiarYield && familiarYield.amount > 0) {
  useInventoryStore.getState().addResources([familiarYield])
}

// 5. Vérifier arrivée camp
const justArrived = useMapStore.getState().checkArrival()
if (justArrived) onCampArrived?.()

// 6. Nettoyage modifiers expirés (toutes les minutes)
if (Date.now() % 60000 < 1000) {
  usePlayerStore.getState().cleanExpiredModifiers()
}
```

---

### Mise à jour `src/hooks/useOfflineProgress.ts`

Ajouter le calcul offline du familier.

```typescript
// Dans calculateOfflineProgress, après le calcul Cook :
// Offline familier
const familiarYield = useBestiaryStore.getState().familiarTick()
if (familiarYield && familiarYield.amount > 0) {
  // Déjà crédité dans familiarTick() via set(familiarLastTickAt)
  // Ajouter à l'affichage offline modal
  allYields.push(familiarYield)
}
```

---

### Mise à jour `src/hooks/useLoadSave.ts`

Charger le save bestiaire + les boss au login.

```typescript
import { useBestiaryStore } from '../stores/useBestiaryStore'

// Dans useEffect, après le chargement carte :
await useBestiaryStore.getState().loadPlayerSave(user.id)
await useBestiaryStore.getState().loadBosses()
```

---

### Mise à jour `src/lib/saveService.ts`

Sauvegarder le bestiaire dans l'autosave.

```typescript
import { useBestiaryStore } from '../stores/useBestiaryStore'

// Dans saveAll() :
useBestiaryStore.getState().saveToSupabase(userId),
```

---

## Critères de succès

### Edge Function
- [ ] La fonction `boss-spawner` se déploie sans erreur
- [ ] Le cron est configuré (toutes les heures)
- [ ] Appel manuel de la fonction → des boss apparaissent dans `game_boss_spawns`
- [ ] Les boss expirés sont désactivés automatiquement
- [ ] Max 1 boss actif par zone (3 au total)

### useBestiaryStore
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] `loadBosses()` charge les boss actifs depuis Supabase
- [ ] `getBossOnTile(x, y)` retourne le boss ou null
- [ ] `hunt(x, y)` sans créature → retourne `null`
- [ ] `hunt(x, y)` avec créature → retourne un `HuntResult`
- [ ] En cas de succès → drops dans l'inventaire + XP Chasseur
- [ ] En cas d'échec → 20% XP + message encourageant
- [ ] 10% de chance de capturer le familier si succès
- [ ] `setActiveFamiliar('kappa')` → familier actif
- [ ] `familiarTick()` → ressource produite toutes les secondes
- [ ] Le familier produit correctement en offline (lastTickAt mis à jour)

### Intégration
- [ ] Le familier actif produit sa ressource visible dans l'inventaire
- [ ] Les boss sont visibles sur la carte (prompt 019)
- [ ] `huntHistory` enregistre les 20 dernières chasses

## Notes pour la suite
- Les notifications push boss (placeholder commenté) seront activées en Phase 4
  avec Firebase Cloud Messaging + Capacitor Push Notifications
- `hunt()` est appelé depuis l'UI Carte (prompt 019) quand le joueur
  clique sur une tuile avec boss et lance une expédition de chasse
- Le cooldown après échec contre un boss n'est pas encore implémenté —
  à ajouter dans un prompt de polish Phase 3
- `getActiveBosses()` sera utilisé par `useMapStore` pour afficher
  les marqueurs de boss sur la grille (prompt 019)
