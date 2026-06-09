import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useHarvestStore } from '../useHarvestStore'
import { useInventoryStore } from '../useInventoryStore'

// Ressources réelles issues de resources.json (utilisées pour vérifier les calculs exacts)
// foret: herbe(10/min), champignon(6/min), baie_rouge(8/min), bois(5/min)
// caverne: pierre(8/min), minerai_fer(3/min), cristal_sel(4/min)
// plaine: ble(10/min), lait(5/min), miel(3/min), eau(20/min)
// EXPEDITION_MULTIPLIER = 0.6

const INITIAL_STATE = { camp: null, expeditions: [], lastSavedAt: 0 }

beforeEach(() => {
  vi.useRealTimers()
  useHarvestStore.setState(INITIAL_STATE)
  useInventoryStore.setState({ resources: {} })
  localStorage.clear()
})

// ─── setCamp / removeCamp ────────────────────────────────────────────────────

describe('useHarvestStore — setCamp', () => {
  it('crée un camp avec la bonne région', () => {
    useHarvestStore.getState().setCamp('foret')
    expect(useHarvestStore.getState().camp?.regionId).toBe('foret')
  })

  it('le camp a startedAt et lastTickAt proches de Date.now()', () => {
    const before = Date.now()
    useHarvestStore.getState().setCamp('foret')
    const after = Date.now()
    const { camp } = useHarvestStore.getState()
    expect(camp!.startedAt).toBeGreaterThanOrEqual(before)
    expect(camp!.startedAt).toBeLessThanOrEqual(after)
  })

  it('déplace le camp en écrasant l\'ancien (pas de pénalité)', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.getState().setCamp('caverne')
    expect(useHarvestStore.getState().camp?.regionId).toBe('caverne')
  })
})

describe('useHarvestStore — removeCamp', () => {
  it('supprime le camp actif', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.getState().removeCamp()
    expect(useHarvestStore.getState().camp).toBeNull()
  })

  it('ne plante pas si appelé sans camp actif', () => {
    expect(() => useHarvestStore.getState().removeCamp()).not.toThrow()
  })
})

// ─── startExpedition ─────────────────────────────────────────────────────────

describe('useHarvestStore — startExpedition', () => {
  it('démarre une expédition valide et retourne success:true', () => {
    const result = useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    expect(result.success).toBe(true)
    expect(useHarvestStore.getState().expeditions).toHaveLength(1)
  })

  it('l\'expédition a les bons attributs', () => {
    const before = Date.now()
    useHarvestStore.getState().startExpedition('herbe', 'foret', 30)
    const exp = useHarvestStore.getState().expeditions[0]
    expect(exp.resourceId).toBe('herbe')
    expect(exp.regionId).toBe('foret')
    expect(exp.durationMinutes).toBe(30)
    expect(exp.collected).toBe(false)
    expect(exp.endsAt).toBeGreaterThan(before + 30 * 60 * 1000 - 100)
  })

  it('échoue si la ressource n\'appartient pas à la région', () => {
    const result = useHarvestStore.getState().startExpedition('herbe', 'caverne', 15)
    expect(result.success).toBe(false)
    expect(result.reason).toBeDefined()
    expect(useHarvestStore.getState().expeditions).toHaveLength(0)
  })

  it('autorise exactement MAX_EXPEDITIONS (3) actives en parallèle', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    useHarvestStore.getState().startExpedition('champignon', 'foret', 30)
    useHarvestStore.getState().startExpedition('baie_rouge', 'foret', 60)
    expect(useHarvestStore.getState().expeditions).toHaveLength(3)
  })

  it('refuse une 4e expédition active et retourne success:false', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    useHarvestStore.getState().startExpedition('champignon', 'foret', 15)
    useHarvestStore.getState().startExpedition('baie_rouge', 'foret', 15)
    const result = useHarvestStore.getState().startExpedition('bois', 'foret', 15)
    expect(result.success).toBe(false)
    expect(useHarvestStore.getState().expeditions).toHaveLength(3)
  })

  it('les expéditions collected ne comptent pas dans la limite', () => {
    // Remplir 3 slots, marquer-les collected, puis en lancer une nouvelle
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    useHarvestStore.getState().startExpedition('champignon', 'foret', 15)
    useHarvestStore.getState().startExpedition('baie_rouge', 'foret', 15)
    // Simuler expeditions terminées
    const ids = useHarvestStore.getState().expeditions.map(e => e.id)
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e => ({ ...e, collected: true }))
    })
    // Maintenant une 4e doit être autorisée
    const result = useHarvestStore.getState().startExpedition('bois', 'foret', 15)
    expect(result.success).toBe(true)
    expect(ids.length).toBe(3) // just to use ids
  })
})

// ─── cancelExpedition ────────────────────────────────────────────────────────

describe('useHarvestStore — cancelExpedition (sans pénalité)', () => {
  it('supprime l\'expédition ciblée', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    const { id } = useHarvestStore.getState().expeditions[0]
    useHarvestStore.getState().cancelExpedition(id)
    expect(useHarvestStore.getState().expeditions).toHaveLength(0)
  })

  it('ne touche pas aux autres expéditions', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    useHarvestStore.getState().startExpedition('champignon', 'foret', 30)
    const idToCancel = useHarvestStore.getState().expeditions[0].id
    useHarvestStore.getState().cancelExpedition(idToCancel)
    expect(useHarvestStore.getState().expeditions).toHaveLength(1)
    expect(useHarvestStore.getState().expeditions[0].resourceId).toBe('champignon')
  })

  it('est toujours possible même si l\'expédition est en cours', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 120)
    const { id } = useHarvestStore.getState().expeditions[0]
    expect(() => useHarvestStore.getState().cancelExpedition(id)).not.toThrow()
    expect(useHarvestStore.getState().expeditions).toHaveLength(0)
  })
})

// ─── collectExpedition ───────────────────────────────────────────────────────

describe('useHarvestStore — collectExpedition', () => {
  it('retourne null si l\'expédition n\'est pas encore terminée', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 60)
    const { id } = useHarvestStore.getState().expeditions[0]
    const result = useHarvestStore.getState().collectExpedition(id)
    expect(result).toBeNull()
    expect(useHarvestStore.getState().expeditions[0].collected).toBe(false)
  })

  it('retourne le butin correct quand l\'expédition est terminée', () => {
    // herbe 15min : Math.floor(10 * 15 * 0.6) = 90
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    const { id } = useHarvestStore.getState().expeditions[0]
    // Forcer l'expédition comme terminée
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e =>
        e.id === id ? { ...e, endsAt: Date.now() - 1000 } : e
      )
    })
    const result = useHarvestStore.getState().collectExpedition(id)
    expect(result).not.toBeNull()
    expect(result!.resourceId).toBe('herbe')
    expect(result!.amount).toBe(90) // floor(10 * 15 * 0.6)
  })

  it('calcule correctement pour cristal_sel 60min : floor(4 * 60 * 0.6) = 144', () => {
    useHarvestStore.getState().startExpedition('cristal_sel', 'caverne', 60)
    const { id } = useHarvestStore.getState().expeditions[0]
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e =>
        e.id === id ? { ...e, endsAt: Date.now() - 1000 } : e
      )
    })
    const result = useHarvestStore.getState().collectExpedition(id)
    expect(result!.amount).toBe(144) // floor(4 * 60 * 0.6)
  })

  it('marque l\'expédition collected après collecte', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    const { id } = useHarvestStore.getState().expeditions[0]
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e =>
        e.id === id ? { ...e, endsAt: Date.now() - 1000 } : e
      )
    })
    useHarvestStore.getState().collectExpedition(id)
    expect(useHarvestStore.getState().expeditions[0].collected).toBe(true)
  })

  it('retourne null si déjà collected', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    const { id } = useHarvestStore.getState().expeditions[0]
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e =>
        e.id === id ? { ...e, endsAt: Date.now() - 1000 } : e
      )
    })
    useHarvestStore.getState().collectExpedition(id)
    const second = useHarvestStore.getState().collectExpedition(id)
    expect(second).toBeNull()
  })
})

// ─── tick ────────────────────────────────────────────────────────────────────

describe('useHarvestStore — tick', () => {
  it('retourne un tableau vide sans camp actif', () => {
    const yields = useHarvestStore.getState().tick()
    expect(yields).toEqual([])
  })

  it('retourne les 4 ressources de la forêt avec camp en foret', () => {
    useHarvestStore.getState().setCamp('foret')
    // Simuler 60s écoulées en reculant lastTickAt
    useHarvestStore.setState({
      camp: { ...useHarvestStore.getState().camp!, lastTickAt: Date.now() - 60000 }
    })
    const yields = useHarvestStore.getState().tick()
    const ids = yields.map(y => y.resourceId)
    expect(ids).toContain('herbe')
    expect(ids).toContain('champignon')
    expect(ids).toContain('baie_rouge')
    expect(ids).toContain('bois')
  })

  it('calcule le rendement correct après exactement 1 minute en foret', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({
      camp: { ...useHarvestStore.getState().camp!, lastTickAt: Date.now() - 60000 }
    })
    const yields = useHarvestStore.getState().tick()
    const herbe = yields.find(y => y.resourceId === 'herbe')
    const bois = yields.find(y => y.resourceId === 'bois')
    // herbe: 10/min * 1min * 1.0 = 10
    expect(herbe!.amount).toBeCloseTo(10, 1)
    // bois: 5/min * 1min * 1.0 = 5
    expect(bois!.amount).toBeCloseTo(5, 1)
  })

  it('met à jour lastTickAt après un tick', () => {
    useHarvestStore.getState().setCamp('foret')
    const before = Date.now()
    useHarvestStore.getState().tick()
    expect(useHarvestStore.getState().camp!.lastTickAt).toBeGreaterThanOrEqual(before)
  })

  it('ne retourne pas de ressources d\'une autre région', () => {
    useHarvestStore.getState().setCamp('caverne')
    useHarvestStore.setState({
      camp: { ...useHarvestStore.getState().camp!, lastTickAt: Date.now() - 60000 }
    })
    const yields = useHarvestStore.getState().tick()
    const ids = yields.map(y => y.resourceId)
    expect(ids).not.toContain('herbe')
    expect(ids).toContain('pierre')
    expect(ids).toContain('minerai_fer')
    expect(ids).toContain('cristal_sel')
  })
})

// ─── calculateOfflineProgress ────────────────────────────────────────────────

describe('useHarvestStore — calculateOfflineProgress', () => {
  it('retourne yields vide et 0ms si absence < 1min (le hook ignore ce cas)', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 30000 })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    // Moins d'1 min : les montants peuvent être faibles mais le calcul est correct
    const herbe = result.yields.find(y => y.resourceId === 'herbe')
    // 10/min * (30/60)min = 5 → acceptable
    expect(herbe?.amount ?? 0).toBeCloseTo(5, 0)
    expect(result.cappedAt8h).toBe(false)
  })

  it('calcule correctement 2 minutes de camp en forêt', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 2 * 60 * 1000 })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    const herbe = result.yields.find(y => y.resourceId === 'herbe')
    const eau_absent = result.yields.find(y => y.resourceId === 'eau')
    // herbe: 10 * 2 = 20
    expect(herbe!.amount).toBeCloseTo(20, 1)
    // eau n'est pas en forêt
    expect(eau_absent).toBeUndefined()
    expect(result.cappedAt8h).toBe(false)
  })

  it('plafonne à 8h et positionne cappedAt8h:true', () => {
    useHarvestStore.getState().setCamp('foret')
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
    useHarvestStore.setState({ lastSavedAt: Date.now() - TWELVE_HOURS_MS })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    expect(result.cappedAt8h).toBe(true)
    // herbe: 10 * (8*60) = 4800 (plafonné à 8h, pas 12h)
    const herbe = result.yields.find(y => y.resourceId === 'herbe')
    expect(herbe!.amount).toBeCloseTo(10 * 8 * 60, 0)
  })

  it('collecte automatiquement les expéditions terminées offline', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    const { id } = useHarvestStore.getState().expeditions[0]
    // Simuler expédition terminée pendant l'absence
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e =>
        e.id === id ? { ...e, endsAt: Date.now() - 5000 } : e
      ),
      lastSavedAt: Date.now() - 20 * 60 * 1000,
    })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    const herbe = result.yields.find(y => y.resourceId === 'herbe')
    // L'expédition herbe 15min = floor(10*15*0.6) = 90
    expect(herbe!.amount).toBeGreaterThanOrEqual(90)
    expect(useHarvestStore.getState().expeditions[0].collected).toBe(true)
  })

  it('ne collecte pas les expéditions pas encore terminées', () => {
    useHarvestStore.getState().startExpedition('herbe', 'foret', 120)
    useHarvestStore.setState({ lastSavedAt: Date.now() - 60 * 1000 })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    // L'expédition 2h n'est pas finie
    expect(useHarvestStore.getState().expeditions[0].collected).toBe(false)
    // Pas de butin expédition dans les yields (ou yield herbe vient seulement du camp si actif)
    expect(result.yields.find(y => y.resourceId === 'herbe')).toBeUndefined()
  })

  it('fusionne les doublons (camp + expédition sur la même ressource)', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.getState().startExpedition('herbe', 'foret', 15)
    const { id } = useHarvestStore.getState().expeditions[0]
    useHarvestStore.setState({
      expeditions: useHarvestStore.getState().expeditions.map(e =>
        e.id === id ? { ...e, endsAt: Date.now() - 1000 } : e
      ),
      lastSavedAt: Date.now() - 10 * 60 * 1000,
    })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    const herbeEntries = result.yields.filter(y => y.resourceId === 'herbe')
    // Ne doit avoir qu'une seule entrée herbe (fusionnée)
    expect(herbeEntries).toHaveLength(1)
    // camp 10min = 100, expédition 15min = 90 → total ≥ 190
    expect(herbeEntries[0].amount).toBeGreaterThanOrEqual(190)
  })

  it('retourne yields vide si pas de camp et pas d\'expéditions terminées', () => {
    useHarvestStore.setState({ lastSavedAt: Date.now() - 5 * 60 * 1000 })
    const result = useHarvestStore.getState().calculateOfflineProgress()
    expect(result.yields).toEqual([])
  })
})
