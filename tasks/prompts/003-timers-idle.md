# Prompt 003 — Système de timers idle (récolte)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 (init) et 002 (données JSON) ont été exécutés.

Structure existante :
- `src/data/resources.json` — 14 ressources avec `baseYieldPerMin`, `emoji`, `tooltip`
- `src/data/regions.json` — 4 régions avec `unlockCondition`
- `src/types/game.ts` — types `Resource`, `Region`, `RegionId`
- `src/data/index.ts` — exports `RESOURCES`, `REGIONS`

## Décisions de design (issues de l'analyse marché)
- **Offline progress plafonné à 8h** — le joueur récupère tout ce qui a été
  produit pendant son absence, dans la limite de 8h. Pas de perte, pas de punition.
- **Message offline positif et chaleureux** — le message de retour ne dit pas
  "tu as raté X heures". Il dit "Tes équipes ont bien travaillé !" et liste les gains.
  Ton généreux, jamais culpabilisant.
- **Annulation d'expédition sans pénalité** — une expédition peut toujours être
  annulée, sans perte. Les joueurs détestent les décisions irréversibles.
- **Noms lisibles dans les notifications** — les toasts et messages affichent
  le `name` et `emoji` de la ressource, jamais l'ID technique.
- **Zéro slot premium** — le nombre d'expéditions (max 3) ne sera jamais augmenté
  via achat. Il pourra augmenter via progression en jeu uniquement (Phase 3).

## Objectif
Implémenter le **système de récolte idle** complet, pilier central du jeu.

### Deux modes de récolte coexistent :

**1. Le Camp** (`camp`)
- 1 seul camp actif à la fois dans tout le jeu
- Posé dans une région → génère TOUTES les ressources de cette région en continu
- Rendement : `baseYieldPerMin × 1.0` (rendement plein)
- Persiste offline (plafonné à 8h max)
- Le joueur peut déplacer son camp (annule l'ancien, pas de pénalité)

**2. Les Expéditions** (`expeditions`)
- Plusieurs expéditions actives en parallèle (max 3 pour le MVP — augmentable via progression, jamais via achat)
- Chaque expédition cible UNE ressource spécifique dans UNE région
- Durée fixe choisie par le joueur (15min / 30min / 1h / 2h)
- Rendement : `baseYieldPerMin × 0.6` (60% du rendement camp)
- Au retour : ressources créditées d'un coup ("butin")
- Calcul offline inclus
- Annulation toujours possible, sans pénalité

---

## Fichiers à créer

### `src/types/harvest.ts`

```typescript
import type { RegionId } from './game'

export interface Camp {
  regionId: RegionId
  startedAt: number
  lastTickAt: number
}

export type ExpeditionDuration = 15 | 30 | 60 | 120  // en minutes

export interface Expedition {
  id: string
  resourceId: string
  regionId: RegionId
  durationMinutes: ExpeditionDuration
  startedAt: number
  endsAt: number
  collected: boolean
}

export interface HarvestState {
  camp: Camp | null
  expeditions: Expedition[]
  lastSavedAt: number
}

export interface HarvestYield {
  resourceId: string
  amount: number
}

// Résultat de l'offline progress — utilisé pour la notification de retour
export interface OfflineProgressResult {
  yields: HarvestYield[]
  elapsedMs: number
  cappedAt8h: boolean
}
```

---

### `src/stores/useHarvestStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { RESOURCES } from '../data'
import type { HarvestState, HarvestYield, Camp, Expedition, ExpeditionDuration, OfflineProgressResult } from '../types/harvest'
import type { RegionId } from '../types/game'

const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
const CAMP_MULTIPLIER = 1.0
const EXPEDITION_MULTIPLIER = 0.6
const MAX_EXPEDITIONS = 3   // augmentable via progression en jeu, jamais via achat

interface HarvestActions {
  setCamp: (regionId: RegionId) => void
  removeCamp: () => void
  startExpedition: (resourceId: string, regionId: RegionId, durationMinutes: ExpeditionDuration) => { success: boolean; reason?: string }
  collectExpedition: (expeditionId: string) => HarvestYield | null
  cancelExpedition: (expeditionId: string) => void  // toujours possible, sans pénalité
  tick: () => HarvestYield[]
  calculateOfflineProgress: () => OfflineProgressResult
}

type HarvestStore = HarvestState & HarvestActions

export const useHarvestStore = create<HarvestStore>()(
  persist(
    (set, get) => ({
      camp: null,
      expeditions: [],
      lastSavedAt: Date.now(),

      setCamp: (regionId) => {
        set({ camp: { regionId, startedAt: Date.now(), lastTickAt: Date.now() } })
      },

      removeCamp: () => set({ camp: null }),

      startExpedition: (resourceId, regionId, durationMinutes) => {
        const { expeditions } = get()
        const activeExpeditions = expeditions.filter((e) => !e.collected)
        if (activeExpeditions.length >= MAX_EXPEDITIONS) {
          return { success: false, reason: `Maximum ${MAX_EXPEDITIONS} expéditions simultanées.` }
        }
        const resource = RESOURCES.find((r) => r.id === resourceId && r.region === regionId)
        if (!resource) return { success: false, reason: 'Ressource introuvable dans cette région.' }

        const now = Date.now()
        const newExpedition: Expedition = {
          id: uuidv4(), resourceId, regionId, durationMinutes,
          startedAt: now, endsAt: now + durationMinutes * 60 * 1000, collected: false,
        }
        set({ expeditions: [...expeditions, newExpedition] })
        return { success: true }
      },

      collectExpedition: (expeditionId) => {
        const { expeditions } = get()
        const expedition = expeditions.find((e) => e.id === expeditionId)
        if (!expedition || expedition.collected) return null
        if (Date.now() < expedition.endsAt) return null

        const resource = RESOURCES.find((r) => r.id === expedition.resourceId)
        if (!resource) return null

        const amount = Math.floor(resource.baseYieldPerMin * expedition.durationMinutes * EXPEDITION_MULTIPLIER)
        set({ expeditions: expeditions.map((e) => e.id === expeditionId ? { ...e, collected: true } : e) })
        return { resourceId: expedition.resourceId, amount }
      },

      // Annulation sans pénalité — les joueurs ne doivent jamais être punis pour explorer
      cancelExpedition: (expeditionId) => {
        set({ expeditions: get().expeditions.filter((e) => e.id !== expeditionId) })
      },

      tick: () => {
        const { camp } = get()
        if (!camp) return []
        const now = Date.now()
        const elapsedMin = (now - camp.lastTickAt) / 60000
        const regionResources = RESOURCES.filter((r) => r.region === camp.regionId)
        const yields: HarvestYield[] = regionResources
          .map((r) => ({ resourceId: r.id, amount: r.baseYieldPerMin * elapsedMin * CAMP_MULTIPLIER }))
          .filter((y) => y.amount > 0)
        set({ camp: { ...camp, lastTickAt: now } })
        return yields
      },

      calculateOfflineProgress: () => {
        const { camp, expeditions, lastSavedAt } = get()
        const now = Date.now()
        const rawElapsedMs = now - lastSavedAt
        const cappedAt8h = rawElapsedMs > OFFLINE_CAP_MS
        const elapsedMs = Math.min(rawElapsedMs, OFFLINE_CAP_MS)
        const elapsedMin = elapsedMs / 60000
        const allYields: HarvestYield[] = []

        if (camp) {
          const regionResources = RESOURCES.filter((r) => r.region === camp.regionId)
          regionResources.forEach((r) => allYields.push({
            resourceId: r.id,
            amount: r.baseYieldPerMin * elapsedMin * CAMP_MULTIPLIER,
          }))
          set({ camp: { ...camp, lastTickAt: now } })
        }

        const updatedExpeditions = expeditions.map((expedition) => {
          if (expedition.collected || expedition.endsAt > now) return expedition
          const resource = RESOURCES.find((r) => r.id === expedition.resourceId)
          if (!resource) return expedition
          allYields.push({
            resourceId: expedition.resourceId,
            amount: Math.floor(resource.baseYieldPerMin * expedition.durationMinutes * EXPEDITION_MULTIPLIER),
          })
          return { ...expedition, collected: true }
        })

        set({ expeditions: updatedExpeditions, lastSavedAt: now })

        // Fusionner les doublons
        const mergedYields = allYields.reduce<HarvestYield[]>((acc, y) => {
          const existing = acc.find((a) => a.resourceId === y.resourceId)
          if (existing) { existing.amount += y.amount } else { acc.push({ ...y }) }
          return acc
        }, [])

        return { yields: mergedYields, elapsedMs, cappedAt8h }
      },
    }),
    {
      name: 'cooking-fantasy-harvest',
      partialize: (state) => ({ camp: state.camp, expeditions: state.expeditions, lastSavedAt: Date.now() }),
    }
  )
)
```

---

### `src/stores/useInventoryStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HarvestYield } from '../types/harvest'

interface InventoryState {
  resources: Record<string, number>
}

interface InventoryActions {
  addResources: (yields: HarvestYield[]) => void
  removeResources: (yields: HarvestYield[]) => boolean
  getAmount: (resourceId: string) => number
  reset: () => void
}

export const useInventoryStore = create<InventoryState & InventoryActions>()(
  persist(
    (set, get) => ({
      resources: {},
      addResources: (yields) => set((state) => {
        const updated = { ...state.resources }
        yields.forEach(({ resourceId, amount }) => { updated[resourceId] = (updated[resourceId] ?? 0) + amount })
        return { resources: updated }
      }),
      removeResources: (yields) => {
        const { resources } = get()
        const canAfford = yields.every(({ resourceId, amount }) => (resources[resourceId] ?? 0) >= amount)
        if (!canAfford) return false
        set((state) => {
          const updated = { ...state.resources }
          yields.forEach(({ resourceId, amount }) => { updated[resourceId] = (updated[resourceId] ?? 0) - amount })
          return { resources: updated }
        })
        return true
      },
      getAmount: (resourceId) => get().resources[resourceId] ?? 0,
      reset: () => set({ resources: {} }),
    }),
    { name: 'cooking-fantasy-inventory' }
  )
)
```

---

### `src/hooks/useGameLoop.ts`

```typescript
import { useEffect, useRef } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'

const TICK_INTERVAL_MS = 1000

export function useGameLoop() {
  const tick = useHarvestStore((state) => state.tick)
  const addResources = useInventoryStore((state) => state.addResources)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const yields = tick()
      if (yields.length > 0) addResources(yields)
    }, TICK_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [tick, addResources])
}
```

---

### `src/hooks/useOfflineProgress.ts`

```typescript
import { useEffect, useState } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { RESOURCES } from '../data'
import type { OfflineProgressResult } from '../types/harvest'

export interface OfflineProgressDisplay extends OfflineProgressResult {
  // Enrichi avec les noms lisibles pour l'affichage — jamais les IDs techniques
  yieldsDisplay: { name: string; emoji: string; amount: number }[]
  elapsedLabel: string   // ex: "3h 24min" ou "45min"
  dismiss: () => void
}

function formatElapsed(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin}min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function useOfflineProgress(): OfflineProgressDisplay | null {
  const calculateOfflineProgress = useHarvestStore((state) => state.calculateOfflineProgress)
  const addResources = useInventoryStore((state) => state.addResources)
  const [result, setResult] = useState<OfflineProgressDisplay | null>(null)

  useEffect(() => {
    const { yields, elapsedMs, cappedAt8h } = calculateOfflineProgress()
    if (elapsedMs < 60000 || yields.length === 0) return

    addResources(yields)

    // Enrichir avec les noms lisibles — ne jamais afficher les IDs techniques au joueur
    const yieldsDisplay = yields
      .map((y) => {
        const resource = RESOURCES.find((r) => r.id === y.resourceId)
        return { name: resource?.name ?? y.resourceId, emoji: resource?.emoji ?? '📦', amount: Math.floor(y.amount) }
      })
      .filter((y) => y.amount > 0)

    setResult({
      yields,
      yieldsDisplay,
      elapsedMs,
      cappedAt8h,
      elapsedLabel: formatElapsed(elapsedMs),
      dismiss: () => setResult(null),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
```

---

### Mise à jour `src/App.tsx`

```tsx
import { useGameLoop } from './hooks/useGameLoop'
import { useOfflineProgress } from './hooks/useOfflineProgress'

function App() {
  useGameLoop()
  const offlineProgress = useOfflineProgress()

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}
         className="flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2 text-cf-text">🍖 Cooking Fantasy</h1>
        <p className="text-cf-muted">Core loop en construction...</p>

        {/* Notification offline — message positif, jamais culpabilisant */}
        {offlineProgress && (
          <div style={{ background: '#161b22', border: '1px solid rgba(0,210,255,0.2)' }}
               className="mt-4 p-4 rounded-cf-lg text-left max-w-sm mx-auto">
            <p className="font-medium mb-2 text-cf-harvest">
              ⛺ Tes équipes ont bien travaillé !
            </p>
            <p className="text-sm text-cf-muted mb-2">
              Absent pendant {offlineProgress.elapsedLabel}
              {offlineProgress.cappedAt8h && ' (max 8h)'}
            </p>
            <ul className="text-sm text-cf-text space-y-1">
              {offlineProgress.yieldsDisplay.map((y) => (
                <li key={y.name}>{y.emoji} +{y.amount} {y.name}</li>
              ))}
            </ul>
            <button
              className="mt-3 text-xs text-cf-muted underline"
              onClick={offlineProgress.dismiss}
            >
              Super, merci !
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
```

### Installation uuid

```bash
npm install uuid
npm install --save-dev @types/uuid
```

---

## Architecture

```
App.tsx
├── useGameLoop()         → tick 1s → harvest yields → inventaire
└── useOfflineProgress()  → 1 fois au chargement → gains offline → notification positive

useHarvestStore  (persist localStorage)
├── camp / expeditions / lastSavedAt
├── tick() / calculateOfflineProgress()
└── startExpedition / cancelExpedition (sans pénalité)

useInventoryStore (persist localStorage)
└── resources: Record<string, number>
```

## Critères de succès
- [ ] `npm run build` sans erreur
- [ ] Camp posé → ressources augmentent toutes les secondes
- [ ] Fermer/rouvrir après 2min → message "Tes équipes ont bien travaillé !" avec noms lisibles
- [ ] Message affiche `emoji + name`, jamais l'ID technique
- [ ] Expédition annulable sans pénalité
- [ ] Offline plafonné à 8h

## Notes pour la suite
- Le message offline sera remplacé par un vrai composant `OfflineModal` dans le prompt 005 (UI)
- `MAX_EXPEDITIONS` sera rendu configurable via un futur store `usePlayerStore` (Phase 3)
  — augmentable uniquement via progression en jeu, jamais via achat
