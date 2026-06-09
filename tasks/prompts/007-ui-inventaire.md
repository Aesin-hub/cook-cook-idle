# Prompt 007 — UI Inventaire (page Sac)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 006 ont été exécutés.

Structure existante pertinente :
- `src/stores/useInventoryStore.ts` — `resources: Record<string, number>`, `getAmount()`
- `src/data/resources.json` — 14 ressources avec `id`, `name`, `emoji`, `region`,
  `rarity`, `rarityLabel`, `baseYieldPerMin`, `tooltip`
- `src/data/craft-recipes.json` — recettes avec `output.resourceId`
  (bouillon_base, farine, lingot_fer sont des ressources craftées sans entrée dans resources.json)
- `src/types/game.ts` — `Resource`, `RegionId`, `Rarity`
- `src/components/shared/Tooltip.tsx` — tooltip hover/tap
- `src/components/shared/ProgressBar.tsx` — barre réutilisable
- `src/App.tsx` — `case 'inventory': return <ComingSoon ...>` à remplacer

## Décisions de design
- **Couleur inventaire** : or `#ffd500` — header, badges quantité, accents
- **Toutes les ressources affichées** — y compris les ressources craftées
  (bouillon_base, farine, lingot_fer) qui n'ont pas d'entrée dans resources.json.
  Pour ces ressources "orphelines", afficher un fallback générique (📦 + id formaté).
- **Tri par défaut** : quantité décroissante (ce qu'on a le plus en premier)
- **Filtres** : par région (Forêt / Caverne / Marais / Plaine / Craftées) + par rareté
- **Recherche** : champ de recherche par nom, filtrage instantané
- **Quantités** : arrondies à l'entier pour l'affichage, `.toLocaleString()` pour les grands nombres
- **Ressources à 0** : affichées en grisé en bas de liste — le joueur sait qu'elles existent
- **Production/min visible** : si un camp est actif sur la région de la ressource,
  afficher "+X/min" en vert à côté de la quantité
- **Zéro scroll inutile** : la page est scrollable verticalement (c'est une liste),
  mais la barre de filtre/recherche est sticky en haut

---

## Architecture des fichiers

```
src/
├── pages/
│   └── InventoryPage.tsx          ← page principale inventaire
├── components/
│   └── inventory/
│       ├── InventoryFilters.tsx   ← barre sticky filtre + recherche
│       ├── ResourceRow.tsx        ← ligne d'une ressource dans la liste
│       └── InventorySummary.tsx   ← résumé (total ressources, valeur camp)
```

---

## Fichiers à créer

---

### `src/components/inventory/InventoryFilters.tsx`

Barre sticky en haut de la page. Contient :
- Champ de recherche texte
- Filtres par région (pills horizontaux scrollables)
- Tri (quantité ↓ / nom A→Z / rareté)

```tsx
import { RegionId } from '../../types/game'
import { REGIONS } from '../../data'

export type SortMode = 'quantity' | 'name' | 'rarity'
export type FilterRegion = RegionId | 'crafted' | 'all'

interface InventoryFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  filterRegion: FilterRegion
  onFilterRegion: (r: FilterRegion) => void
  sortMode: SortMode
  onSortMode: (s: SortMode) => void
}

const REGION_FILTERS: { id: FilterRegion; label: string; emoji: string }[] = [
  { id: 'all',     label: 'Tout',    emoji: '📦' },
  { id: 'foret',   label: 'Forêt',   emoji: '🌲' },
  { id: 'caverne', label: 'Caverne', emoji: '⛰️' },
  { id: 'marais',  label: 'Marais',  emoji: '🌿' },
  { id: 'plaine',  label: 'Plaine',  emoji: '🌾' },
  { id: 'crafted', label: 'Craftés', emoji: '⚗️' },
]

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'quantity', label: 'Quantité ↓' },
  { id: 'name',     label: 'Nom A→Z' },
  { id: 'rarity',   label: 'Rareté' },
]

export function InventoryFilters({
  search, onSearchChange,
  filterRegion, onFilterRegion,
  sortMode, onSortMode,
}: InventoryFiltersProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#0d1117',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '12px',
      }}
    >
      {/* Champ de recherche */}
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <span
          style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="text"
          placeholder="Rechercher une ressource..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '9px 12px 9px 36px',
            fontSize: '13px',
            color: '#e2e8f0',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute', right: '10px', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: '#636e8a', cursor: 'pointer', fontSize: '14px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtres région — scrollables horizontalement */}
      <div
        style={{
          display: 'flex', gap: '6px',
          overflowX: 'auto', paddingBottom: '2px',
          scrollbarWidth: 'none',
        }}
      >
        {REGION_FILTERS.map((f) => {
          const isActive = filterRegion === f.id
          return (
            <button
              key={f.id}
              onClick={() => onFilterRegion(f.id)}
              style={{
                flexShrink: 0,
                background: isActive ? 'rgba(255,213,0,0.12)' : '#161b22',
                border: `1px solid ${isActive ? 'rgba(255,213,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#ffd500' : '#636e8a',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f.emoji} {f.label}
            </button>
          )
        })}
      </div>

      {/* Tri — à droite */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
        {SORT_OPTIONS.map((s) => {
          const isActive = sortMode === s.id
          return (
            <button
              key={s.id}
              onClick={() => onSortMode(s.id)}
              style={{
                background: isActive ? 'rgba(255,213,0,0.08)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(255,213,0,0.2)' : 'transparent'}`,
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                color: isActive ? '#ffd500' : '#636e8a',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

---

### `src/components/inventory/ResourceRow.tsx`

Ligne d'une ressource dans la liste.
Affiche : emoji + nom + rarityLabel + quantité + production/min si camp actif.
Tooltip au hover/tap avec la description de la ressource.

```tsx
import { useHarvestStore } from '../../stores/useHarvestStore'
import { RESOURCES } from '../../data'
import { Tooltip } from '../shared/Tooltip'
import type { Resource } from '../../types/game'

interface ResourceRowProps {
  resourceId: string
  amount: number
  // resource peut être null si c'est une ressource craftée sans entrée dans resources.json
  resource: Resource | null
}

// Ordre de rareté pour le tri
export const RARITY_ORDER: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3,
}

// Couleur selon la rareté
const RARITY_COLOR: Record<string, string> = {
  common:   '#636e8a',
  uncommon: '#30d158',
  rare:     '#00d2ff',
  epic:     '#bf5af2',
}

// Formatter un ID snake_case en label lisible (fallback pour ressources craftées)
function formatId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ResourceRow({ resourceId, amount, resource }: ResourceRowProps) {
  const camp = useHarvestStore((state) => state.camp)

  // Production/min si le camp est actif sur la région de cette ressource
  const isProducing = camp && resource && camp.regionId === resource.region
  const yieldPerMin = isProducing ? resource.baseYieldPerMin : null

  const isEmpty = amount < 1

  const displayName  = resource?.name    ?? formatId(resourceId)
  const displayEmoji = resource?.emoji   ?? '📦'
  const displayRarity = resource?.rarityLabel ?? 'Crafté'
  const rarityKey    = resource?.rarity  ?? 'crafted'
  const tooltip      = resource?.tooltip ?? `Ressource craftée : ${displayName}`
  const rarityColor  = RARITY_COLOR[rarityKey] ?? '#bf5af2'

  return (
    <Tooltip content={tooltip}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: '#161b22',
          borderRadius: '10px',
          opacity: isEmpty ? 0.45 : 1,
          transition: 'opacity 0.2s',
          cursor: 'default',
        }}
      >
        {/* Gauche : emoji + nom + rareté */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px', minWidth: '28px', textAlign: 'center' }}>
            {displayEmoji}
          </span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: isEmpty ? '#4a5568' : '#e2e8f0' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '11px', color: rarityColor, marginTop: '1px' }}>
              {displayRarity}
            </div>
          </div>
        </div>

        {/* Droite : quantité + production/min */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: isEmpty ? '#4a5568' : '#ffd500',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.floor(amount).toLocaleString()}
          </div>
          {yieldPerMin && (
            <div style={{ fontSize: '11px', color: '#30d158', marginTop: '1px' }}>
              +{yieldPerMin}/min
            </div>
          )}
          {!yieldPerMin && resource && (
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '1px' }}>
              {resource.baseYieldPerMin}/min max
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  )
}
```

---

### `src/components/inventory/InventorySummary.tsx`

Résumé compact en haut de la page :
- Nombre total de types de ressources possédées (> 0)
- Production totale du camp actif en ressources/min
- Petit badge si camp actif

```tsx
import { useMemo } from 'react'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { RESOURCES, REGIONS } from '../../data'

export function InventorySummary() {
  const resources = useInventoryStore((state) => state.resources)
  const camp = useHarvestStore((state) => state.camp)

  const totalTypes = useMemo(
    () => Object.values(resources).filter((v) => v >= 1).length,
    [resources]
  )

  const totalItems = useMemo(
    () => Math.floor(Object.values(resources).reduce((sum, v) => sum + v, 0)),
    [resources]
  )

  const campRegion = useMemo(
    () => camp ? REGIONS.find((r) => r.id === camp.regionId) : null,
    [camp]
  )

  const campYieldTotal = useMemo(() => {
    if (!camp) return 0
    return RESOURCES
      .filter((r) => r.region === camp.regionId)
      .reduce((sum, r) => sum + r.baseYieldPerMin, 0)
  }, [camp])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      {/* Total items */}
      <div
        style={{
          background: '#161b22',
          borderRadius: '10px',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ fontSize: '11px', color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Total ressources
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffd500' }}>
          {totalItems.toLocaleString()}
        </div>
        <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
          {totalTypes} type{totalTypes > 1 ? 's' : ''} différent{totalTypes > 1 ? 's' : ''}
        </div>
      </div>

      {/* Camp actif / production */}
      <div
        style={{
          background: '#161b22',
          borderRadius: '10px',
          padding: '12px',
          border: `1px solid ${camp ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
        }}
      >
        <div style={{ fontSize: '11px', color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Production
        </div>
        {camp && campRegion ? (
          <>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#00d2ff' }}>
              +{campYieldTotal}/min
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
              {campRegion.emoji} {campRegion.name}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#4a5568' }}>
              0/min
            </div>
            <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px' }}>
              Aucun camp actif
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

---

### `src/pages/InventoryPage.tsx`

Page principale. Gère le state local des filtres, trie et filtre les ressources,
assemble tous les composants.

Logique d'affichage :
1. Construire la liste complète : ressources JSON + ressources craftées présentes dans l'inventaire
2. Appliquer filtre région + recherche texte
3. Trier selon le mode choisi
4. Séparer "possédées" (amount >= 1) et "vides" (amount < 1)
5. Afficher possédées en premier, vides en grisé en bas

```tsx
import { useState, useMemo } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'
import { RESOURCES, CRAFT_RECIPES } from '../data'
import { InventoryFilters, FilterRegion, SortMode } from '../components/inventory/InventoryFilters'
import { ResourceRow, RARITY_ORDER } from '../components/inventory/ResourceRow'
import { InventorySummary } from '../components/inventory/InventorySummary'
import type { Resource } from '../types/game'

// Construit la liste complète de toutes les ressources à afficher :
// - Les 14 ressources de base (resources.json)
// - Les ressources craftées qui sont dans l'inventaire mais pas dans resources.json
function buildFullResourceList(inventoryKeys: string[]): { resourceId: string; resource: Resource | null }[] {
  const knownIds = new Set(RESOURCES.map((r) => r.id))

  // Ressources de base
  const base = RESOURCES.map((r) => ({ resourceId: r.id, resource: r }))

  // Ressources craftées "orphelines" (dans inventaire mais pas dans resources.json)
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
      // Filtre région
      if (filterRegion !== 'all') {
        if (filterRegion === 'crafted') {
          if (resource !== null) return false  // garder seulement les orphelines
        } else {
          if (!resource || resource.region !== filterRegion) return false
        }
      }

      // Filtre recherche
      if (search.trim()) {
        const q = search.toLowerCase()
        const name = resource?.name ?? resourceId
        if (!name.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [fullList, filterRegion, search])

  // Tri
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const amtA = resources[a.resourceId] ?? 0
      const amtB = resources[b.resourceId] ?? 0

      if (sortMode === 'quantity') {
        if (amtB !== amtA) return amtB - amtA
        // À égalité : alphabétique
        return (a.resource?.name ?? a.resourceId).localeCompare(b.resource?.name ?? b.resourceId)
      }

      if (sortMode === 'name') {
        return (a.resource?.name ?? a.resourceId).localeCompare(b.resource?.name ?? b.resourceId)
      }

      if (sortMode === 'rarity') {
        const rA = RARITY_ORDER[a.resource?.rarity ?? 'crafted'] ?? 4
        const rB = RARITY_ORDER[b.resource?.rarity ?? 'crafted'] ?? 4
        if (rB !== rA) return rB - rA  // épique en premier
        return amtB - amtA
      }

      return 0
    })
  }, [filtered, resources, sortMode])

  // Séparer possédées vs vides
  const owned   = sorted.filter(({ resourceId }) => (resources[resourceId] ?? 0) >= 1)
  const empty   = sorted.filter(({ resourceId }) => (resources[resourceId] ?? 0) < 1)

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          🎒 Inventaire
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Toutes tes ressources récoltées et craftées.
        </p>
      </div>

      {/* Résumé */}
      <InventorySummary />

      {/* Filtres sticky */}
      <InventoryFilters
        search={search}
        onSearchChange={setSearch}
        filterRegion={filterRegion}
        onFilterRegion={setFilterRegion}
        sortMode={sortMode}
        onSortMode={setSortMode}
      />

      {/* Résultat vide */}
      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#636e8a' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontSize: '14px' }}>Aucune ressource trouvée</div>
        </div>
      )}

      {/* Ressources possédées */}
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

      {/* Ressources vides */}
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
```

---

### Mise à jour `src/App.tsx`

Remplacer le `ComingSoon` de l'onglet inventory par `InventoryPage` :

```tsx
// Ajouter l'import :
import { InventoryPage } from './pages/InventoryPage'

// Dans renderPage(), remplacer :
// case 'inventory': return <ComingSoon label="🎒 Inventaire" color="#ffd500" />
// Par :
case 'inventory': return <InventoryPage />
```

---

## Critères de succès

### Visuel
- [ ] L'onglet "Sac" est en or `#ffd500` quand actif
- [ ] Les quantités sont en or `#ffd500`, grandes et lisibles
- [ ] Les ressources à 0 sont grisées à 45% d'opacité en bas de liste
- [ ] La barre filtre/recherche est sticky et reste visible en scrollant

### InventorySummary
- [ ] "Total ressources" affiche la somme de toutes les quantités en inventaire
- [ ] "Types différents" compte les ressources avec amount >= 1
- [ ] "Production" affiche le yield/min total du camp actif
- [ ] Si aucun camp : "0/min · Aucun camp actif" en grisé

### Filtres
- [ ] Le filtre "Tout" affiche toutes les ressources
- [ ] Le filtre "Forêt" n'affiche que les 4 ressources forêt
- [ ] Le filtre "Craftés" affiche bouillon_base, farine, lingot_fer
- [ ] La recherche "her" filtre et affiche uniquement "Herbe"
- [ ] Le bouton ✕ efface la recherche
- [ ] Le tri "Quantité ↓" met les ressources les plus nombreuses en premier
- [ ] Le tri "Nom A→Z" trie alphabétiquement
- [ ] Le tri "Rareté" met les épiques/rares en premier

### ResourceRow
- [ ] Chaque ligne affiche emoji + nom + rarityLabel coloré selon la rareté
- [ ] Les ressources dont la région correspond au camp actif affichent "+X/min" en vert
- [ ] Le tooltip s'affiche au hover / tap long avec la description JSON
- [ ] Les ressources craftées orphelines (bouillon_base) affichent "📦 Bouillon Base" + "Crafté"
- [ ] Jamais d'ID technique visible (toujours `name` ou `formatId(id)`)

### Intégration
- [ ] Récolter de l'Herbe → l'Herbe apparaît immédiatement dans l'inventaire
- [ ] Crafter un Bouillon → "Bouillon de Base" apparaît dans la section "Craftés"
- [ ] Naviguer Récolte → Sac → Craft → Sac : l'état des filtres est réinitialisé à chaque visite (state local)

## Notes pour la suite
- Le state des filtres (`search`, `filterRegion`, `sortMode`) est **local** à la page
  (useState) — il se réinitialise à chaque visite de l'onglet. C'est intentionnel :
  le joueur repart de "Tout / Quantité ↓" à chaque fois. Si on veut le persister plus tard,
  un zustand store léger suffira.
- Les ressources craftées "orphelines" sont détectées dynamiquement en croisant
  `Object.keys(inventory)` avec `CRAFT_RECIPES.map(r => r.output.resourceId)`.
  Quand on ajoutera plus de recettes de craft, elles apparaîtront automatiquement.
- Le filtre "Craftés" sera enrichi en Phase 2 quand le Cook produira ses propres ressources.
- La page Inventaire n'a pas de `CraftQueueBar` — elle vient du prompt 006 et est en
  `position: fixed`, donc elle s'affiche automatiquement sur tous les onglets.
