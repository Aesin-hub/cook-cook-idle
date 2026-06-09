import { describe, it, expect } from 'vitest'
import { canAffordRecipe, getMissingReason, formatCraftTime, getRemainingSeconds } from '../craftHelpers'

// bouillon_base : herbe×2 + champignon×1 + eau×3
// farine        : ble×3 + eau×1
// lingot_fer    : minerai_fer×3

// ─── canAffordRecipe ─────────────────────────────────────────────────────────

describe('canAffordRecipe', () => {
  it('retourne true quand le stock est exact', () => {
    expect(canAffordRecipe('bouillon_base', { herbe: 2, champignon: 1, eau: 3 })).toBe(true)
  })

  it('retourne true quand le stock est supérieur au nécessaire', () => {
    expect(canAffordRecipe('bouillon_base', { herbe: 10, champignon: 5, eau: 20 })).toBe(true)
  })

  it('retourne false si une ressource manque', () => {
    expect(canAffordRecipe('bouillon_base', { herbe: 1, champignon: 1, eau: 3 })).toBe(false)
  })

  it('retourne false si une ressource est absente', () => {
    expect(canAffordRecipe('bouillon_base', { herbe: 2, eau: 3 })).toBe(false)
  })

  it('retourne false pour une recette inconnue', () => {
    expect(canAffordRecipe('recette_inexistante', { herbe: 99 })).toBe(false)
  })

  it('gère quantity > 1 correctement', () => {
    // quantity=2 : besoin herbe×4, champignon×2, eau×6
    expect(canAffordRecipe('bouillon_base', { herbe: 4, champignon: 2, eau: 6 }, 2)).toBe(true)
    expect(canAffordRecipe('bouillon_base', { herbe: 3, champignon: 2, eau: 6 }, 2)).toBe(false)
  })

  it('inventaire vide retourne false', () => {
    expect(canAffordRecipe('farine', {})).toBe(false)
  })
})

// ─── getMissingReason ────────────────────────────────────────────────────────

describe('getMissingReason', () => {
  it('retourne null si le joueur peut se permettre la recette', () => {
    expect(getMissingReason('bouillon_base', { herbe: 2, champignon: 1, eau: 3 })).toBeNull()
  })

  it('retourne un message avec emoji et nom de la ressource manquante', () => {
    const msg = getMissingReason('bouillon_base', { herbe: 0, champignon: 1, eau: 3 })
    expect(msg).toContain('🌿')     // emoji de herbe
    expect(msg).toContain('Herbe')  // nom lisible
    expect(msg).toContain('2')      // quantité manquante
  })

  it('indique la quantité exacte manquante', () => {
    // Besoin 2 herbe, a 1 → manque 1
    const msg = getMissingReason('bouillon_base', { herbe: 1, champignon: 1, eau: 3 })
    expect(msg).toContain('1')
    expect(msg).toContain('Herbe')
  })

  it('retourne null pour une recette inconnue', () => {
    expect(getMissingReason('recette_inexistante', {})).toBeNull()
  })

  it('farine — message correct pour ble manquant', () => {
    const msg = getMissingReason('farine', { ble: 1, eau: 1 })
    expect(msg).toContain('Blé')
    expect(msg).toContain('2')  // besoin 3, a 1 → manque 2
  })

  it('lingot_fer — message correct pour minerai_fer manquant', () => {
    const msg = getMissingReason('lingot_fer', { minerai_fer: 1 })
    expect(msg).toContain('Minerai de Fer')
    expect(msg).toContain('2') // besoin 3, a 1 → manque 2
  })

  it('gère quantity > 1 : manque correct pour 2 bouillons', () => {
    // quantity=2 : besoin herbe×4, a 2 → manque 2
    const msg = getMissingReason('bouillon_base', { herbe: 2, champignon: 2, eau: 6 }, 2)
    expect(msg).toContain('Herbe')
    expect(msg).toContain('2')
  })
})

// ─── formatCraftTime ─────────────────────────────────────────────────────────

describe('formatCraftTime', () => {
  it('affiche en secondes pour moins d\'1 minute', () => {
    expect(formatCraftTime(0)).toBe('0s')
    expect(formatCraftTime(3)).toBe('3s')
    expect(formatCraftTime(59)).toBe('59s')
  })

  it('affiche en minutes exactes', () => {
    expect(formatCraftTime(60)).toBe('1m')
    expect(formatCraftTime(120)).toBe('2m')
  })

  it('affiche minutes + secondes', () => {
    expect(formatCraftTime(90)).toBe('1m 30s')
    expect(formatCraftTime(125)).toBe('2m 5s')
  })
})

// ─── getRemainingSeconds ─────────────────────────────────────────────────────

describe('getRemainingSeconds', () => {
  it('retourne 0 si endsAt est dans le passé', () => {
    expect(getRemainingSeconds(Date.now() - 5000)).toBe(0)
  })

  it('retourne le bon nombre de secondes restantes', () => {
    const endsAt = Date.now() + 10000
    expect(getRemainingSeconds(endsAt)).toBe(10)
  })

  it('arrondit au supérieur (ceil)', () => {
    const endsAt = Date.now() + 10500
    expect(getRemainingSeconds(endsAt)).toBe(11)
  })
})
