export interface HuntResult {
  success: boolean
  creatureId: string
  creatureName: string
  creatureEmoji: string
  drops: { resourceId: string; amount: number }[]
  xpGained: number
  familiarCaptured: boolean
  message: string
}

export interface ActiveBoss {
  id: string
  creatureId: string
  tileX: number
  tileY: number
  spawnedAt: number
  expiresAt: number
  zone: 1 | 2 | 3
}

export interface HuntHistoryEntry {
  timestamp: number
  creatureId: string
  success: boolean
  xpGained: number
}

export interface BestiaryState {
  capturedCreatureIds: string[]
  activeFamiliarId: string | null
  familiarLastTickAt: number
  activeBosses: ActiveBoss[]
  bossesLastLoadedAt: number
  huntHistory: HuntHistoryEntry[]
}
