# Prompt 005 — UI Récolte (Page Forêt)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 004 ont été exécutés.

Structure existante complète :
- `src/data/resources.json` — 14 ressources avec `emoji`, `tooltip`, `rarityLabel`
- `src/data/regions.json` — 4 régions avec `emoji`, `unlockCondition`
- `src/types/game.ts` — `Resource`, `Region`, `RegionId`
- `src/types/harvest.ts` — `Camp`, `Expedition`, `ExpeditionDuration`, `HarvestYield`
- `src/stores/useHarvestStore.ts` — `setCamp`, `removeCamp`, `startExpedition`, `collectExpedition`, `cancelExpedition`
- `src/stores/useInventoryStore.ts` — `resources`, `getAmount`
- `src/hooks/useGameLoop.ts` — tick 1s actif dans App.tsx
- `src/hooks/useOfflineProgress.ts` — retourne `OfflineProgressDisplay`
- `tailwind.config.ts` — tokens `cf-bg`, `cf-surface`, `cf-elevated`, `cf-hover`,
  `cf-harvest` (#00d2ff), `cf-craft` (#bf5af2), `cf-cook` (#ff9500),
  `cf-success` (#30d158), `cf-xp` (#ffd500), `cf-danger` (#ff453a),
  `cf-muted` (#636e8a), `cf-text` (#e2e8f0), `cf-text-dim` (#8b949e)

## Décisions de design (à respecter impérativement)
- **Thème** : fond `#0d1117` (cf-bg), cartes `#161b22` (cf-surface)
- **Couleur récolte** : cyan `#00d2ff` (cf-harvest) — progress bars, bordures actives, badges
- **Navigation fixe en bas** : 5 onglets. Récolte est l'onglet actif (index 0)
- **Zéro scroll sur l'écran principal** — tout tient dans la hauteur viewport mobile (844px / iPhone 14)
- **Tooltips inline** — chaque ressource affiche son `tooltip` au tap/hover, jamais d'ID technique visible
- **Noms lisibles partout** — `emoji + name`, jamais les IDs
- **Générosité perçue** — les chiffres de production sont mis en avant, grands et cyan
- **États visuels clairs** :
  - Région verrouillée → card grisée, cadenas, condition de déblocage visible
  - Camp actif → card avec bordure cyan + badge "Camp actif" animé (pulse)
  - Expédition en cours → progress bar ambre + countdown
  - Expédition terminée → bouton "Récupérer" vert pulsant
  - Bouton désactivé → grisé avec raison au hover

## Objectif
Créer la **première page jouable de Cooking Fantasy** :
- Layout mobile-first avec navigation fixe en bas
- Section "Régions" : 4 cartes, 1 seule débloquée au départ
- Section "Camp actif" : état du camp avec production en temps réel
- Section "Expéditions" : lancement + suivi des 3 slots
- Inventaire compact en haut (ressources de la région active)
- Modal offline progress (reprend `useOfflineProgress`)
- Toasts de notification (complétion, erreur)

---

## Architecture des fichiers à créer

```
src/
├── pages/
│   └── HarvestPage.tsx          ← page principale récolte
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx         ← navigation fixe en bas
│   │   └── AppShell.tsx          ← wrapper layout (fond + nav)
│   ├── harvest/
│   │   ├── RegionCard.tsx        ← carte d'une région (locked/unlocked/active)
│   │   ├── CampPanel.tsx         ← panneau camp actif + production/min
│   │   ├── ExpeditionSlot.tsx    ← un slot d'expédition (vide/en cours/terminé)
│   │   ├── ExpeditionModal.tsx   ← modal choix ressource + durée
│   │   └── RegionInventory.tsx   ← inventaire des ressources de la région active
│   └── shared/
│       ├── ProgressBar.tsx       ← barre de progression réutilisable
│       ├── ToastManager.tsx      ← système de toasts (succès / erreur)
│       ├── OfflineModal.tsx      ← modal "Tes équipes ont bien travaillé !"
│       └── Tooltip.tsx           ← tooltip réutilisable au hover/tap
```

---

## Fichiers à créer

---

### `src/components/layout/AppShell.tsx`

Wrapper racine. Fond noir, contenu scrollable au centre, nav fixe en bas.
Sur mobile, le contenu ne doit jamais passer derrière la nav.

```tsx
import { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

interface AppShellProps {
  children: ReactNode
  activeTab: 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'
  onTabChange: (tab: AppShellProps['activeTab']) => void
}

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  return (
    <div
      style={{ background: '#0d1117', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Contenu principal — padding bottom pour ne pas passer derrière la nav */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {children}
      </main>

      {/* Navigation fixe en bas */}
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}
```

---

### `src/components/layout/BottomNav.tsx`

Navigation 5 onglets fixe en bas. Style : fond `#0d1117`, bordure top subtile,
onglet actif = fond cyan 12% + texte cyan + bordure top cyan 2px.

```tsx
interface Tab {
  id: 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'
  label: string
  emoji: string
}

const TABS: Tab[] = [
  { id: 'harvest',   label: 'Récolte',    emoji: '⛺' },
  { id: 'craft',     label: 'Craft',      emoji: '⚗️' },
  { id: 'cook',      label: 'Cook',       emoji: '🍳' },
  { id: 'inventory', label: 'Sac',        emoji: '🎒' },
  { id: 'map',       label: 'Carte',      emoji: '🗺️' },
]

interface BottomNavProps {
  activeTab: Tab['id']
  onTabChange: (tab: Tab['id']) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#0d1117',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
        // Safe area iOS
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        // Couleur de l'onglet actif selon la boucle de gameplay
        const activeColor =
          tab.id === 'harvest'   ? '#00d2ff' :
          tab.id === 'craft'     ? '#bf5af2' :
          tab.id === 'cook'      ? '#ff9500' :
          tab.id === 'inventory' ? '#ffd500' : '#636e8a'

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              background: isActive ? `${activeColor}1a` : 'transparent',
              border: 'none',
              borderTop: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
              cursor: 'pointer',
              padding: '6px 0 4px',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.emoji}</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                color: isActive ? activeColor : '#636e8a',
                letterSpacing: '0.02em',
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

---

### `src/components/shared/ProgressBar.tsx`

Progress bar réutilisable. Couleur, hauteur et glow configurables.

```tsx
interface ProgressBarProps {
  value: number           // 0 à 1
  color?: string          // défaut : cf-harvest cyan
  height?: number         // défaut : 6px
  animated?: boolean      // stripes animées si true
  showGlow?: boolean      // box-shadow néon si true
}

export function ProgressBar({
  value,
  color = '#00d2ff',
  height = 6,
  animated = false,
  showGlow = true,
}: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 1) * 100

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderRadius: height,
        height,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: height,
          boxShadow: showGlow ? `0 0 8px ${color}80` : 'none',
          transition: animated ? 'none' : 'width 0.3s ease',
        }}
      />
    </div>
  )
}
```

---

### `src/components/shared/Tooltip.tsx`

Tooltip léger affiché au hover (desktop) ou au tap long (mobile).
Affiche le texte `tooltip` des ressources / recettes.

```tsx
import { useState, ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onTouchStart={() => setVisible(true)}
      onTouchEnd={() => setTimeout(() => setVisible(false), 1500)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1c2333',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '12px',
            color: '#8b949e',
            whiteSpace: 'nowrap',
            maxWidth: '240px',
            whiteSpace: 'normal',
            zIndex: 200,
            pointerEvents: 'none',
            lineHeight: 1.4,
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
```

---

### `src/components/shared/ToastManager.tsx`

Système de toasts en haut de l'écran. Succès (vert), erreur (rouge), info (cyan).
S'auto-détruit après 3s. Exporté avec un hook `useToast()`.

```tsx
import { create } from 'zustand'
import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

// Store Zustand léger pour les toasts — pas de persist
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    // Auto-suppression après 3s
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// Hook pratique
export function useToast() {
  return useToastStore((state) => state.addToast)
}

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#30d158',
  error: '#ff453a',
  info: '#00d2ff',
}

// Composant à monter UNE FOIS dans App.tsx
export function ToastManager() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        pointerEvents: 'none',
        width: '90%',
        maxWidth: '360px',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: '#161b22',
            border: `1px solid ${TOAST_COLORS[toast.type]}40`,
            borderLeft: `3px solid ${TOAST_COLORS[toast.type]}`,
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: TOAST_COLORS[toast.type],
            width: '100%',
            boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
            animation: 'slideDown 0.2s ease',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
```

Ajouter dans `src/index.css` (ou équivalent global) :
```css
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(0, 210, 255, 0.4); }
  70%  { box-shadow: 0 0 0 8px rgba(0, 210, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 210, 255, 0); }
}
```

---

### `src/components/shared/OfflineModal.tsx`

Modal "Tes équipes ont bien travaillé !" affiché au chargement si absence > 1min.
Ton positif, liste des gains avec emoji + nom, jamais d'ID technique.

```tsx
import { OfflineProgressDisplay } from '../../hooks/useOfflineProgress'

interface OfflineModalProps {
  progress: OfflineProgressDisplay
}

export function OfflineModal({ progress }: OfflineModalProps) {
  return (
    // Overlay
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Card */}
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(0,210,255,0.2)',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 0 40px rgba(0,210,255,0.1)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⛺</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            Tes équipes ont bien travaillé !
          </h2>
          <p style={{ fontSize: '13px', color: '#636e8a', margin: '4px 0 0' }}>
            Absent pendant {progress.elapsedLabel}
            {progress.cappedAt8h && (
              <span style={{ color: '#ffd500' }}> · plafonné à 8h</span>
            )}
          </p>
        </div>

        {/* Liste des gains */}
        <div
          style={{
            background: '#0d1117',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {progress.yieldsDisplay.map((y) => (
            <div
              key={y.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '13px', color: '#8b949e' }}>
                {y.emoji} {y.name}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#00d2ff',
                }}
              >
                +{y.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Bouton fermer */}
        <button
          onClick={progress.dismiss}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '10px',
            color: '#00d2ff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Super, merci ! 🎉
        </button>
      </div>
    </div>
  )
}
```

---

### `src/components/harvest/RegionCard.tsx`

Carte d'une région. Trois états : verrouillée / disponible / camp actif.

```tsx
import { Region } from '../../types/game'
import { Camp } from '../../types/harvest'

interface RegionCardProps {
  region: Region
  camp: Camp | null
  onSelect: (regionId: Region['id']) => void
}

export function RegionCard({ region, camp, onSelect }: RegionCardProps) {
  const isActive = camp?.regionId === region.id
  const isLocked = !region.unlocked

  const borderColor = isActive ? '#00d2ff' : isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'
  const bgColor = isActive ? 'rgba(0,210,255,0.06)' : '#161b22'

  return (
    <button
      onClick={() => !isLocked && onSelect(region.id)}
      disabled={isLocked}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '14px',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s ease',
        // Pulse animation si camp actif
        animation: isActive ? 'pulse-ring 2s infinite' : 'none',
        opacity: isLocked ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {/* Badge "Camp actif" */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '20px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 600,
            color: '#00d2ff',
          }}
        >
          ⛺ Camp actif
        </div>
      )}

      {/* Emoji + Nom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '24px' }}>{region.emoji}</span>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: isLocked ? '#636e8a' : '#e2e8f0' }}>
            {region.name}
          </div>
          <div style={{ fontSize: '12px', color: '#636e8a', marginTop: '2px' }}>
            {region.description}
          </div>
        </div>
      </div>

      {/* Condition de déblocage si verrouillée */}
      {isLocked && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#636e8a',
          }}
        >
          🔒 {region.unlockCondition}
        </div>
      )}
    </button>
  )
}
```

---

### `src/components/harvest/CampPanel.tsx`

Panneau central affiché quand un camp est actif.
Montre les ressources produites/min et le total actuel pour la région du camp.
Se met à jour en temps réel via un `useEffect` + interval local (affichage uniquement).

```tsx
import { useMemo } from 'react'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { RESOURCES, REGIONS } from '../../data'
import { ProgressBar } from '../shared/ProgressBar'
import { Tooltip } from '../shared/Tooltip'

export function CampPanel() {
  const camp = useHarvestStore((state) => state.camp)
  const removeCamp = useHarvestStore((state) => state.removeCamp)
  const resources = useInventoryStore((state) => state.resources)

  const region = useMemo(
    () => camp ? REGIONS.find((r) => r.id === camp.regionId) : null,
    [camp]
  )

  const regionResources = useMemo(
    () => camp ? RESOURCES.filter((r) => r.region === camp.regionId) : [],
    [camp]
  )

  if (!camp || !region) {
    return (
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⛺</div>
        <p style={{ fontSize: '14px', color: '#636e8a', margin: 0 }}>
          Aucun camp actif. Sélectionne une région pour commencer la récolte.
        </p>
      </div>
    )
  }

  // Durée depuis le début du camp
  const campDuration = Date.now() - camp.startedAt
  const campHours = Math.floor(campDuration / 3600000)
  const campMinutes = Math.floor((campDuration % 3600000) / 60000)

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid rgba(0,210,255,0.2)',
        borderRadius: '12px',
        padding: '16px',
        animation: 'pulse-ring 2s infinite',
      }}
    >
      {/* Header camp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>{region.emoji}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>
              {region.name}
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>
              Camp depuis {campHours > 0 ? `${campHours}h ` : ''}{campMinutes}min
            </div>
          </div>
        </div>
        <button
          onClick={removeCamp}
          style={{
            background: 'rgba(255,68,58,0.1)',
            border: '1px solid rgba(255,68,58,0.3)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '11px',
            color: '#ff453a',
            cursor: 'pointer',
          }}
        >
          Lever le camp
        </button>
      </div>

      {/* Ressources produites */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {regionResources.map((res) => {
          const amount = resources[res.id] ?? 0
          return (
            <Tooltip key={res.id} content={res.tooltip}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#0d1117',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{res.emoji}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>
                      {res.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#636e8a' }}>
                      {res.rarityLabel}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#00d2ff' }}>
                    {Math.floor(amount).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#636e8a' }}>
                    +{res.baseYieldPerMin}/min
                  </div>
                </div>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
```

---

### `src/components/harvest/ExpeditionModal.tsx`

Modal de lancement d'expédition. Sélection de la ressource cible + durée.
Affiche le rendement estimé pour chaque durée.

```tsx
import { useState } from 'react'
import { RESOURCES } from '../../data'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useToast } from '../shared/ToastManager'
import type { RegionId } from '../../types/game'
import type { ExpeditionDuration } from '../../types/harvest'

const DURATIONS: { value: ExpeditionDuration; label: string }[] = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 heure' },
  { value: 120, label: '2 heures' },
]

const EXPEDITION_MULTIPLIER = 0.6

interface ExpeditionModalProps {
  regionId: RegionId
  onClose: () => void
}

export function ExpeditionModal({ regionId, onClose }: ExpeditionModalProps) {
  const regionResources = RESOURCES.filter((r) => r.region === regionId)
  const [selectedResource, setSelectedResource] = useState(regionResources[0]?.id ?? '')
  const [selectedDuration, setSelectedDuration] = useState<ExpeditionDuration>(30)
  const startExpedition = useHarvestStore((state) => state.startExpedition)
  const addToast = useToast()

  const selectedRes = RESOURCES.find((r) => r.id === selectedResource)
  const estimatedYield = selectedRes
    ? Math.floor(selectedRes.baseYieldPerMin * selectedDuration * EXPEDITION_MULTIPLIER)
    : 0

  function handleLaunch() {
    const result = startExpedition(selectedResource, regionId, selectedDuration)
    if (result.success) {
      addToast(`🧭 Expédition lancée ! Retour dans ${DURATIONS.find(d => d.value === selectedDuration)?.label}`, 'success')
      onClose()
    } else {
      addToast(result.reason ?? 'Impossible de lancer l\'expédition.', 'error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          width: '100%',
          maxWidth: '480px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />

        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>
          🧭 Nouvelle expédition
        </h3>

        {/* Choix de la ressource */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Ressource ciblée
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {regionResources.map((res) => (
              <button
                key={res.id}
                onClick={() => setSelectedResource(res.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: selectedResource === res.id ? 'rgba(0,210,255,0.1)' : '#0d1117',
                  border: `1px solid ${selectedResource === res.id ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                  {res.emoji} {res.name}
                </span>
                <span style={{ fontSize: '11px', color: '#636e8a' }}>
                  {res.baseYieldPerMin}/min
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Choix de la durée */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Durée de l'expédition
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {DURATIONS.map((d) => {
              const estimate = selectedRes
                ? Math.floor(selectedRes.baseYieldPerMin * d.value * EXPEDITION_MULTIPLIER)
                : 0
              const isSelected = selectedDuration === d.value
              return (
                <button
                  key={d.value}
                  onClick={() => setSelectedDuration(d.value)}
                  style={{
                    background: isSelected ? 'rgba(0,210,255,0.1)' : '#0d1117',
                    border: `1px solid ${isSelected ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '8px',
                    padding: '10px',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#00d2ff' : '#e2e8f0' }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>
                    ≈ {estimate} {selectedRes?.emoji}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Résumé + lancer */}
        <div
          style={{
            background: '#0d1117',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: '#636e8a' }}>Butin estimé</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#00d2ff' }}>
            +{estimatedYield} {selectedRes?.emoji} {selectedRes?.name}
          </span>
        </div>

        <button
          onClick={handleLaunch}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '10px',
            color: '#00d2ff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🧭 Lancer l'expédition
        </button>
      </div>
    </div>
  )
}
```

---

### `src/components/harvest/ExpeditionSlot.tsx`

Un slot d'expédition. Trois états : vide / en cours / terminée (à récupérer).
Le countdown se met à jour via `setInterval` local.

```tsx
import { useEffect, useState } from 'react'
import { useHarvestStore } from '../../stores/useHarvestStore'
import { useInventoryStore } from '../../stores/useInventoryStore'
import { RESOURCES } from '../../data'
import { useToast } from '../shared/ToastManager'
import { ProgressBar } from '../shared/ProgressBar'
import type { Expedition, ExpeditionDuration } from '../../types/harvest'
import type { RegionId } from '../../types/game'

interface ExpeditionSlotProps {
  expedition: Expedition | null
  slotIndex: number
  onStartNew: () => void  // ouvre le modal ExpeditionModal
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Terminée !'
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function ExpeditionSlot({ expedition, slotIndex, onStartNew }: ExpeditionSlotProps) {
  const [now, setNow] = useState(Date.now())
  const collectExpedition = useHarvestStore((state) => state.collectExpedition)
  const cancelExpedition = useHarvestStore((state) => state.cancelExpedition)
  const addResources = useInventoryStore((state) => state.addResources)
  const addToast = useToast()

  // Ticker local pour le countdown — ne tourne que si une expédition est en cours
  useEffect(() => {
    if (!expedition || expedition.collected) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [expedition])

  // Slot vide
  if (!expedition || expedition.collected) {
    return (
      <button
        onClick={onStartNew}
        style={{
          background: '#161b22',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '36px', height: '36px',
            background: 'rgba(0,210,255,0.08)',
            border: '1px solid rgba(0,210,255,0.2)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          +
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#636e8a' }}>
            Slot {slotIndex + 1} — Disponible
          </div>
          <div style={{ fontSize: '11px', color: '#4a5568' }}>
            Tap pour lancer une expédition
          </div>
        </div>
      </button>
    )
  }

  const resource = RESOURCES.find((r) => r.id === expedition.resourceId)
  const remaining = expedition.endsAt - now
  const isFinished = remaining <= 0
  const progress = 1 - Math.max(0, remaining) / (expedition.durationMinutes * 60 * 1000)

  function handleCollect() {
    const result = collectExpedition(expedition!.id)
    if (result) {
      addResources([result])
      const res = RESOURCES.find((r) => r.id === result.resourceId)
      addToast(`${res?.emoji ?? '📦'} +${result.amount} ${res?.name ?? result.resourceId} récupéré !`, 'success')
    }
  }

  function handleCancel() {
    cancelExpedition(expedition!.id)
    addToast('Expédition annulée. Tes ressources ont été remboursées.', 'info')
  }

  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${isFinished ? 'rgba(48,209,88,0.3)' : 'rgba(255,213,0,0.2)'}`,
        borderRadius: '12px',
        padding: '14px',
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{resource?.emoji ?? '📦'}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              {resource?.name ?? expedition.resourceId}
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>
              Expédition {slotIndex + 1}
            </div>
          </div>
        </div>

        {/* Countdown ou bouton récupérer */}
        {isFinished ? (
          <button
            onClick={handleCollect}
            style={{
              background: 'rgba(48,209,88,0.15)',
              border: '1px solid rgba(48,209,88,0.4)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#30d158',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              animation: 'pulse-ring 1.5s infinite',
            }}
          >
            ✅ Récupérer
          </button>
        ) : (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffd500' }}>
              {formatCountdown(remaining)}
            </div>
            <div style={{ fontSize: '10px', color: '#636e8a' }}>restant</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={progress}
        color={isFinished ? '#30d158' : '#ffd500'}
        height={5}
        showGlow={isFinished}
      />

      {/* Butin estimé + annuler */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
        <span style={{ fontSize: '11px', color: '#636e8a' }}>
          Butin : ≈ {resource
            ? Math.floor(resource.baseYieldPerMin * expedition.durationMinutes * 0.6)
            : '?'
          } {resource?.emoji}
        </span>
        {!isFinished && (
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '11px',
              color: '#636e8a',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Annuler (remboursé)
          </button>
        )}
      </div>
    </div>
  )
}
```

---

### `src/pages/HarvestPage.tsx`

Page principale de récolte. Assemble tous les composants.
Layout : Header → RegionInventory → Régions → Camp → Expéditions.
Tout tient sans scroll sur un iPhone 14 (844px). Sur desktop, c'est plus aéré.

```tsx
import { useState, useMemo } from 'react'
import { useHarvestStore } from '../stores/useHarvestStore'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useToast } from '../components/shared/ToastManager'
import { RegionCard } from '../components/harvest/RegionCard'
import { CampPanel } from '../components/harvest/CampPanel'
import { ExpeditionSlot } from '../components/harvest/ExpeditionSlot'
import { ExpeditionModal } from '../components/harvest/ExpeditionModal'
import { REGIONS } from '../data'
import type { RegionId } from '../types/game'

export function HarvestPage() {
  const camp = useHarvestStore((state) => state.camp)
  const setCamp = useHarvestStore((state) => state.setCamp)
  const expeditions = useHarvestStore((state) => state.expeditions)
  const addToast = useToast()

  // Modal expédition
  const [expeditionModalRegion, setExpeditionModalRegion] = useState<RegionId | null>(null)

  // Région active pour le modal (région du camp ou première débloquée)
  const activeRegionId = camp?.regionId ?? ('foret' as RegionId)

  // Expéditions actives (non collectées)
  const activeExpeditions = useMemo(
    () => expeditions.filter((e) => !e.collected),
    [expeditions]
  )

  // Slots d'expédition : toujours 3 slots affichés (null = vide)
  const expeditionSlots = useMemo(() => {
    const slots: (typeof activeExpeditions[0] | null)[] = [null, null, null]
    activeExpeditions.forEach((e, i) => { if (i < 3) slots[i] = e })
    return slots
  }, [activeExpeditions])

  function handleRegionSelect(regionId: RegionId) {
    if (camp?.regionId === regionId) return
    setCamp(regionId)
    const region = REGIONS.find((r) => r.id === regionId)
    addToast(`⛺ Camp installé en ${region?.name ?? regionId}`, 'success')
  }

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>

      {/* Titre page */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
          ⛺ Récolte
        </h1>
        <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
          Pose ton camp pour récolter en continu. Lance des expéditions pour cibler une ressource.
        </p>
      </div>

      {/* Section : Régions */}
      <section style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px'
        }}>
          Régions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {REGIONS.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              camp={camp}
              onSelect={handleRegionSelect}
            />
          ))}
        </div>
      </section>

      {/* Section : Camp actif */}
      <section style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#636e8a',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px'
        }}>
          Camp actif
        </div>
        <CampPanel />
      </section>

      {/* Section : Expéditions */}
      <section style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: '#636e8a',
            textTransform: 'uppercase', letterSpacing: '0.1em'
          }}>
            Expéditions ({activeExpeditions.length}/3)
          </div>
          <div style={{ fontSize: '11px', color: '#636e8a' }}>
            Rendement : 60% du camp
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {expeditionSlots.map((expedition, i) => (
            <ExpeditionSlot
              key={expedition?.id ?? `empty-${i}`}
              expedition={expedition}
              slotIndex={i}
              onStartNew={() => setExpeditionModalRegion(activeRegionId)}
            />
          ))}
        </div>
      </section>

      {/* Modal expédition */}
      {expeditionModalRegion && (
        <ExpeditionModal
          regionId={expeditionModalRegion}
          onClose={() => setExpeditionModalRegion(null)}
        />
      )}
    </div>
  )
}
```

---

### Mise à jour finale `src/App.tsx`

Tout est câblé ici : shell, navigation, offline modal, toasts, game loop.

```tsx
import { useState } from 'react'
import { useGameLoop } from './hooks/useGameLoop'
import { useOfflineProgress } from './hooks/useOfflineProgress'
import { useToast } from './components/shared/ToastManager'
import { ToastManager } from './components/shared/ToastManager'
import { OfflineModal } from './components/shared/OfflineModal'
import { AppShell } from './components/layout/AppShell'
import { HarvestPage } from './pages/HarvestPage'
import { useCraftStore } from './stores/useCraftStore'

type Tab = 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('harvest')
  const addToast = useToast()

  // Game loop — passe le callback toast pour les crafts complétés
  useGameLoop((craftResults) => {
    craftResults.forEach((result: any) => {
      addToast(`${result.recipeEmoji} +${result.output.amount} ${result.recipeName} crafté ! (+${result.xpGained} XP)`, 'success')
    })
  })

  // Offline progress
  const offlineProgress = useOfflineProgress()

  // Contenu selon l'onglet actif
  const renderPage = () => {
    switch (activeTab) {
      case 'harvest':   return <HarvestPage />
      case 'craft':     return <ComingSoon label="⚗️ Craft" color="#bf5af2" />
      case 'cook':      return <ComingSoon label="🍳 Cook" color="#ff9500" />
      case 'inventory': return <ComingSoon label="🎒 Inventaire" color="#ffd500" />
      case 'map':       return <ComingSoon label="🗺️ Carte" color="#636e8a" />
    }
  }

  return (
    <>
      {/* Toasts — toujours au dessus de tout */}
      <ToastManager />

      {/* Modal offline — priorité max à l'ouverture */}
      {offlineProgress && <OfflineModal progress={offlineProgress} />}

      {/* Shell principal */}
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {renderPage()}
      </AppShell>
    </>
  )
}

// Placeholder pour les pages pas encore codées
function ComingSoon({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '48px' }}>{label.split(' ')[0]}</div>
      <p style={{ fontSize: '16px', color, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '13px', color: '#636e8a' }}>En construction — prompt suivant</p>
    </div>
  )
}

export default App
```

---

## Critères de succès

### Visuel
- [ ] Fond `#0d1117` sur toute l'app, cartes `#161b22`
- [ ] Navigation 5 onglets fixe en bas, onglet actif = couleur codée par boucle
- [ ] Tout le contenu tient sans scroll sur iPhone 14 (844px)
- [ ] Les classes Tailwind `text-cf-harvest`, `bg-cf-surface` etc. sont utilisées correctement

### Fonctionnel — Camp
- [ ] Cliquer sur "Forêt des Elfes" pose le camp → badge "Camp actif" apparaît + animation pulse
- [ ] `CampPanel` affiche les 4 ressources forêt avec leur yield/min
- [ ] Les quantités dans `CampPanel` augmentent visuellement toutes les secondes
- [ ] "Lever le camp" supprime le camp → `CampPanel` revient à l'état vide
- [ ] Les 3 autres régions sont grisées avec leur condition de déblocage visible

### Fonctionnel — Expéditions
- [ ] Taper sur un slot vide → `ExpeditionModal` s'ouvre en bottom sheet
- [ ] Le modal affiche les ressources de la région active avec leur yield/min
- [ ] Sélectionner ressource + durée → le butin estimé se met à jour en temps réel
- [ ] "Lancer l'expédition" → toast succès + expédition apparaît dans le slot
- [ ] Le countdown se met à jour toutes les secondes
- [ ] La progress bar ambre progresse correctement
- [ ] Expédition terminée → bouton "✅ Récupérer" vert pulsant
- [ ] Cliquer "Récupérer" → toast "+X 🌿 Herbe récupéré !" + ressources dans l'inventaire
- [ ] "Annuler (remboursé)" annule sans perte

### Fonctionnel — Offline Modal
- [ ] Fermer et rouvrir après > 1 minute → modal "Tes équipes ont bien travaillé !" apparaît
- [ ] La liste affiche `emoji + nom + montant` (jamais les IDs)
- [ ] "Super, merci ! 🎉" ferme la modal

### Fonctionnel — Toasts
- [ ] Les toasts apparaissent en haut pendant 3s puis disparaissent
- [ ] Toast succès = vert, erreur = rouge, info = cyan
- [ ] Le `useGameLoop` déclenche un toast quand un craft se termine (même si on est sur l'onglet Récolte)

### Tooltips
- [ ] Hover/tap sur une ressource dans `CampPanel` → tooltip avec le texte de la BDD JSON
- [ ] Jamais d'ID technique visible dans l'UI (toujours `name` + `emoji`)

## Notes pour la suite
- Les pages "Craft", "Cook", "Inventaire", "Carte" sont des placeholders `<ComingSoon>`
  → elles seront remplies dans les prompts 006, 007, 008, 009
- Le `useGameLoop` accepte un callback `onCraftComplete` — câblé dans App.tsx pour les toasts,
  mais la page Craft n'existe pas encore
- La progression des régions (déblocage) est affichée mais pas encore vérifiée automatiquement
  → sera dans `useProgressStore` (Phase 3)
- Sur desktop, le layout se centre à `maxWidth: 480px` — suffisant pour le MVP mobile-first
