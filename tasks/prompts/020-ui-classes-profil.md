# Prompt 020 — UI Classes & Profil

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 019 ont été exécutés.

Structure existante pertinente :
- `src/stores/usePlayerStore.ts` — `classLevels`, `classXp`, `totalXp`,
  `getClassLevel()`, `getClassProgress()`, `getActiveBonuses()`,
  `isFeatureUnlocked()`, `debugSetClassLevel()`
- `src/stores/useBestiaryStore.ts` — `capturedCreatureIds`, `activeFamiliarId`,
  `setActiveFamiliar()`, `getActiveFamiliar()`
- `src/stores/useAuthStore.ts` — `user`
- `src/data/classes.json` — définitions complètes des 6 classes
- `src/types/player.ts` — `ClassId`, `ClassDefinition`, `ClassBonus`
- `src/components/shared/ProgressBar.tsx` — réutilisable
- `src/components/shared/Tooltip.tsx` — réutilisable

## Décisions de design
- **Couleur profil** : or `#ffd500` — header XP, accents
- **Couleur classe active** : couleur propre à chaque classe (voir tableau)
- **Layout** : page scrollable verticalement — c'est la seule page avec beaucoup de contenu
- **Cards classes** : toutes visibles, pas de tabs — le joueur voit sa progression d'un coup

---

## Couleurs par classe

| Classe | Couleur | Hex |
|---|---|---|
| Récolteur | Cyan | `#00d2ff` |
| Artisan | Violet | `#bf5af2` |
| Cuisinier | Orange | `#ff9500` |
| Explorateur | Vert | `#30d158` |
| Chasseur | Rouge | `#ff453a` |
| Érudit | Or | `#ffd500` |

---

## Architecture des fichiers

```
src/
├── pages/
│   └── ProfilePage.tsx              ← page principale
├── components/
│   └── profile/
│       ├── PlayerHeader.tsx          ← section profil joueur
│       ├── ClassCard.tsx             ← card d'une classe
│       ├── FamiliarCollection.tsx    ← grille des familiers
│       └── DebugPanel.tsx            ← panel debug (dev uniquement)
```

---

## Fichiers à créer

---

### `src/components/profile/PlayerHeader.tsx`

```tsx
import { useAuthStore } from '../../stores/useAuthStore'
import { usePlayerStore } from '../../stores/usePlayerStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useGameDataStore } from '../../stores/useGameDataStore'
import { FURNACE_LEVELS } from '../../data'

export function PlayerHeader() {
  const user = useAuthStore((s) => s.user)
  const totalXp = usePlayerStore((s) => s.totalXp)
  const createdAt = usePlayerStore((s) => s.createdAt)
  const getActiveFamiliar = useBestiaryStore((s) => s.getActiveFamiliar)
  const creatures = useGameDataStore((s) => s.creatures)

  const familiar = getActiveFamiliar()

  // Niveau global calculé depuis les paliers de fourneaux (proxy du niveau global)
  const globalLevel = FURNACE_LEVELS.filter((l) => totalXp >= l.requiredXp).length

  // Date de création formatée
  const createdDate = new Date(createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Jours de jeu
  const daysPlayed = Math.floor((Date.now() - createdAt) / 86400000)

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid rgba(255,213,0,0.15)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
    }}>
      {/* Identité */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
            🍖 {user?.email?.split('@')[0] ?? 'Aventurier'}
          </div>
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
            Aventurier depuis {daysPlayed > 0 ? `${daysPlayed} jour${daysPlayed > 1 ? 's' : ''}` : 'aujourd\'hui'}
          </div>
        </div>

        {/* Badge XP total */}
        <div style={{
          background: 'rgba(255,213,0,0.1)',
          border: '1px solid rgba(255,213,0,0.3)',
          borderRadius: '12px', padding: '8px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffd500' }}>
            {totalXp.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: '#636e8a' }}>XP total</div>
        </div>
      </div>

      {/* Familier actif */}
      {familiar ? (
        <div style={{
          background: '#0d1117', borderRadius: '8px', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '24px' }}>{familiar.emoji}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              {familiar.name} <span style={{ fontSize: '10px', color: '#30d158', fontWeight: 400 }}>● Actif</span>
            </div>
            {familiar.familiarBonus && (
              <div style={{ fontSize: '11px', color: '#636e8a' }}>
                +{familiar.familiarBonus.amountPerMin}/min {familiar.familiarBonus.resourceId}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#0d1117', borderRadius: '8px', padding: '10px 12px',
          fontSize: '12px', color: '#636e8a',
        }}>
          🐾 Aucun familier actif — capture des créatures pour en débloquer un
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/profile/ClassCard.tsx`

Card d'une classe avec niveau, progression XP et liste des bonus.

```tsx
import { useState } from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'
import { ProgressBar } from '../shared/ProgressBar'
import classesData from '../../data/classes.json'
import type { ClassId } from '../../types/player'
import type { ClassDefinition } from '../../types/player'

// Couleurs par classe
const CLASS_COLORS: Record<ClassId, string> = {
  recolteur:   '#00d2ff',
  artisan:     '#bf5af2',
  cuisinier:   '#ff9500',
  explorateur: '#30d158',
  chasseur:    '#ff453a',
  erudit:      '#ffd500',
}

interface ClassCardProps {
  classId: ClassId
}

export function ClassCard({ classId }: ClassCardProps) {
  const [expanded, setExpanded] = useState(false)

  const level = usePlayerStore((s) => s.getClassLevel(classId))
  const progress = usePlayerStore((s) => s.getClassProgress(classId))
  const xp = usePlayerStore((s) => s.getClassXp(classId))

  const classDef = (classesData.classes as ClassDefinition[]).find((c) => c.id === classId)!
  const color = CLASS_COLORS[classId]

  const maxLevel = classDef.levels.length
  const isMaxed = level >= maxLevel
  const nextLevel = classDef.levels.find((l) => l.level === level + 1)
  const xpToNext = nextLevel ? nextLevel.xpRequired - xp : 0

  return (
    <div style={{
      background: '#161b22',
      border: `1px solid ${level > 0 ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '12px',
      padding: '14px',
      transition: 'border-color 0.2s ease',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{classDef.emoji}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: level > 0 ? '#e2e8f0' : '#636e8a' }}>
              {classDef.name}
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>
              {classDef.description}
            </div>
          </div>
        </div>

        {/* Niveau */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '18px', fontWeight: 700,
            color: level > 0 ? color : '#4a5568',
          }}>
            {level}<span style={{ fontSize: '12px', color: '#636e8a', fontWeight: 400 }}>/{maxLevel}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#636e8a' }}>
            {expanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Barre de progression XP */}
      <div style={{ marginTop: '10px' }}>
        <ProgressBar
          value={isMaxed ? 1 : progress}
          color={level > 0 ? color : '#4a5568'}
          height={5}
          showGlow={level > 0}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '10px', color: '#636e8a' }}>
            {xp.toLocaleString()} XP
          </span>
          <span style={{ fontSize: '10px', color: '#636e8a' }}>
            {isMaxed ? '✅ Niveau max' : `encore ${xpToNext.toLocaleString()} XP`}
          </span>
        </div>
      </div>

      {/* Liste des niveaux (expandable) */}
      {expanded && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {classDef.levels.map((lvl) => {
            const isUnlocked = level >= lvl.level
            const isCurrent = level + 1 === lvl.level

            return (
              <div
                key={lvl.level}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px', borderRadius: '8px',
                  background: isUnlocked ? `${color}12` : '#0d1117',
                  border: `1px solid ${isCurrent ? `${color}40` : 'transparent'}`,
                  opacity: isUnlocked ? 1 : 0.5,
                }}
              >
                {/* Indicateur niveau */}
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: isUnlocked ? color : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700,
                  color: isUnlocked ? '#0d1117' : '#636e8a',
                  flexShrink: 0,
                }}>
                  {lvl.level}
                </div>

                {/* Description */}
                <span style={{
                  fontSize: '12px',
                  color: isUnlocked ? '#e2e8f0' : '#636e8a',
                  flex: 1,
                }}>
                  {lvl.description}
                </span>

                {/* Badge prochain */}
                {isCurrent && (
                  <span style={{
                    fontSize: '9px', color: color,
                    background: `${color}15`, borderRadius: '20px',
                    padding: '1px 6px', flexShrink: 0,
                  }}>
                    Prochain
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/profile/FamiliarCollection.tsx`

Grille des familiers — capturés en couleur, non capturés en silhouette grisée.

```tsx
import { useGameDataStore } from '../../stores/useGameDataStore'
import { useBestiaryStore } from '../../stores/useBestiaryStore'
import { useToast } from '../shared/ToastManager'
import { Tooltip } from '../shared/Tooltip'

export function FamiliarCollection() {
  const creatures = useGameDataStore((s) => s.creatures)
  const capturedCreatureIds = useBestiaryStore((s) => s.capturedCreatureIds)
  const activeFamiliarId = useBestiaryStore((s) => s.activeFamiliarId)
  const setActiveFamiliar = useBestiaryStore((s) => s.setActiveFamiliar)
  const addToast = useToast()

  // Filtrer uniquement les créatures qui peuvent être familiers
  const familiars = creatures.filter((c) => c.isFamiliar)
  const capturedCount = familiars.filter((c) => capturedCreatureIds.includes(c.id)).length

  function handleSelectFamiliar(creatureId: string) {
    if (!capturedCreatureIds.includes(creatureId)) return
    if (activeFamiliarId === creatureId) {
      setActiveFamiliar(null)
      addToast('Familier désactivé.', 'info')
    } else {
      setActiveFamiliar(creatureId)
      const creature = creatures.find((c) => c.id === creatureId)
      addToast(`${creature?.emoji} ${creature?.name} est maintenant ton familier actif !`, 'success')
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Familiers
        </div>
        <div style={{ fontSize: '12px', color: '#636e8a' }}>
          {capturedCount}/{familiars.length} capturés
        </div>
      </div>

      {familiars.length === 0 ? (
        <div style={{
          background: '#161b22', borderRadius: '10px', padding: '20px',
          textAlign: 'center', color: '#636e8a', fontSize: '13px',
        }}>
          Aucun familier disponible pour l'instant. Explore la carte !
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}>
          {familiars.map((creature) => {
            const isCaptured = capturedCreatureIds.includes(creature.id)
            const isActive = activeFamiliarId === creature.id

            return (
              <Tooltip key={creature.id} content={
                isCaptured
                  ? `${creature.name}\n${creature.familiarBonus
                    ? `+${creature.familiarBonus.amountPerMin}/min ${creature.familiarBonus.resourceId}`
                    : 'Aucun bonus'}`
                  : `??? — Non capturé (${(creature.captureChance * 100).toFixed(0)}% chance)`
              }>
                <button
                  onClick={() => handleSelectFamiliar(creature.id)}
                  disabled={!isCaptured}
                  style={{
                    background: isActive
                      ? 'rgba(48,209,88,0.12)'
                      : isCaptured ? '#161b22' : '#0d1117',
                    border: `1px solid ${isActive
                      ? 'rgba(48,209,88,0.4)'
                      : isCaptured ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: '10px',
                    padding: '10px 6px',
                    cursor: isCaptured ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    position: 'relative',
                  }}
                >
                  {/* Badge actif */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#30d158',
                    }} />
                  )}

                  {/* Emoji */}
                  <span style={{
                    fontSize: '26px',
                    filter: isCaptured ? 'none' : 'grayscale(1) brightness(0.3)',
                  }}>
                    {creature.emoji}
                  </span>

                  {/* Nom */}
                  <span style={{
                    fontSize: '9px',
                    color: isCaptured ? '#8b949e' : '#4a5568',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {isCaptured ? creature.name : '???'}
                  </span>

                  {/* Rareté */}
                  {isCaptured && (
                    <span style={{
                      fontSize: '8px',
                      color: {
                        common: '#636e8a', uncommon: '#30d158',
                        rare: '#00d2ff', epic: '#bf5af2', legendary: '#ff9500',
                      }[creature.rarity],
                    }}>
                      {creature.rarityLabel}
                    </span>
                  )}
                </button>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/profile/DebugPanel.tsx`

Panel debug visible uniquement en mode développement.

```tsx
import { useState } from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'
import type { ClassId } from '../../types/player'

const CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit'
]

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const debugSetClassLevel = usePlayerStore((s) => s.debugSetClassLevel)
  const classLevels = usePlayerStore((s) => s.classLevels)

  if (!import.meta.env.DEV) return null

  return (
    <div style={{
      background: 'rgba(255,213,0,0.06)',
      border: '1px solid rgba(255,213,0,0.2)',
      borderRadius: '10px',
      padding: '12px',
      marginTop: '20px',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none', border: 'none',
          color: '#ffd500', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', width: '100%', textAlign: 'left',
        }}
      >
        🛠️ Debug — Niveaux de classe {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CLASS_IDS.map((classId) => (
            <div key={classId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#636e8a', width: '100px' }}>{classId}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffd500', width: '24px' }}>
                {classLevels[classId] ?? 0}
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={classLevels[classId] ?? 0}
                onChange={(e) => debugSetClassLevel(classId, parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#ffd500' }}
              />
            </div>
          ))}
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '4px' }}>
            ⚠️ Debug uniquement — invisible en production
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### `src/pages/ProfilePage.tsx`

Page principale — assemble tous les composants.

```tsx
import { PlayerHeader } from '../components/profile/PlayerHeader'
import { ClassCard } from '../components/profile/ClassCard'
import { FamiliarCollection } from '../components/profile/FamiliarCollection'
import { DebugPanel } from '../components/profile/DebugPanel'
import type { ClassId } from '../types/player'

const CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit'
]

export function ProfilePage() {
  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>

      {/* Header profil */}
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          ⭐ Profil
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 12px' }}>
          Ta progression et tes classes d'aventurier.
        </p>
      </div>

      {/* Profil joueur */}
      <PlayerHeader />

      {/* Section classes */}
      <div style={{
        fontSize: '11px', fontWeight: 500, color: '#636e8a',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
      }}>
        Classes
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {CLASS_IDS.map((classId) => (
          <ClassCard key={classId} classId={classId} />
        ))}
      </div>

      {/* Section familiers */}
      <FamiliarCollection />

      {/* Debug panel (dev uniquement) */}
      <DebugPanel />

    </div>
  )
}
```

---

### Mise à jour `src/App.tsx`

Remplacer le `ComingSoon` de l'onglet inventory par `ProfilePage` et mettre à jour la BottomNav.

```tsx
// Ajouter l'import :
import { ProfilePage } from './pages/ProfilePage'

// Dans renderPage() :
// L'onglet 'inventory' devient 'profile' — ou on garde inventory séparé
// Option retenue : ajouter un 5ème onglet dédié au profil
// Dans BottomNav, renommer l'onglet 'inventory' en deux options :
// - Garder 'inventory' (Sac) sur l'onglet existant
// - Utiliser l'onglet 'map' pour la carte
// - Profil accessible via un bouton dans le header

// Solution simple pour le MVP :
// Remplacer l'onglet 'map' par 'profile' et garder la carte accessible depuis la Récolte
// OU ajouter le profil dans un menu hamburger

// Décision : l'onglet Inventaire (🎒) devient "Profil & Inventaire"
// avec des tabs internes — à implémenter dans ce prompt

// Pour l'instant : câbler ProfilePage sur l'onglet existant 'inventory'
// et laisser une note pour refactorer la navigation en prompt de polish

case 'inventory': return <ProfilePage />
// Note : l'InventoryPage sera accessible depuis ProfilePage via un onglet interne
```

---

### Note sur la navigation — à refactorer

L'onglet "Sac" (inventory) devient "Profil" pour ce prompt.
L'accès à l'inventaire pur se fait via un onglet interne dans ProfilePage.
Un prompt de polish ajoutera des tabs internes Profil / Inventaire sur cet onglet.

---

## Critères de succès

### PlayerHeader
- [ ] Nom du joueur affiché (préfixe de l'email)
- [ ] XP total en or avec `.toLocaleString()`
- [ ] Jours de jeu calculés correctement
- [ ] Familier actif affiché avec son bonus de production
- [ ] Message "Aucun familier" si pas de familier actif

### ClassCard
- [ ] 6 cards affichées, une par classe
- [ ] Niveau affiché (ex: 3/10)
- [ ] Barre de progression XP dans la bonne couleur de classe
- [ ] "encore X XP" calculé correctement
- [ ] Tap sur la card → expand la liste des niveaux
- [ ] Niveaux débloqués en couleur + cercle coloré
- [ ] Niveaux verrouillés grisés à 50%
- [ ] Badge "Prochain" sur le niveau suivant à débloquer
- [ ] "✅ Niveau max" si niveau 10 atteint

### FamiliarCollection
- [ ] Grille 4 colonnes
- [ ] Familiers capturés en couleur normale
- [ ] Non capturés en emoji grayscale + "???" comme nom
- [ ] Tap sur un familier capturé → devient actif + toast
- [ ] Tap sur le familier actif → désactive + toast
- [ ] Indicateur vert (point) sur le familier actif
- [ ] Compteur "X/Y capturés" affiché

### DebugPanel
- [ ] Visible uniquement en mode dev (`import.meta.env.DEV`)
- [ ] Sliders 0-10 pour chaque classe
- [ ] Changer un slider → niveau de classe mis à jour en temps réel
- [ ] La ClassCard correspondante se met à jour immédiatement
- [ ] Invisible en `npm run build` (production)

## Notes pour la suite
- La navigation sera refactorée dans un prompt de polish :
  l'onglet "Sac" aura des tabs internes (Inventaire / Profil)
- `PlayerHeader` affiche l'email comme nom — un futur prompt permettra
  au joueur de choisir un pseudo stocké dans Supabase
- Le `prestigeLevel` dans `usePlayerStore` est prévu mais pas encore affiché —
  sera ajouté quand le système de prestige sera designé
- Les bonus `unlock_feature` sont listés dans les cards mais ne montrent pas
  encore si la feature est vraiment active — amélioration Phase 4
