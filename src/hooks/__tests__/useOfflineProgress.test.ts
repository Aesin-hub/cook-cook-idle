import { beforeEach, describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOfflineProgress } from '../useOfflineProgress'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'

// foret: herbe(10/min), champignon(6/min), baie_rouge(8/min), bois(5/min)

beforeEach(() => {
  useHarvestStore.setState({ camp: null, expeditions: [], lastSavedAt: Date.now() })
  useInventoryStore.setState({ resources: {} })
  localStorage.clear()
})

describe('useOfflineProgress', () => {
  it('retourne null si absence < 1 minute', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 30000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current).toBeNull()
  })

  it('retourne null si pas de camp et pas d\'expéditions terminées', () => {
    useHarvestStore.setState({ lastSavedAt: Date.now() - 5 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current).toBeNull()
  })

  it('retourne un résultat avec yields si camp actif et absence > 1min', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 2 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current).not.toBeNull()
    expect(result.current!.yieldsDisplay.length).toBeGreaterThan(0)
  })

  it('yieldsDisplay contient des noms et emojis lisibles (jamais d\'IDs)', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 3 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    const herbe = result.current!.yieldsDisplay.find((y) => y.name === 'Herbe')
    expect(herbe).toBeDefined()
    expect(herbe!.emoji).toBe('🌿')
    expect(herbe!.amount).toBeGreaterThan(0)
  })

  it('les montants affichés sont floored (entiers)', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 90 * 1000 }) // 1.5 min

    const { result } = renderHook(() => useOfflineProgress())
    result.current!.yieldsDisplay.forEach((y) => {
      expect(Number.isInteger(y.amount)).toBe(true)
    })
  })

  it('elapsedLabel affiche "Xmin" pour moins d\'1 heure', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 45 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current!.elapsedLabel).toMatch(/min/)
    expect(result.current!.elapsedLabel).not.toMatch(/h/)
  })

  it('elapsedLabel affiche "Xh Ymin" pour plus d\'1 heure', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 90 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current!.elapsedLabel).toMatch(/h/)
  })

  it('cappedAt8h est false pour une absence de 2 heures', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 2 * 60 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current!.cappedAt8h).toBe(false)
  })

  it('cappedAt8h est true pour une absence de 10 heures', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 10 * 60 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current!.cappedAt8h).toBe(true)
  })

  it('crédite les ressources dans l\'inventaire au montage', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 2 * 60 * 1000 })

    renderHook(() => useOfflineProgress())
    const herbeAmount = useInventoryStore.getState().getAmount('herbe')
    // 2 min × 10/min = 20
    expect(herbeAmount).toBeCloseTo(20, 0)
  })

  it('dismiss() met result à null', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 2 * 60 * 1000 })

    const { result } = renderHook(() => useOfflineProgress())
    expect(result.current).not.toBeNull()
    act(() => { result.current!.dismiss() })
    expect(result.current).toBeNull()
  })

  it('ne calcule l\'offline progress qu\'une seule fois (useEffect [] dépendances vides)', () => {
    useHarvestStore.getState().setCamp('foret')
    useHarvestStore.setState({ lastSavedAt: Date.now() - 2 * 60 * 1000 })

    const calculateSpy = vi.spyOn(useHarvestStore.getState(), 'calculateOfflineProgress')
    renderHook(() => useOfflineProgress())
    expect(calculateSpy).toHaveBeenCalledTimes(1)
  })
})
