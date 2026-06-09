import { beforeEach, describe, it, expect } from 'vitest'
import { useInventoryStore } from '../useInventoryStore'

beforeEach(() => {
  useInventoryStore.setState({ resources: {} })
  localStorage.clear()
})

describe('useInventoryStore — addResources', () => {
  it('ajoute des ressources dans un inventaire vide', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'herbe', amount: 10 }])
    expect(useInventoryStore.getState().resources['herbe']).toBe(10)
  })

  it('accumule correctement sur une ressource existante', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'herbe', amount: 10 }])
    useInventoryStore.getState().addResources([{ resourceId: 'herbe', amount: 5 }])
    expect(useInventoryStore.getState().resources['herbe']).toBe(15)
  })

  it('ajoute plusieurs ressources différentes en une passe', () => {
    useInventoryStore.getState().addResources([
      { resourceId: 'herbe', amount: 10 },
      { resourceId: 'bois', amount: 3 },
    ])
    expect(useInventoryStore.getState().resources['herbe']).toBe(10)
    expect(useInventoryStore.getState().resources['bois']).toBe(3)
  })

  it('accepte des montants fractionnels (les stores ne floor pas — c\'est l\'affichage qui le fait)', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'herbe', amount: 0.1667 }])
    expect(useInventoryStore.getState().resources['herbe']).toBeCloseTo(0.1667, 4)
  })
})

describe('useInventoryStore — removeResources', () => {
  beforeEach(() => {
    useInventoryStore.getState().addResources([
      { resourceId: 'herbe', amount: 20 },
      { resourceId: 'bois', amount: 5 },
    ])
  })

  it('retire les ressources et retourne true quand le stock est suffisant', () => {
    const ok = useInventoryStore.getState().removeResources([{ resourceId: 'herbe', amount: 10 }])
    expect(ok).toBe(true)
    expect(useInventoryStore.getState().resources['herbe']).toBe(10)
  })

  it('retourne false et ne modifie rien quand le stock est insuffisant', () => {
    const ok = useInventoryStore.getState().removeResources([{ resourceId: 'herbe', amount: 999 }])
    expect(ok).toBe(false)
    expect(useInventoryStore.getState().resources['herbe']).toBe(20)
  })

  it('retourne false si une seule ressource manque (atomique — tout ou rien)', () => {
    const ok = useInventoryStore.getState().removeResources([
      { resourceId: 'herbe', amount: 5 },
      { resourceId: 'bois', amount: 999 },
    ])
    expect(ok).toBe(false)
    expect(useInventoryStore.getState().resources['herbe']).toBe(20)
    expect(useInventoryStore.getState().resources['bois']).toBe(5)
  })

  it('retourne false si la ressource est absente de l\'inventaire', () => {
    const ok = useInventoryStore.getState().removeResources([{ resourceId: 'cristal_sel', amount: 1 }])
    expect(ok).toBe(false)
  })
})

describe('useInventoryStore — getAmount', () => {
  it('retourne 0 pour une ressource inconnue', () => {
    expect(useInventoryStore.getState().getAmount('inexistant')).toBe(0)
  })

  it('retourne la valeur correcte pour une ressource connue', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'eau', amount: 42 }])
    expect(useInventoryStore.getState().getAmount('eau')).toBe(42)
  })
})

describe('useInventoryStore — reset', () => {
  it('vide intégralement l\'inventaire', () => {
    useInventoryStore.getState().addResources([
      { resourceId: 'herbe', amount: 100 },
      { resourceId: 'eau', amount: 50 },
    ])
    useInventoryStore.getState().reset()
    expect(useInventoryStore.getState().resources).toEqual({})
  })
})
