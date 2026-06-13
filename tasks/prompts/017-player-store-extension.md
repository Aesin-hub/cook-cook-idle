# Prompt 017 — Extension usePlayerStore (points d'extension futurs)

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 016 ont été exécutés.

Structure existante :
- `src/stores/usePlayerStore.ts` — XP, niveaux, multiplicateurs, features
- `src/types/player.ts` — `ClassId`, `XpSource`, `ClassBonus`, `PlayerState`

## Objectif
Enrichir `usePlayerStore` avec des **points d'extension** pour les futures features,
sans créer de store séparé. Zéro changement de comportement aujourd'hui —
les nouveaux champs sont vides/neutres par défaut.

## Ce qu'on ajoute

### 3 points d'extension dans `PlayerState`

```typescript
// 1. Modificateurs de classe (futurs items équipables, buffs temporaires)
// Ex: un anneau qui donne +10% yield en plus du Récolteur
classModifiers: ClassModifier[]

// 2. Événements actifs (futurs événements temporaires)
// Ex: "Fête de la récolte — x2 XP Récolteur pendant 24h"
activeEvents: ActiveEvent[]

// 3. Niveau de prestige (future mécanique de reset)
prestigeLevel: number
```

---

## Fichiers à modifier

### Mise à jour `src/types/player.ts`

Ajouter les nouveaux types à la fin du fichier :

```typescript
// ─── POINTS D'EXTENSION FUTURS ───────────────────────────────────────────────

/**
 * Modificateur de classe externe (item équipé, buff temporaire, etc.)
 * Valeur neutre par défaut — ne fait rien tant que la liste est vide.
 */
export interface ClassModifier {
  id: string              // identifiant unique du modificateur
  source: string          // source du bonus ("ring_of_harvest", "event_solstice"...)
  classId: ClassId        // classe affectée
  bonusType: BonusType    // type de bonus (même enum que ClassBonus)
  value: number           // valeur du bonus
  expiresAt?: number      // timestamp d'expiration (undefined = permanent)
  description: string     // affiché au joueur
}

/**
 * Événement temporaire actif.
 * Ex: double XP pendant un événement saisonnier.
 */
export interface ActiveEvent {
  id: string
  name: string
  emoji: string
  modifiers: ClassModifier[]
  startsAt: number
  endsAt: number
}
```

### Mise à jour `src/stores/usePlayerStore.ts`

**1. Ajouter dans `PlayerState` :**

```typescript
// Dans l'interface PlayerState, ajouter :
classModifiers: ClassModifier[]
activeEvents: ActiveEvent[]
prestigeLevel: number
```

**2. Ajouter dans l'état initial du store :**

```typescript
// Dans create(), ajouter aux valeurs initiales :
classModifiers: [],
activeEvents: [],
prestigeLevel: 0,
```

**3. Ajouter dans `partialize` :**

```typescript
// Dans partialize(), ajouter :
classModifiers: state.classModifiers,
activeEvents: state.activeEvents,
prestigeLevel: state.prestigeLevel,
```

**4. Enrichir `getHarvestMultipliers()` pour lire les modifiers**

Modifier la fonction pour cumuler les `classModifiers` actifs en plus des bonus de classe :

```typescript
getHarvestMultipliers: (): HarvestMultipliers => {
  const { classLevels, classModifiers, activeEvents } = get()

  let yieldMultiplier = DEFAULT_HARVEST_MULTIPLIERS.yieldMultiplier
  let expeditionMultiplier = DEFAULT_HARVEST_MULTIPLIERS.expeditionMultiplier
  let travelTimeMultiplier = DEFAULT_HARVEST_MULTIPLIERS.travelTimeMultiplier
  let offlineCapMultiplier = DEFAULT_HARVEST_MULTIPLIERS.offlineCapMultiplier

  // 1. Bonus des niveaux de classe (inchangé)
  for (const classId of ALL_CLASS_IDS) {
    const level = classLevels[classId] ?? 0
    if (level === 0) continue
    const classDef = CLASS_MAP[classId]
    const unlockedLevels = classDef.levels.filter((l) => l.level <= level)
    for (const lvl of unlockedLevels) {
      const bonus = lvl.bonus
      switch (bonus.type) {
        case 'yield_multiplier':
          yieldMultiplier = Math.max(yieldMultiplier, bonus.value)
          break
        case 'expedition_multiplier':
          expeditionMultiplier = Math.max(expeditionMultiplier, bonus.value)
          break
        case 'travel_time_multiplier':
          travelTimeMultiplier = Math.min(travelTimeMultiplier, bonus.value)
          break
        case 'offline_cap_multiplier':
          offlineCapMultiplier = Math.max(offlineCapMultiplier, bonus.value)
          break
      }
    }
  }

  // 2. Modificateurs externes (items équipés, événements)
  // Tous les modifiers actifs (non expirés)
  const now = Date.now()
  const allModifiers = [
    ...classModifiers.filter((m) => !m.expiresAt || m.expiresAt > now),
    ...activeEvents
      .filter((e) => e.startsAt <= now && e.endsAt > now)
      .flatMap((e) => e.modifiers),
  ]

  for (const mod of allModifiers) {
    switch (mod.bonusType) {
      case 'yield_multiplier':
        // Les modifiers s'additionnent (pas de max) — bonus cumulatif
        yieldMultiplier += (mod.value - 1.0)
        break
      case 'expedition_multiplier':
        expeditionMultiplier += (mod.value - 1.0)
        break
      case 'travel_time_multiplier':
        travelTimeMultiplier = Math.min(travelTimeMultiplier, mod.value)
        break
      case 'offline_cap_multiplier':
        offlineCapMultiplier = Math.max(offlineCapMultiplier, mod.value)
        break
    }
  }

  return {
    yieldMultiplier: Math.max(0.1, yieldMultiplier),      // plancher à 10%
    expeditionMultiplier: Math.max(0.1, expeditionMultiplier),
    travelTimeMultiplier: Math.max(0.1, travelTimeMultiplier),
    offlineCapMultiplier: Math.max(1.0, offlineCapMultiplier),
  }
},
```

**5. Ajouter les actions pour les futures features**

```typescript
// Ajouter ces actions dans le store (pas encore utilisées — prêtes pour plus tard)

// Ajouter un modificateur externe (item équipé, buff)
addClassModifier: (modifier: ClassModifier) => {
  set((state) => ({
    classModifiers: [...state.classModifiers, modifier],
  }))
},

// Supprimer un modificateur
removeClassModifier: (modifierId: string) => {
  set((state) => ({
    classModifiers: state.classModifiers.filter((m) => m.id !== modifierId),
  }))
},

// Activer un événement temporaire
activateEvent: (event: ActiveEvent) => {
  set((state) => ({
    activeEvents: [...state.activeEvents.filter((e) => e.id !== event.id), event],
  }))
},

// Nettoyer les événements expirés (appelé périodiquement)
cleanExpiredModifiers: () => {
  const now = Date.now()
  set((state) => ({
    classModifiers: state.classModifiers.filter((m) => !m.expiresAt || m.expiresAt > now),
    activeEvents: state.activeEvents.filter((e) => e.endsAt > now),
  }))
},
```

**6. Ajouter dans les types du store**

```typescript
// Dans l'interface PlayerActions, ajouter :
addClassModifier: (modifier: ClassModifier) => void
removeClassModifier: (modifierId: string) => void
activateEvent: (event: ActiveEvent) => void
cleanExpiredModifiers: () => void
```

---

## Critères de succès
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] `usePlayerStore` a les champs `classModifiers`, `activeEvents`, `prestigeLevel`
- [ ] Tous initialisés à `[]`, `[]`, `0`
- [ ] `getHarvestMultipliers()` fonctionne exactement comme avant (zéro régression)
- [ ] Ajouter un modifier `{ bonusType: 'yield_multiplier', value: 1.5, ... }` →
  `getHarvestMultipliers().yieldMultiplier` augmente de 0.5
- [ ] `cleanExpiredModifiers()` supprime les modifiers avec `expiresAt` passé
- [ ] Le jeu fonctionne exactement comme avant

## Notes pour la suite
- `classModifiers` sera alimenté par le futur système d'items équipables (Phase 4+)
- `activeEvents` sera alimenté par les futurs événements saisonniers
- `prestigeLevel` sera lu par le futur système de prestige
- `cleanExpiredModifiers()` sera appelé dans `useGameLoop` toutes les minutes
