export type ClassId =
  | 'recolteur'
  | 'artisan'
  | 'cuisinier'
  | 'explorateur'
  | 'chasseur'
  | 'erudit'

export type XpSource =
  | 'harvest'
  | 'craft'
  | 'cook'
  | 'explore'
  | 'hunt'
  | 'discover'

export const XP_SOURCE_TO_CLASS: Record<XpSource, ClassId> = {
  harvest:  'recolteur',
  craft:    'artisan',
  cook:     'cuisinier',
  explore:  'explorateur',
  hunt:     'chasseur',
  discover: 'erudit',
}

export type BonusType =
  | 'yield_multiplier'
  | 'expedition_multiplier'
  | 'expedition_slots'
  | 'travel_time_multiplier'
  | 'offline_cap_multiplier'
  | 'craft_time_multiplier'
  | 'craft_double_chance'
  | 'cook_speed_multiplier'
  | 'cook_efficiency'
  | 'furnace_bonus'
  | 'xp_multiplier'
  | 'drop_rate_multiplier'
  | 'unlock_feature'

export interface ClassBonus {
  type: BonusType
  value: number
  feature?: string
}

export interface ClassLevel {
  level: number
  xpRequired: number
  bonus: ClassBonus
  description: string
}

export interface ClassDefinition {
  id: ClassId
  name: string
  emoji: string
  description: string
  levels: ClassLevel[]
}

export interface PlayerState {
  totalXp: number
  classXp: Record<ClassId, number>
  classLevels: Record<ClassId, number>
  createdAt: number
}
