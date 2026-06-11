import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BOSS_ZONES = [
  {
    zone: 1,
    distanceMin: 5,
    distanceMax: 8,
    rarityWeights: { common: 60, uncommon: 30, rare: 10, epic: 0, legendary: 0 },
    durationHoursMin: 4,
    durationHoursMax: 6,
  },
  {
    zone: 2,
    distanceMin: 9,
    distanceMax: 14,
    rarityWeights: { common: 0, uncommon: 50, rare: 35, epic: 15, legendary: 0 },
    durationHoursMin: 4,
    durationHoursMax: 6,
  },
  {
    zone: 3,
    distanceMin: 15,
    distanceMax: 22,
    rarityWeights: { common: 0, uncommon: 0, rare: 40, epic: 40, legendary: 20 },
    durationHoursMin: 4,
    durationHoursMax: 6,
  },
]

const MAP_CENTER = { x: 15, y: 15 }
const MAP_SIZE = 31

function tileDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function pickRarity(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  let rand = Math.random() * total
  for (const [rarity, weight] of Object.entries(weights)) {
    rand -= weight
    if (rand <= 0) return rarity
  }
  return 'common'
}

async function pickTileInZone(
  distMin: number,
  distMax: number,
  targetRarity: string
): Promise<{ x: number; y: number } | null> {
  const { data: tiles } = await supabase
    .from('game_map')
    .select('x, y, data')
    .eq('data->>isEnabled', 'true')
    .neq('data->>specialType', 'village')

  if (!tiles || tiles.length === 0) return null

  const candidates = tiles.filter((t) => {
    const dist = tileDistance({ x: t.x, y: t.y }, MAP_CENTER)
    const rarity = t.data?.rarity ?? 'common'
    return dist >= distMin && dist <= distMax && rarity === targetRarity
  })

  if (candidates.length === 0) {
    const fallback = tiles.filter((t) => {
      const dist = tileDistance({ x: t.x, y: t.y }, MAP_CENTER)
      return dist >= distMin && dist <= distMax
    })
    if (fallback.length === 0) return null
    const picked = fallback[Math.floor(Math.random() * fallback.length)]
    return { x: picked.x, y: picked.y }
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  return { x: picked.x, y: picked.y }
}

async function pickBossForTile(
  tileX: number,
  tileY: number,
  targetRarity: string
): Promise<string | null> {
  const { data: tileRow } = await supabase
    .from('game_map')
    .select('data')
    .eq('x', tileX)
    .eq('y', tileY)
    .single()

  if (!tileRow) return null

  const biome = tileRow.data?.biome ?? 'forest'
  const culture = tileRow.data?.culture ?? 'center'

  const { data: creatures } = await supabase
    .from('game_creatures')
    .select('id, data')

  if (!creatures) return null

  const compatible = creatures.filter((c) => {
    const d = c.data
    return (
      d.isBoss === true &&
      d.rarity === targetRarity &&
      d.compatibleBiomes?.includes(biome) &&
      d.compatibleCultures?.includes(culture)
    )
  })

  if (compatible.length === 0) {
    const fallback = creatures.filter((c) =>
      c.data.isBoss === true &&
      c.data.compatibleBiomes?.includes(biome)
    )
    if (fallback.length === 0) return null
    return fallback[Math.floor(Math.random() * fallback.length)].id
  }

  return compatible[Math.floor(Math.random() * compatible.length)].id
}

// Satisfy unused import warning — MAP_SIZE is conceptually used by zone distance bounds
void MAP_SIZE

Deno.serve(async () => {
  const now = new Date()

  await supabase
    .from('game_boss_spawns')
    .update({ is_active: false })
    .lt('expires_at', now.toISOString())
    .eq('is_active', true)

  const { data: activeBosses } = await supabase
    .from('game_boss_spawns')
    .select('zone')
    .eq('is_active', true)

  const activeByZone: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  for (const boss of activeBosses ?? []) {
    activeByZone[boss.zone] = (activeByZone[boss.zone] ?? 0) + 1
  }

  const spawned = []
  for (const zone of BOSS_ZONES) {
    if ((activeByZone[zone.zone] ?? 0) >= 1) continue

    const rarity = pickRarity(zone.rarityWeights)
    const tile = await pickTileInZone(zone.distanceMin, zone.distanceMax, rarity)
    if (!tile) continue

    const creatureId = await pickBossForTile(tile.x, tile.y, rarity)
    if (!creatureId) continue

    const durationHours = zone.durationHoursMin +
      Math.random() * (zone.durationHoursMax - zone.durationHoursMin)
    const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000)

    const { data: newBoss } = await supabase
      .from('game_boss_spawns')
      .insert({
        creature_id: creatureId,
        tile_x: tile.x,
        tile_y: tile.y,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        zone: zone.zone,
      })
      .select()
      .single()

    if (newBoss) spawned.push(newBoss)

    // TODO Phase 4 : push notification ici
  }

  return new Response(
    JSON.stringify({ ok: true, spawned: spawned.length, activeByZone }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
