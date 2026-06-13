# Prompt 024 — Intégration Phaser de base

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 023 ont été exécutés.

Structure existante pertinente :
- `src/App.tsx` — shell principal, navigation
- `src/stores/useGameDataStore.ts` — données de jeu avec sprites
- `src/types/asset.ts` — `GameAsset`, `getFrameWidth()`
- `src/index.css` — styles globaux
- Le canvas doit être en `position: fixed` derrière toute l'UI React (z-index 0)

## Objectif
Poser les fondations de Phaser dans le projet :
1. Installer Phaser en lazy loading
2. Créer le canvas global derrière l'UI React
3. Créer le système d'événements React ↔ Phaser (EventBus)
4. Créer les scènes de base (Boot, Game, UI)
5. Afficher uniquement le fond sombre — rien d'autre pour l'instant

## Décisions techniques validées
- **WebGL** avec fallback Canvas 2D automatique
- **Pixel ratio automatique** — rendu net sur tous les écrans (Retina inclus)
- **Lazy loading** — Phaser chargé uniquement après login, pas au démarrage
- **Canvas fixed** derrière toute l'UI React (z-index 0)
- Sprites **32×32** — standard pour tout le jeu

---

## Installation

```bash
npm install phaser
```

Phaser fait ~1MB. On l'importe en dynamic import pour ne pas alourdir le bundle initial.

---

## Fichiers à créer

---

### `src/game/EventBus.ts`

Bus d'événements partagé entre React et Phaser.
C'est le seul point de communication entre les deux mondes.

```typescript
import { EventEmitter } from 'eventemitter3'

/**
 * EventBus — pont entre React et Phaser.
 *
 * React émet des événements, Phaser les écoute (et vice versa).
 * Aucun import direct de Phaser dans React, aucun import de React dans Phaser.
 *
 * Événements React → Phaser :
 *   SCENE_READY         → Phaser indique qu'une scène est prête
 *   CRAFT_SUCCESS       → { x, y, emoji } effet particules craft réussi
 *   EXPEDITION_RETURN   → { success } effet retour d'expédition
 *   COOK_COMPLETE       → { x, y, emoji } effet plat cuisiné
 *   BOSS_SPAWNED        → { tileX, tileY } boss apparu sur la carte
 *   LEVEL_UP            → { classId, level } montée de niveau classe
 *   MAP_MOVE_CAMP       → { fromX, fromY, toX, toY } déplacement camp
 *   MAP_REVEAL_TILES    → { tiles: TileCoord[] } tuiles à révéler
 *   MAP_RENDER          → demande de re-render complet de la carte
 *   ACTIVE_TAB_CHANGE   → { tab: string } changement d'onglet
 */
export const EventBus = new EventEmitter()

// Types des événements pour la sécurité TypeScript
export type GameEventName =
  | 'SCENE_READY'
  | 'CRAFT_SUCCESS'
  | 'EXPEDITION_RETURN'
  | 'COOK_COMPLETE'
  | 'BOSS_SPAWNED'
  | 'LEVEL_UP'
  | 'MAP_MOVE_CAMP'
  | 'MAP_REVEAL_TILES'
  | 'MAP_RENDER'
  | 'ACTIVE_TAB_CHANGE'

export interface GameEvents {
  SCENE_READY: { sceneName: string }
  CRAFT_SUCCESS: { x: number; y: number; emoji: string }
  EXPEDITION_RETURN: { success: boolean }
  COOK_COMPLETE: { x: number; y: number; emoji: string }
  BOSS_SPAWNED: { tileX: number; tileY: number; creatureName: string }
  LEVEL_UP: { classId: string; level: number; description: string }
  MAP_MOVE_CAMP: { fromX: number; fromY: number; toX: number; toY: number }
  MAP_REVEAL_TILES: { tiles: Array<{ x: number; y: number }> }
  MAP_RENDER: Record<string, never>
  ACTIVE_TAB_CHANGE: { tab: string }
}
```

---

### `src/game/scenes/BootScene.ts`

Scène de démarrage — charge les assets depuis Supabase Storage.
Pour l'instant vide — les assets seront chargés dans les prompts suivants.

```typescript
import Phaser from 'phaser'
import { EventBus } from '../EventBus'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Les assets seront chargés ici dans les prompts suivants
    // (prompt 025 : tuiles, prompt 026 : créatures...)
    // Pour l'instant on crée juste les graphiques de base

    // Fond dégradé pour le canvas (visible uniquement sur les zones sans UI)
    // Correspond au design system : #0d1117
  }

  create() {
    // Créer les graphiques de base
    this.createBackground()

    // Démarrer la scène principale
    this.scene.start('GameScene')
    this.scene.launch('UIScene')

    EventBus.emit('SCENE_READY', { sceneName: 'BootScene' })
  }

  private createBackground() {
    // Fond uni couleur design system #0d1117
    this.cameras.main.setBackgroundColor('#0d1117')
  }
}
```

---

### `src/game/scenes/GameScene.ts`

Scène principale du jeu — recevra la carte Phaser (prompt 025).
Pour l'instant elle écoute les événements et prépare l'infrastructure.

```typescript
import Phaser from 'phaser'
import { EventBus } from '../EventBus'

export class GameScene extends Phaser.Scene {
  private activeTab: string = 'harvest'

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    // Fond
    this.cameras.main.setBackgroundColor('#0d1117')

    // Écouter les changements d'onglet depuis React
    EventBus.on('ACTIVE_TAB_CHANGE', ({ tab }: { tab: string }) => {
      this.activeTab = tab
      this.onTabChange(tab)
    })

    EventBus.emit('SCENE_READY', { sceneName: 'GameScene' })
  }

  private onTabChange(tab: string) {
    // Afficher/masquer les layers selon l'onglet actif
    // Sera implémenté dans les prompts suivants
    // Exemple : layer carte visible uniquement sur l'onglet 'map'
  }

  update() {
    // Boucle de jeu — sera utilisée par la carte (prompt 025)
  }

  shutdown() {
    EventBus.removeAllListeners()
  }
}
```

---

### `src/game/scenes/UIScene.ts`

Scène UI — gère les effets visuels par-dessus tout le jeu.
Tourne en parallèle de GameScene, z-index plus élevé.
Les effets de particules seront ici (prompt 029).

```typescript
import Phaser from 'phaser'
import { EventBus } from '../EventBus'

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    // Écouter les événements d'effets visuels
    EventBus.on('CRAFT_SUCCESS', (data: { x: number; y: number; emoji: string }) => {
      this.playCraftEffect(data.x, data.y, data.emoji)
    })

    EventBus.on('LEVEL_UP', (data: { classId: string; level: number; description: string }) => {
      this.playLevelUpEffect(data)
    })

    EventBus.emit('SCENE_READY', { sceneName: 'UIScene' })
  }

  private playCraftEffect(x: number, y: number, emoji: string) {
    // Placeholder — effets de particules dans le prompt 029
    // Pour l'instant : texte flottant simple
    const text = this.add.text(x, y, `✨ ${emoji}`, {
      fontSize: '20px',
      color: '#ffd500',
    }).setOrigin(0.5)

    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  private playLevelUpEffect(data: { classId: string; level: number; description: string }) {
    // Placeholder — sera enrichi dans le prompt 029
    const { width, height } = this.cameras.main
    const text = this.add.text(width / 2, height / 2 - 40, `⭐ Niveau ${data.level} !`, {
      fontSize: '24px',
      color: '#ffd500',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.tweens.add({
      targets: text,
      y: height / 2 - 80,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  shutdown() {
    EventBus.removeAllListeners()
  }
}
```

---

### `src/game/PhaserGame.ts`

Classe principale Phaser — configuration et initialisation.

```typescript
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { UIScene } from './scenes/UIScene'

let gameInstance: Phaser.Game | null = null

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  if (gameInstance) return gameInstance

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,  // WebGL avec fallback Canvas 2D automatique
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0d1117',
    scene: [BootScene, GameScene, UIScene],
    scale: {
      mode: Phaser.Scale.RESIZE,       // s'adapte à la taille de la fenêtre
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,                  // rendu pixel art net (pas de blur)
      antialias: false,                // désactiver l'antialiasing pour le pixel art
      roundPixels: true,               // arrondir les positions pour éviter le blur
    },
    // Pixel ratio automatique — rendu net sur écrans Retina
    resolution: window.devicePixelRatio || 1,
    // Audio désactivé pour l'instant (sera activé plus tard)
    audio: {
      disableWebAudio: false,
    },
  }

  gameInstance = new Phaser.Game(config)

  // Gérer le resize de la fenêtre
  window.addEventListener('resize', () => {
    if (gameInstance) {
      gameInstance.scale.resize(window.innerWidth, window.innerHeight)
    }
  })

  return gameInstance
}

export function destroyPhaserGame() {
  if (gameInstance) {
    gameInstance.destroy(true)
    gameInstance = null
  }
}

export function getPhaserGame(): Phaser.Game | null {
  return gameInstance
}
```

---

### `src/components/PhaserCanvas.tsx`

Composant React qui monte et démonte le canvas Phaser.
Position fixed derrière toute l'UI (z-index 0).

```tsx
import { useEffect, useRef } from 'react'
import type { Phaser as PhaserType } from 'phaser'

interface PhaserCanvasProps {
  onReady?: () => void
}

export function PhaserCanvas({ onReady }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Lazy loading de Phaser — chargé uniquement ici
    import('../game/PhaserGame').then(({ createPhaserGame }) => {
      if (!containerRef.current) return
      gameRef.current = createPhaserGame(containerRef.current)
      onReady?.()
    })

    return () => {
      import('../game/PhaserGame').then(({ destroyPhaserGame }) => {
        destroyPhaserGame()
      })
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,                    // derrière toute l'UI React
        pointerEvents: 'none',        // les clics passent à travers vers l'UI React
        overflow: 'hidden',
      }}
    />
  )
}
```

---

### Mise à jour `src/App.tsx`

Monter le canvas Phaser derrière l'UI. Émettre les événements clés.

```tsx
// Ajouter les imports :
import { PhaserCanvas } from './components/PhaserCanvas'
import { EventBus } from './game/EventBus'

// Dans GameApp(), modifier le rendu :
// Ajouter PhaserCanvas comme premier enfant, AVANT ToastManager

return (
  <>
    {/* Canvas Phaser — derrière tout (z-index 0) */}
    <PhaserCanvas />

    {/* UI React — par-dessus (z-index 1+) */}
    <ToastManager />
    {offlineProgress && <OfflineModal progress={offlineProgress} />}
    <AppShell activeTab={activeTab} onTabChange={(tab) => {
      setActiveTab(tab)
      // Notifier Phaser du changement d'onglet
      EventBus.emit('ACTIVE_TAB_CHANGE', { tab })
    }}>
      {renderPage()}
    </AppShell>
  </>
)
```

### Mise à jour `src/index.css`

S'assurer que le canvas Phaser ne cause pas de scroll :

```css
/* Empêcher le scroll causé par le canvas Phaser */
canvas {
  display: block;
}

body {
  overflow: hidden;
}
```

---

### Hook `src/hooks/useGameEvents.ts`

Hook utilitaire pour émettre des événements Phaser depuis n'importe quel composant React.

```typescript
import { useCallback } from 'react'
import { EventBus } from '../game/EventBus'
import type { GameEvents, GameEventName } from '../game/EventBus'

/**
 * useGameEvents
 *
 * Émet des événements vers Phaser depuis un composant React.
 * Utilisation :
 *   const { emit } = useGameEvents()
 *   emit('CRAFT_SUCCESS', { x: 150, y: 300, emoji: '⚗️' })
 */
export function useGameEvents() {
  const emit = useCallback(<T extends GameEventName>(
    event: T,
    data: GameEvents[T]
  ) => {
    EventBus.emit(event, data)
  }, [])

  return { emit }
}
```

---

### Mise à jour `src/stores/useCraftStore.ts`

Émettre un événement Phaser quand un craft est terminé.

```typescript
// Dans processTick(), quand un craft se termine, ajouter :
import { EventBus } from '../game/EventBus'

// Après avoir calculé le résultat du craft :
EventBus.emit('CRAFT_SUCCESS', {
  x: window.innerWidth / 2,   // centre de l'écran pour l'instant
  y: window.innerHeight / 2,  // sera affiné dans le prompt 025
  emoji: recipe.emoji,
})
```

---

## Critères de succès

### Installation
- [ ] `npm install phaser` sans erreur
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] La taille du bundle initial n'augmente pas (Phaser est lazy-loadé)

### Canvas
- [ ] Le canvas Phaser est visible en fond (fond `#0d1117`)
- [ ] L'UI React est par-dessus, entièrement cliquable
- [ ] Le canvas s'adapte au resize de la fenêtre
- [ ] Sur mobile (Capacitor) : rendu net sur écran Retina

### EventBus
- [ ] `EventBus.emit('CRAFT_SUCCESS', { x: 100, y: 100, emoji: '⚗️' })` dans la console → texte flottant visible
- [ ] `EventBus.emit('ACTIVE_TAB_CHANGE', { tab: 'map' })` → GameScene reçoit l'événement
- [ ] `EventBus.emit('LEVEL_UP', { classId: 'recolteur', level: 2, description: '+20% yield' })` → texte animé visible

### Scènes
- [ ] BootScene démarre → GameScene + UIScene lancées
- [ ] Console : `[SCENE_READY] BootScene`, `[SCENE_READY] GameScene`, `[SCENE_READY] UIScene`
- [ ] Pas d'erreur Phaser dans la console

### Performances
- [ ] 60fps sur desktop (vérifiable dans les DevTools)
- [ ] Pas de fuite mémoire au reload (destroyPhaserGame appelé au unmount)

## Notes pour la suite
- Le prompt 025 (Carte Phaser) ajoutera les textures de tuiles dans `BootScene.preload()`
  et le rendu de la grille dans `GameScene`
- `pointerEvents: 'none'` sur le canvas est intentionnel — tous les clics vont à l'UI React.
  Quand on aura besoin de clics sur la carte Phaser (zoom, pan), on activera
  les pointer events uniquement sur le canvas de la carte
- `UIScene` tourne en parallèle de `GameScene` — les effets peuvent apparaître
  par-dessus n'importe quel écran du jeu
- La résolution `window.devicePixelRatio` garantit un rendu net sur tous les écrans
  sans configuration supplémentaire
