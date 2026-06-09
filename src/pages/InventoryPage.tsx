import { useState, useMemo } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'
import { RESOURCES, CRAFT_RECIPES } from '../data'
import { InventoryFilters } from '../components/inventory/InventoryFilters'
import { ResourceRow, RARITY_ORDER } from '../components/inventory/ResourceRow'
import { InventorySummary } from '../components/inventory/InventorySummary'
import type { FilterRegion, SortMode } from '../components/inventory/InventoryFilters'
import type { Resource } from '../types/game'

function buildFullResourceList(inventoryKeys: string[]): { resourceId: string; resource: Resource | null }[] {
  const knownIds = new Set(RESOURCES.map((r) => r.id))
  const base = RESOURCES.map((r) => ({ resourceId: r.id, resource: r as Resource }))
  const craftedOutputIds = CRAFT_RECIPES.map((r) => r.output.resourceId)
  const orphans = inventoryKeys
    .filter((id) => !knownIds.has(id) && craftedOutputIds.includes(id))
    .map((id) => ({ resourceId: id, resource: null }))
  return [...base, ...orphans]
}

export function InventoryPage() {
  const resources = useInventoryStore((state) => state.resources)
  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState<FilterRegion>('all')
  const [sortMode, setSortMode] = useState<SortMode>('quantity')

  const inventoryKeys = useMemo(() => Object.keys(resources), [resources])
  const fullList = useMemo(() => buildFullResourceList(inventoryKeys), [inventoryKeys])

  const filtered = useMemo(() => {
    return fullList.filter(({ resourceId, resource }) => {
      if (filterRegion !== 'all') {
        if (filterRegion === 'crafted') {
          if (resource !== null) return false
        } else {
          if (!resource || resource.region !== filterRegion) return false
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const name = resource?.name ?? resourceId
        if (!name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [fullList, filterRegion, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const amtA = resources[a.resourceId] ?? 0
      const amtB = resources[b.resourceId] ?? 0

      if (sortMode === 'quantity') {
        if (amtB !== amtA) return amtB - amtA
        return (a.resource?.name ?? a.resourceId).localeCompare(b.resource?.name ?? b.resourceId)
      }

      if (sortMode === 'name') {
        return (a.resource?.name ?? a.resourceId).localeCompare(b.resource?.name ?? b.resourceId)
      }

      if (sortMode === 'rarity') {
        const rA = RARITY_ORDER[a.resource?.rarity ?? 'crafted'] ?? 4
        const rB = RARITY_ORDER[b.resource?.rarity ?? 'crafted'] ?? 4
        if (rB !== rA) return rB - rA
        return amtB - amtA
      }

      return 0
    })
  }, [filtered, resources, sortMode])

  const owned = sorted.filter(({ resourceId }) => (resources[resourceId] ?? 0) >= 1)
  const empty = sorted.filter(({ resourceId }) => (resources[resourceId] ?? 0) < 1)

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>

      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          🎒 Inventaire
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Toutes tes ressources récoltées et craftées.
        </p>
      </div>

      <InventorySummary />

      <InventoryFilters
        search={search}
        onSearchChange={setSearch}
        filterRegion={filterRegion}
        onFilterRegion={setFilterRegion}
        sortMode={sortMode}
        onSortMode={setSortMode}
      />

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#636e8a' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontSize: '14px' }}>Aucune ressource trouvée</div>
        </div>
      )}

      {owned.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: '#ffd500',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
          }}>
            Possédées ({owned.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {owned.map(({ resourceId, resource }) => (
              <ResourceRow
                key={resourceId}
                resourceId={resourceId}
                amount={resources[resourceId] ?? 0}
                resource={resource}
              />
            ))}
          </div>
        </div>
      )}

      {empty.length > 0 && (
        <div>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: '#4a5568',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
          }}>
            Non possédées ({empty.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {empty.map(({ resourceId, resource }) => (
              <ResourceRow
                key={resourceId}
                resourceId={resourceId}
                amount={0}
                resource={resource}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
