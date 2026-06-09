import { beforeEach, describe, it, expect } from 'vitest'
import { useCraftStore } from '../useCraftStore'
import { useInventoryStore } from '../useInventoryStore'

// Données réelles issues de craft-recipes.json
// bouillon_base : herbe×2 + champignon×1 + eau×3 → bouillon_base×1, 10s, firstTimeFast=true, 5xp
// farine        : ble×3 + eau×1 → farine×2, 8s, firstTimeFast=true, 4xp
// lingot_fer    : minerai_fer×3 → lingot_fer×1, 15s, firstTimeFast=true, 8xp

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

beforeEach(resetStores)

// ─── enqueueCraft ────────────────────────────────────────────────────────────

describe('useCraftStore — enqueueCraft', () => {
  it('retourne success:true et ajoute le job à la file', () => {
    stockBouillon()
    const result = useCraftStore.getState().enqueueCraft('bouillon_base')
    expect(result.success).toBe(true)
    expect(useCraftStore.getState().queue).toHaveLength(1)
  })

  it('débite les ingrédients immédiatement au lancement', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const inv = useInventoryStore.getState().resources
    expect(inv['herbe'] ?? 0).toBe(0)
    expect(inv['champignon'] ?? 0).toBe(0)
    expect(inv['eau'] ?? 0).toBe(0)
  })

  it('échoue si stock insuffisant et retourne un message précis', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'herbe', amount: 1 }])
    // il manque 1 herbe (besoin 2), champignon, eau
    const result = useCraftStore.getState().enqueueCraft('bouillon_base')
    expect(result.success).toBe(false)
    expect(result.reason).toContain('herbe')
    expect(useCraftStore.getState().queue).toHaveLength(0)
  })

  it('ne débite rien en cas d\'échec', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'herbe', amount: 1 }])
    useCraftStore.getState().enqueueCraft('bouillon_base')
    expect(useInventoryStore.getState().getAmount('herbe')).toBe(1)
  })

  it('échoue sur une recette inconnue', () => {
    const result = useCraftStore.getState().enqueueCraft('recette_inexistante')
    expect(result.success).toBe(false)
  })

  it('premier craft avec firstTimeFast=true → isFirstTime=true', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    expect(useCraftStore.getState().queue[0].isFirstTime).toBe(true)
  })

  it('deuxième craft de la même recette → isFirstTime=false', () => {
    stockBouillon(2)
    useCraftStore.getState().enqueueCraft('bouillon_base')
    // Marquer comme déjà crafté
    useCraftStore.setState({ craftedOnce: { bouillon_base: true } })
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const jobs = useCraftStore.getState().queue
    expect(jobs[1].isFirstTime).toBe(false)
  })

  it('premier job démarre immédiatement (startedAt et endsAt non nuls)', () => {
    stockBouillon()
    const before = Date.now()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const job = useCraftStore.getState().queue[0]
    expect(job.startedAt).toBeGreaterThanOrEqual(before)
    expect(job.endsAt).toBeGreaterThan(job.startedAt)
  })

  it('job en attente (pas le premier) a startedAt=0 et endsAt=0', () => {
    stockBouillon(2)
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const second = useCraftStore.getState().queue[1]
    expect(second.startedAt).toBe(0)
    expect(second.endsAt).toBe(0)
  })

  it('durée du premier craft isFirstTime = 3s', () => {
    stockBouillon()
    const before = Date.now()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const job = useCraftStore.getState().queue[0]
    expect(job.endsAt - before).toBeCloseTo(3000, -2)
  })

  it('durée normale du bouillon_base = 10s', () => {
    stockBouillon()
    useCraftStore.setState({ craftedOnce: { bouillon_base: true } })
    const before = Date.now()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const job = useCraftStore.getState().queue[0]
    expect(job.endsAt - before).toBeCloseTo(10000, -2)
  })

  it('gère quantity > 1 : débite les bons montants', () => {
    stockBouillon(3)
    useCraftStore.getState().enqueueCraft('bouillon_base', 3)
    expect(useInventoryStore.getState().getAmount('herbe')).toBe(0)
    expect(useCraftStore.getState().queue[0].quantity).toBe(3)
  })
})

// ─── cancelCraft ─────────────────────────────────────────────────────────────

describe('useCraftStore — cancelCraft', () => {
  it('supprime le job de la file', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const { id } = useCraftStore.getState().queue[0]
    useCraftStore.getState().cancelCraft(id)
    expect(useCraftStore.getState().queue).toHaveLength(0)
  })

  it('rembourse intégralement les ingrédients', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const { id } = useCraftStore.getState().queue[0]
    useCraftStore.getState().cancelCraft(id)
    expect(useInventoryStore.getState().getAmount('herbe')).toBe(2)
    expect(useInventoryStore.getState().getAmount('champignon')).toBe(1)
    expect(useInventoryStore.getState().getAmount('eau')).toBe(3)
  })

  it('rembourse correctement pour quantity > 1', () => {
    stockBouillon(2)
    useCraftStore.getState().enqueueCraft('bouillon_base', 2)
    const { id } = useCraftStore.getState().queue[0]
    useCraftStore.getState().cancelCraft(id)
    expect(useInventoryStore.getState().getAmount('herbe')).toBe(4)
  })

  it('ne touche pas aux autres jobs de la file', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    const firstId = useCraftStore.getState().queue[0].id
    useCraftStore.getState().cancelCraft(firstId)
    expect(useCraftStore.getState().queue).toHaveLength(1)
    expect(useCraftStore.getState().queue[0].recipeId).toBe('farine')
  })

  it('ne plante pas sur un id inexistant', () => {
    expect(() => useCraftStore.getState().cancelCraft('id-inexistant')).not.toThrow()
  })

  it('est possible même si le craft est en cours', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const { id } = useCraftStore.getState().queue[0]
    // Le job est déjà démarré (startedAt != 0)
    expect(useCraftStore.getState().queue[0].startedAt).toBeGreaterThan(0)
    useCraftStore.getState().cancelCraft(id)
    expect(useCraftStore.getState().queue).toHaveLength(0)
  })
})

// ─── processTick ─────────────────────────────────────────────────────────────

describe('useCraftStore — processTick', () => {
  it('retourne [] si la file est vide', () => {
    expect(useCraftStore.getState().processTick()).toEqual([])
  })

  it('retourne [] si le craft n\'est pas encore terminé', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const results = useCraftStore.getState().processTick()
    expect(results).toEqual([])
  })

  it('retourne un CraftResult complet à la fin du craft', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    // Forcer la fin
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    const results = useCraftStore.getState().processTick()
    expect(results).toHaveLength(1)
    expect(results[0].recipeId).toBe('bouillon_base')
    expect(results[0].recipeName).toBe('Bouillon de Base')
    expect(results[0].recipeEmoji).toBe('🍵')
    expect(results[0].output.resourceId).toBe('bouillon_base')
    expect(results[0].output.amount).toBe(1)
    expect(results[0].xpGained).toBe(5)
  })

  it('crédite l\'output dans l\'inventaire', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    useCraftStore.getState().processTick()
    expect(useInventoryStore.getState().getAmount('bouillon_base')).toBe(1)
  })

  it('farine produit 2 unités (output.quantity=2)', () => {
    stockFarine()
    useCraftStore.getState().enqueueCraft('farine')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    const results = useCraftStore.getState().processTick()
    expect(results[0].output.amount).toBe(2)
    expect(useInventoryStore.getState().getAmount('farine')).toBe(2)
  })

  it('augmente totalXp du bon montant', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    useCraftStore.getState().processTick()
    expect(useCraftStore.getState().totalXp).toBe(5)
  })

  it('quantity=3 → output×3 et xp×3', () => {
    stockBouillon(3)
    useCraftStore.getState().enqueueCraft('bouillon_base', 3)
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    const results = useCraftStore.getState().processTick()
    expect(results[0].output.amount).toBe(3)
    expect(results[0].xpGained).toBe(15)
    expect(useCraftStore.getState().totalXp).toBe(15)
  })

  it('marque craftedOnce après complétion', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    useCraftStore.getState().processTick()
    expect(useCraftStore.getState().craftedOnce['bouillon_base']).toBe(true)
  })

  it('démarre le job suivant dans la file après complétion', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    expect(useCraftStore.getState().queue[1].startedAt).toBe(0)
    // Finir le premier
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map((j, i) =>
        i === 0 ? { ...j, endsAt: Date.now() - 1000 } : j
      )
    })
    useCraftStore.getState().processTick()
    // Le deuxième doit maintenant être démarré
    expect(useCraftStore.getState().queue[0].recipeId).toBe('farine')
    expect(useCraftStore.getState().queue[0].startedAt).toBeGreaterThan(0)
  })

  it('supprime le job terminé de la file', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({ ...j, endsAt: Date.now() - 1000 }))
    })
    useCraftStore.getState().processTick()
    expect(useCraftStore.getState().queue).toHaveLength(0)
  })
})

// ─── getCurrentJob / getQueueLength / getProgress ────────────────────────────

describe('useCraftStore — getters', () => {
  it('getCurrentJob retourne null si file vide', () => {
    expect(useCraftStore.getState().getCurrentJob()).toBeNull()
  })

  it('getCurrentJob retourne le premier job de la file', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const job = useCraftStore.getState().getCurrentJob()
    expect(job?.recipeId).toBe('bouillon_base')
  })

  it('getQueueLength retourne 0 si vide', () => {
    expect(useCraftStore.getState().getQueueLength()).toBe(0)
  })

  it('getQueueLength retourne le bon nombre', () => {
    stockBouillon()
    stockFarine()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('farine')
    expect(useCraftStore.getState().getQueueLength()).toBe(2)
  })

  it('getProgress retourne 0 si file vide', () => {
    expect(useCraftStore.getState().getProgress()).toBe(0)
  })

  it('getProgress retourne 0 si le job n\'est pas encore démarré', () => {
    stockBouillon(2)
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.getState().enqueueCraft('bouillon_base')
    // Forcer le second à startedAt=0
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map((j, i) =>
        i === 1 ? { ...j, startedAt: 0, endsAt: 0 } : j
      )
    })
    // Supprimer le premier pour tester le second
    useCraftStore.setState({ queue: [useCraftStore.getState().queue[1]] })
    expect(useCraftStore.getState().getProgress()).toBe(0)
  })

  it('getProgress retourne une valeur entre 0 et 1 en cours de craft', () => {
    stockBouillon()
    useCraftStore.setState({ craftedOnce: { bouillon_base: true } }) // pas firstTimeFast
    useCraftStore.getState().enqueueCraft('bouillon_base')
    const progress = useCraftStore.getState().getProgress()
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(1)
  })

  it('getProgress retourne 1 quand le craft est terminé et non encore consommé', () => {
    stockBouillon()
    useCraftStore.getState().enqueueCraft('bouillon_base')
    useCraftStore.setState({
      queue: useCraftStore.getState().queue.map(j => ({
        ...j, startedAt: Date.now() - 20000, endsAt: Date.now() - 1000
      }))
    })
    expect(useCraftStore.getState().getProgress()).toBe(1)
  })
})
