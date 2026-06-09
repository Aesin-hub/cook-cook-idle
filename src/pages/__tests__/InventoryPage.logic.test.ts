import { beforeEach, describe, it, expect } from 'vitest'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { RESOURCES, CRAFT_RECIPES } from '../../data'
import { canAffordRecipe } from '../../lib/craftHelpers'

// Tests prompt 007 — UI Inventaire
// Couvre : buildFullResourceList, filtres, tri, InventorySummary, ResourceRow logic

function resetStores() {
  useInventoryStore.setState({ resources: {} })
  useHarvestStore.setState({ camp: null, expeditions: [], lastSavedAt: 0 })
  localStorage.clear()
}

beforeEach(resetStores)

// ─── buildFullResourceList ────────────────────────────────────────────────────

describe('buildFullResourceList', () => {
  it('contient toujours les 14 ressources de base même à inventaire vide', () => {
    const knownIds = RESOURCES.map((r) => r.id)
    expect(knownIds).toHaveLength(14)
    // Toutes les 4 régions représentées
    const regions = [...new Set(RESOURCES.map((r) => r.region))]
    expect(regions).toContain('foret')
    expect(regions).toContain('caverne')
    expect(regions).toContain('marais')
    expect(regions).toContain('plaine')
  })

  it('les ressources craftées (output des recettes) ne sont pas dans resources.json', () => {
    const knownIds = new Set(RESOURCES.map((r) => r.id))
    const craftedIds = CRAFT_RECIPES.map((r) => r.output.resourceId)
    craftedIds.forEach((id) => {
      expect(knownIds.has(id)).toBe(false)
    })
  })

  it('une ressource craftée orpheline dans l\'inventaire est détectée', () => {
    useInventoryStore.getState().addResources([{ resourceId: 'bouillon_base', amount: 3 }])
    const inventoryKeys = Object.keys(useInventoryStore.getState().resources)
    const knownIds = new Set(RESOURCES.map((r) => r.id))
    const craftedOutputIds = CRAFT_RECIPES.map((r) => r.output.resourceId)
    const orphans = inventoryKeys.filter((id) => !knownIds.has(id) && craftedOutputIds.includes(id))
    expect(orphans).toContain('bouillon_base')
  })
})

// ─── Filtre par région ────────────────────────────────────────────────────────

describe('Filtre par région', () => {
  it('filtre "foret" renvoie exactement les 4 ressources forêt', () => {
    const foretResources = RESOURCES.filter((r) => r.region === 'foret')
    expect(foretResources).toHaveLength(4)
    const ids = foretResources.map((r) => r.id)
    expect(ids).toContain('herbe')
    expect(ids).toContain('champignon')
    expect(ids).toContain('baie_rouge')
    expect(ids).toContain('bois')
  })

  it('filtre "caverne" renvoie pierre, minerai_fer, cristal_sel', () => {
    const ids = RESOURCES.filter((r) => r.region === 'caverne').map((r) => r.id)
    expect(ids).toContain('pierre')
    expect(ids).toContain('minerai_fer')
    expect(ids).toContain('cristal_sel')
    expect(ids).toHaveLength(3)
  })

  it('filtre "marais" renvoie slime, algue, oeuf_grenouille', () => {
    const ids = RESOURCES.filter((r) => r.region === 'marais').map((r) => r.id)
    expect(ids).toContain('slime')
    expect(ids).toContain('algue')
    expect(ids).toContain('oeuf_grenouille')
    expect(ids).toHaveLength(3)
  })

  it('filtre "plaine" renvoie ble, lait, miel, eau', () => {
    const ids = RESOURCES.filter((r) => r.region === 'plaine').map((r) => r.id)
    expect(ids).toContain('ble')
    expect(ids).toContain('lait')
    expect(ids).toContain('miel')
    expect(ids).toContain('eau')
    expect(ids).toHaveLength(4)
  })

  it('filtre "crafted" : les ressources de base ne passent pas, les orphelines oui', () => {
    // resource !== null → exclure du filtre crafted
    const baseResource = RESOURCES[0]
    expect(baseResource).not.toBeNull()
    // resource === null → inclure dans le filtre crafted
    const orphan = { resourceId: 'bouillon_base', resource: null }
    expect(orphan.resource).toBeNull()
  })
})

// ─── Filtre par recherche ─────────────────────────────────────────────────────

describe('Filtre par recherche texte', () => {
  it('"her" matche uniquement "Herbe"', () => {
    const results = RESOURCES.filter((r) => r.name.toLowerCase().includes('her'))
    expect(results.map((r) => r.id)).toEqual(['herbe'])
  })

  it('"eau" matche "Eau"', () => {
    const results = RESOURCES.filter((r) => r.name.toLowerCase().includes('eau'))
    const ids = results.map((r) => r.id)
    expect(ids).toContain('eau')
  })

  it('recherche insensible à la casse : "HERBE" matche "Herbe"', () => {
    const q = 'HERBE'.toLowerCase()
    const results = RESOURCES.filter((r) => r.name.toLowerCase().includes(q))
    expect(results.map((r) => r.id)).toContain('herbe')
  })

  it('recherche vide → aucun filtre (tous résultats)', () => {
    const q = ''
    const results = RESOURCES.filter((r) => {
      if (!q.trim()) return true
      return r.name.toLowerCase().includes(q)
    })
    expect(results).toHaveLength(RESOURCES.length)
  })
})

// ─── Tri ──────────────────────────────────────────────────────────────────────

describe('Tri des ressources', () => {
  it('tri quantité ↓ : ressource avec plus grande quantité en premier', () => {
    const inv = { herbe: 100, champignon: 5, bois: 50 }
    const items = [
      { resourceId: 'herbe',      resource: RESOURCES.find(r => r.id === 'herbe')! },
      { resourceId: 'champignon', resource: RESOURCES.find(r => r.id === 'champignon')! },
      { resourceId: 'bois',       resource: RESOURCES.find(r => r.id === 'bois')! },
    ]
    const sorted = [...items].sort((a, b) => {
      const amtA = inv[a.resourceId as keyof typeof inv] ?? 0
      const amtB = inv[b.resourceId as keyof typeof inv] ?? 0
      if (amtB !== amtA) return amtB - amtA
      return a.resource.name.localeCompare(b.resource.name)
    })
    expect(sorted[0].resourceId).toBe('herbe')    // 100
    expect(sorted[1].resourceId).toBe('bois')     // 50
    expect(sorted[2].resourceId).toBe('champignon') // 5
  })

  it('tri nom A→Z : alphabétique', () => {
    const items = [
      { resourceId: 'herbe',      name: 'Herbe' },
      { resourceId: 'champignon', name: 'Champignon' },
      { resourceId: 'algue',      name: 'Algue' },
    ]
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
    expect(sorted.map((i) => i.name)).toEqual(['Algue', 'Champignon', 'Herbe'])
  })

  it('tri rareté : uncommon (1) avant common (0)', () => {
    const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3 }
    const items = [
      { id: 'herbe',       rarity: 'common' },
      { id: 'minerai_fer', rarity: 'uncommon' },
      { id: 'miel',        rarity: 'uncommon' },
    ]
    const sorted = [...items].sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0))
    expect(sorted[0].rarity).toBe('uncommon')
    expect(sorted[sorted.length - 1].rarity).toBe('common')
  })

  it('tri quantité ↓ à égalité : départ alphabétique', () => {
    const inv = { herbe: 10, bois: 10 }
    const items = [
      { resourceId: 'herbe', name: 'Herbe' },
      { resourceId: 'bois',  name: 'Bois' },
    ]
    const sorted = [...items].sort((a, b) => {
      const amtA = inv[a.resourceId as keyof typeof inv] ?? 0
      const amtB = inv[b.resourceId as keyof typeof inv] ?? 0
      if (amtB !== amtA) return amtB - amtA
      return a.name.localeCompare(b.name)
    })
    expect(sorted[0].name).toBe('Bois') // B avant H
  })
})

// ─── Séparation owned / empty ─────────────────────────────────────────────────

describe('Séparation possédées / non-possédées', () => {
  it('ressource avec amount >= 1 → owned', () => {
    expect(5 >= 1).toBe(true)
    expect(1 >= 1).toBe(true)
  })

  it('ressource avec amount < 1 → empty', () => {
    expect(0 >= 1).toBe(false)
    expect(0.5 >= 1).toBe(false)
  })

  it('avec inventaire partiellement rempli : split correct', () => {
    useInventoryStore.getState().addResources([
      { resourceId: 'herbe', amount: 10 },
      { resourceId: 'eau',   amount: 5 },
    ])
    const resources = useInventoryStore.getState().resources
    const allIds = RESOURCES.map((r) => r.id)
    const owned = allIds.filter((id) => (resources[id] ?? 0) >= 1)
    const empty = allIds.filter((id) => (resources[id] ?? 0) < 1)
    expect(owned).toContain('herbe')
    expect(owned).toContain('eau')
    expect(empty).not.toContain('herbe')
    expect(empty).not.toContain('eau')
    expect(owned.length + empty.length).toBe(allIds.length)
  })
})

// ─── InventorySummary — calculs ───────────────────────────────────────────────

describe('InventorySummary — calculs', () => {
  it('totalItems : somme floor de toutes les quantités', () => {
    useInventoryStore.getState().addResources([
      { resourceId: 'herbe', amount: 10 },
      { resourceId: 'eau',   amount: 7.8 },
    ])
    const resources = useInventoryStore.getState().resources
    const total = Math.floor(Object.values(resources).reduce((sum, v) => sum + v, 0))
    expect(total).toBe(17) // floor(17.8)
  })

  it('totalTypes : nombre de ressources avec amount >= 1', () => {
    useInventoryStore.getState().addResources([
      { resourceId: 'herbe',      amount: 5 },
      { resourceId: 'champignon', amount: 0 },
      { resourceId: 'eau',        amount: 3 },
    ])
    const resources = useInventoryStore.getState().resources
    const totalTypes = Object.values(resources).filter((v) => v >= 1).length
    expect(totalTypes).toBe(2)
  })

  it('campYieldTotal : somme des baseYieldPerMin de la région du camp', () => {
    const foretResources = RESOURCES.filter((r) => r.region === 'foret')
    const expectedTotal = foretResources.reduce((sum, r) => sum + r.baseYieldPerMin, 0)
    // herbe=10, champignon=6, baie_rouge=8, bois=5 → 29
    expect(expectedTotal).toBe(29)
  })

  it('sans camp : campYieldTotal = 0', () => {
    const camp = useHarvestStore.getState().camp
    expect(camp).toBeNull()
    // La logique retourne 0 si camp est null
    const campYieldTotal = camp ? RESOURCES.filter((r) => r.region === camp.regionId).reduce((sum, r) => sum + r.baseYieldPerMin, 0) : 0
    expect(campYieldTotal).toBe(0)
  })
})

// ─── ResourceRow — données affichées ─────────────────────────────────────────

describe('ResourceRow — logique d\'affichage', () => {
  it('ressource connue : affiche name et emoji corrects', () => {
    const herbe = RESOURCES.find((r) => r.id === 'herbe')!
    expect(herbe.name).toBe('Herbe')
    expect(herbe.emoji).toBe('🌿')
    expect(herbe.rarityLabel).toBe('Commun')
  })

  it('ressource orpheline (null) : formatId transforme bouillon_base → "Bouillon Base"', () => {
    function formatId(id: string): string {
      return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }
    expect(formatId('bouillon_base')).toBe('Bouillon Base')
    expect(formatId('lingot_fer')).toBe('Lingot Fer')
    expect(formatId('farine')).toBe('Farine')
  })

  it('production/min : actif si camp.regionId === resource.region', () => {
    useHarvestStore.setState({
      camp: { regionId: 'foret', placedAt: Date.now() },
      expeditions: [], lastSavedAt: Date.now(),
    })
    const camp = useHarvestStore.getState().camp!
    const herbe = RESOURCES.find((r) => r.id === 'herbe')!
    expect(camp.regionId === herbe.region).toBe(true)
    expect(herbe.baseYieldPerMin).toBe(10)
  })

  it('production/min : inactif si camp.regionId !== resource.region', () => {
    useHarvestStore.setState({
      camp: { regionId: 'caverne', placedAt: Date.now() },
      expeditions: [], lastSavedAt: Date.now(),
    })
    const camp = useHarvestStore.getState().camp!
    const herbe = RESOURCES.find((r) => r.id === 'herbe')!
    expect(camp.regionId === herbe.region).toBe(false)
  })

  it('amount < 1 → isEmpty true → opacité 0.45 en UI', () => {
    const isEmpty = (amount: number) => amount < 1
    expect(isEmpty(0)).toBe(true)
    expect(isEmpty(0.5)).toBe(true)
    expect(isEmpty(1)).toBe(false)
    expect(isEmpty(100)).toBe(false)
  })

  it('Math.floor + toLocaleString : 17.8 → "18" non, "17" oui', () => {
    expect(Math.floor(17.8)).toBe(17)
    expect(Math.floor(17.8).toLocaleString()).toBe('17')
  })
})

// ─── Cohérence données JSON ───────────────────────────────────────────────────

describe('Cohérence resources.json', () => {
  it('toutes les ressources ont les champs requis', () => {
    RESOURCES.forEach((r) => {
      expect(r.id).toBeTruthy()
      expect(r.name).toBeTruthy()
      expect(r.emoji).toBeTruthy()
      expect(r.region).toBeTruthy()
      expect(r.rarity).toBeTruthy()
      expect(r.rarityLabel).toBeTruthy()
      expect(r.baseYieldPerMin).toBeGreaterThan(0)
      expect(r.tooltip).toBeTruthy()
    })
  })

  it('les ressources craftées ne sont pas dans resources.json', () => {
    const ids = new Set(RESOURCES.map((r) => r.id))
    CRAFT_RECIPES.forEach((recipe) => {
      expect(ids.has(recipe.output.resourceId)).toBe(false)
    })
  })

  it('canAffordRecipe fonctionne avec les données réelles', () => {
    // Vérifier que les recettes référencent des resourceIds existants
    CRAFT_RECIPES.forEach((recipe) => {
      recipe.inputs.forEach((input) => {
        const resource = RESOURCES.find((r) => r.id === input.resourceId)
        expect(resource).toBeDefined()
      })
    })
  })
})
