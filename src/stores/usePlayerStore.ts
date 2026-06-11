import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import classesData from '../data/classes.json'
import type { ClassId, XpSource, PlayerState, ClassDefinition, ClassBonus, ClassModifier, ActiveEvent } from '../types/player'
import { XP_SOURCE_TO_CLASS } from '../types/player'
import type { HarvestMultipliers } from '../types/map'
import { DEFAULT_HARVEST_MULTIPLIERS } from '../types/map'

const CLASSES: ClassDefinition[] = classesData.classes as ClassDefinition[]

const CLASS_MAP: Record<ClassId, ClassDefinition> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c])
) as Record<ClassId, ClassDefinition>

const ALL_CLASS_IDS: ClassId[] = [
  'recolteur', 'artisan', 'cuisinier', 'explorateur', 'chasseur', 'erudit',
]

const INITIAL_CLASS_XP: Record<ClassId, number> = Object.fromEntries(
  ALL_CLASS_IDS.map((id) => [id, 0])
) as Record<ClassId, number>

const INITIAL_CLASS_LEVELS: Record<ClassId, number> = Object.fromEntries(
  ALL_CLASS_IDS.map((id) => [id, 0])
) as Record<ClassId, number>

interface PlayerActions {
  addXp: (source: XpSource, amount: number) => {
    xpGained: number
    classLeveledUp: ClassId | null
    newLevel: number | null
  }
  getClassLevel: (classId: ClassId) => number
  getClassXp: (classId: ClassId) => number
  getClassProgress: (classId: ClassId) => number
  getHarvestMultipliers: () => HarvestMultipliers
  isFeatureUnlocked: (feature: string) => boolean
  getActiveBonuses: (classId: ClassId) => ClassBonus[]
  addClassModifier: (modifier: ClassModifier) => void
  removeClassModifier: (modifierId: string) => void
  activateEvent: (event: ActiveEvent) => void
  cleanExpiredModifiers: () => void
  debugSetClassLevel: (classId: ClassId, level: number) => void
}

type PlayerStore = PlayerState & PlayerActions

function computeClassLevel(classId: ClassId, xp: number): number {
  const classDef = CLASS_MAP[classId]
  if (!classDef) return 0
  let level = 0
  for (const lvl of classDef.levels) {
    if (xp >= lvl.xpRequired) level = lvl.level
    else break
  }
  return level
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      totalXp: 0,
      classXp: { ...INITIAL_CLASS_XP },
      classLevels: { ...INITIAL_CLASS_LEVELS },
      createdAt: Date.now(),
      classModifiers: [],
      activeEvents: [],
      prestigeLevel: 0,

      addXp: (source, amount) => {
        const { classXp, classLevels, totalXp } = get()
        const classId = XP_SOURCE_TO_CLASS[source]

        // Multiplicateur XP (Érudit) — à affiner en prompt 017
        const xpMultiplier = get().getHarvestMultipliers().yieldMultiplier
        const xpGained = Math.floor(amount * xpMultiplier)

        const newClassXp = { ...classXp, [classId]: classXp[classId] + xpGained }
        const newLevel = computeClassLevel(classId, newClassXp[classId])
        const oldLevel = classLevels[classId]
        const leveledUp = newLevel > oldLevel

        set({
          totalXp: totalXp + xpGained,
          classXp: newClassXp,
          classLevels: leveledUp
            ? { ...classLevels, [classId]: newLevel }
            : classLevels,
        })

        return {
          xpGained,
          classLeveledUp: leveledUp ? classId : null,
          newLevel: leveledUp ? newLevel : null,
        }
      },

      getClassLevel: (classId) => get().classLevels[classId] ?? 0,
      getClassXp: (classId) => get().classXp[classId] ?? 0,

      getClassProgress: (classId) => {
        const { classXp, classLevels } = get()
        const currentLevel = classLevels[classId] ?? 0
        const classDef = CLASS_MAP[classId]
        if (!classDef) return 0

        const nextLevelDef = classDef.levels.find((l) => l.level === currentLevel + 1)
        if (!nextLevelDef) return 1

        const currentLevelDef = classDef.levels.find((l) => l.level === currentLevel)
        const fromXp = currentLevelDef?.xpRequired ?? 0
        const toXp = nextLevelDef.xpRequired
        const current = classXp[classId] ?? 0

        return Math.min((current - fromXp) / (toXp - fromXp), 1)
      },

      getHarvestMultipliers: (): HarvestMultipliers => {
        const { classLevels, classModifiers, activeEvents } = get()

        let yieldMultiplier = DEFAULT_HARVEST_MULTIPLIERS.yieldMultiplier
        let expeditionMultiplier = DEFAULT_HARVEST_MULTIPLIERS.expeditionMultiplier
        let travelTimeMultiplier = DEFAULT_HARVEST_MULTIPLIERS.travelTimeMultiplier
        let offlineCapMultiplier = DEFAULT_HARVEST_MULTIPLIERS.offlineCapMultiplier

        // 1. Bonus des niveaux de classe (max pour buffs, min pour temps)
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

        // 2. Modificateurs externes (items équipés, événements actifs) — cumulatifs
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
          yieldMultiplier: Math.max(0.1, yieldMultiplier),
          expeditionMultiplier: Math.max(0.1, expeditionMultiplier),
          travelTimeMultiplier: Math.max(0.1, travelTimeMultiplier),
          offlineCapMultiplier: Math.max(1.0, offlineCapMultiplier),
        }
      },

      isFeatureUnlocked: (feature) => {
        const { classLevels } = get()
        for (const classId of ALL_CLASS_IDS) {
          const level = classLevels[classId] ?? 0
          const classDef = CLASS_MAP[classId]
          const unlockedLevels = classDef.levels.filter((l) => l.level <= level)
          for (const lvl of unlockedLevels) {
            if (lvl.bonus.type === 'unlock_feature' && lvl.bonus.feature === feature) {
              return true
            }
          }
        }
        return false
      },

      getActiveBonuses: (classId) => {
        const { classLevels } = get()
        const level = classLevels[classId] ?? 0
        const classDef = CLASS_MAP[classId]
        if (!classDef || level === 0) return []
        return classDef.levels
          .filter((l) => l.level <= level)
          .map((l) => l.bonus)
      },

      addClassModifier: (modifier) => {
        set((state) => ({ classModifiers: [...state.classModifiers, modifier] }))
      },

      removeClassModifier: (modifierId) => {
        set((state) => ({
          classModifiers: state.classModifiers.filter((m) => m.id !== modifierId),
        }))
      },

      activateEvent: (event) => {
        set((state) => ({
          activeEvents: [...state.activeEvents.filter((e) => e.id !== event.id), event],
        }))
      },

      cleanExpiredModifiers: () => {
        const now = Date.now()
        set((state) => ({
          classModifiers: state.classModifiers.filter((m) => !m.expiresAt || m.expiresAt > now),
          activeEvents: state.activeEvents.filter((e) => e.endsAt > now),
        }))
      },

      debugSetClassLevel: (classId, level) => {
        if (!import.meta.env.DEV) return
        const classDef = CLASS_MAP[classId]
        if (!classDef) return
        const levelDef = classDef.levels.find((l) => l.level === level)
        const xpRequired = levelDef?.xpRequired ?? 0

        set((state) => ({
          classXp: { ...state.classXp, [classId]: xpRequired },
          classLevels: { ...state.classLevels, [classId]: level },
        }))
        console.log(`[Debug] ${classId} → niveau ${level}`)
      },
    }),
    {
      name: 'cooking-fantasy-player',
      partialize: (state) => ({
        totalXp: state.totalXp,
        classXp: state.classXp,
        classLevels: state.classLevels,
        createdAt: state.createdAt,
        classModifiers: state.classModifiers,
        activeEvents: state.activeEvents,
        prestigeLevel: state.prestigeLevel,
      }),
    }
  )
)
