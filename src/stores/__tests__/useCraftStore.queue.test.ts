import { beforeEach, describe, it, expect } from 'vitest'
import { useCraftStore } from '../useCraftStore'
import { useInventoryStore } from '../useInventoryStore'
import { canAffordRecipe } from '../../lib/craftHelpers'
import { CRAFT_RECIPES } from '../../data'

// Tests complémentaires pour les cas edge de la file (prompt 006 — UI Craft)
// bouillon_base : herbe×2 + champignon×1 + eau×3 → 10s, firstTimeFast=true, 5xp
// farine        : ble×3 + eau×1 → 8s, firstTimeFast=true, 4xp
// lingot_fer    : minerai_fer×3 → 15s, firstTimeFast=true, 8xp

function resetStores() {
  useCraftStore.setState({ queue: [], totalXp: 0, craftedOnce: {} })
  useInventoryStore.setState({ resources: {} })
  localStorage.clear()
}

function stockBouillon(qty = 1) {
  useInventoryStore.getState().addResources([
    { resourceId: 'herbe', amount: 2 * qty },
    { resourceId: 'champignon', amount: 1 * qty },
    { resourceId: 'eau', amount: 3 * qty },
  ])
}

function stockFarine(qty = 1) {
  useInventoryStore.getState().addResources([
    { resourceId: 'ble', amount: 3 * qty },
    { resourceId: 'eau', amount: 1 * qty },
  ])
}

function stockLingot(qty = 1) {
  useInventoryStore.getState().addResources([
    { resourceId: 'minerai_fer', amount: 3 * qty },
  ])
}

beforeEach(resetStores)

// ─── File : position et état des jobs ────────────────────────────────────────

describe('useCraftStore — position dans la file (UI)', () => {
  it('premier job : queuePosition=0 (isCurrentJob)', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    expect(useCraftStore.getState().queue[0].recipeId).toBe('bouillon_base')
    expect(useCraftStore.getState().queue.findIndex(j => j.recipeId === 'bouillon_base')).toBe(0)
  })

  it('deuxième job de la même recette : queuePosition=1 (isQueued)', () => {
    stockBouillon(2)
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const positions = useCraftStore.getState().queue.map(j => j.recipeId)
    expect(positions).toEqual(['bouillon_base', 'bouillon_base'])
  })

  it('recettes différentes en file : chacune a sa bonne position', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    const queue = useCraftStore.getState().queue
    expect(queue[0].recipeId).toBe('bouillon_base')
    expect(queue[1].recipeId).toBe('farine')
  })

  it('queueSize (jobs en attente) = queue.length - 1', () => {
    stockBouillon()
    stockFarine()
    stockLingot()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    useCraftStore.getState().enqueueCraft('lingot_fer')
    expect(useCraftStore.getState().queue.length - 1).toBe(2)
  })
})

// ─── getProgress avec firstTimeFast ──────────────────────────────────────────

describe('useCraftStore — getProgress avec firstTimeFast', () => {
  it('getProgress avec firstTimeFast : utilise 3000ms comme durée totale', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const job = useCraftStore.getState().queue[0]
    expect(job.isFirstTime).toBe(true)
    // Simuler 1.5s écoulées sur 3s → progress ≈ 0.5
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({
        ...j,
        startedAt: Date.now() - 1500,
        endsAt: Date.now() + 1500,
      }))
    })
    const progress = useCraftStore.getState().getProgress()
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
  })

  it('getProgress sans firstTimeFast : utilise craftTimeSeconds×1000 comme durée', () => {
    stockBouillon()
    useCraftStore.setState({ craftedOnce: { bouillon_base: true } })
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const job = useCraftStore.getState().queue[0]
    expect(job.isFirstTime).toBe(false)
    // Simuler 5s sur 10s → progress ≈ 0.5
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({
        ...j,
        startedAt: Date.now() - 5000,
        endsAt: Date.now() + 5000,
      }))
    })
    const progress = useCraftStore.getState().getProgress()
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
  })
})

// ─── processTick : enchaînement de la file ────────────────────────────────────

describe('useCraftStore — processTick enchaînement file', () => {
  it('deux jobs terminés dans le même tick sont tous deux complétés', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    // Forcer les deux jobs comme terminés
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({
        ...j,
        startedAt: Date.now() - 20000,
        endsAt: Date.now() - 1000,
      }))
    })
    const results = useCraftStore.getState().processTick()
    expect(results).toHaveLength(2)
    expect(results.map(r => r.recipeId)).toContain('bouillon_base')
    expect(results.map(r => r.recipeId)).toContain('farine')
    expect(useCraftStore.getState().queue).toHaveLength(0)
  })

  it('XP cumulé correctement sur plusieurs crafts successifs', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base') // 5xp
    useCraftStore.getState().enqueueCraft('farine')        // 4xp
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({
        ...j,
        startedAt: Date.now() - 20000,
        endsAt: Date.now() - 1000,
      }))
    })
    useCraftStore.getState().processTick()
    expect(useCraftStore.getState().totalXp).toBe(9) // 5 + 4
  })

  it('craftedOnce mis à jour pour toutes les recettes complétées', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({
        ...j,
        startedAt: Date.now() - 20000,
        endsAt: Date.now() - 1000,
      }))
    })
    useCraftStore.getState().processTick()
    expect(useCraftStore.getState().craftedOnce['bouillon_base']).toBe(true)
    expect(useCraftStore.getState().craftedOnce['farine']).toBe(true)
  })

  it('annulation du job en cours démarre le suivant au prochain tick', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    const firstId = useCraftStore.getState().queue[0].id
    useCraftStore.getState().cancelCraft(firstId)
    // La farine est maintenant en tête, startedAt=0
    expect(useCraftStore.getState().queue[0].recipeId).toBe('farine')
    expect(useCraftStore.getState().queue[0].startedAt).toBe(0)
    // Un tick la démarre
    useCraftStore.getState().processTick()
    expect(useCraftStore.getState().queue[0].startedAt).toBeGreaterThan(0)
  })
})

// ─── Tri "craftables en premier" (logique CraftPage) ─────────────────────────

describe('Tri des recettes (logique CraftPage)', () => {
  it('canAffordRecipe : bouillon craftable si stock exact', () => {
    expect(canAffordRecipe('bouillon_base', { herbe: 2, champignon: 1, eau: 3 })).toBe(true)
  })

  it('canAffordRecipe : non craftable si stock insuffisant', () => {
    expect(canAffordRecipe('bouillon_base', { herbe: 1 })).toBe(false)
  })

  it('tri : les craftables remontent avant les non-craftables', () => {
    // Stock pour bouillon seulement
    const inventory = { herbe: 2, champignon: 1, eau: 3 }
    const sorted = [...CRAFT_RECIPES].sort((a, b) => {
      const aAfford = canAffordRecipe(a.id, inventory)
      const bAfford = canAffordRecipe(b.id, inventory)
      if (aAfford && !bAfford) return -1
      if (!aAfford && bAfford) return 1
      return a.name.localeCompare(b.name)
    })
    expect(sorted[0].id).toBe('bouillon_base')
    expect(canAffordRecipe(sorted[0].id, inventory)).toBe(true)
    sorted.slice(1).forEach((r) => {
      expect(canAffordRecipe(r.id, inventory)).toBe(false)
    })
  })
})
