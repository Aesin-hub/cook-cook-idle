# Audit Phase 3 — Cooking Fantasy
Date : 2026-06-13

## Résumé
- ✅ OK : 34 points
- ⚠️ Avertissements : 2 points
- ❌ Erreurs : 1 point (CLAUDE.md obsolète — corrigé dans ce commit)

---

## Détail par section

### Section 1 — Build & Types
- **1.1 Build** ✅ — `npm run build` passe, 0 erreur TypeScript
- **1.2 Types Phase 3** ✅ — tous présents : `map.ts`, `mapState.ts`, `tile.ts`, `creature.ts`, `bestiary.ts`, `player.ts`
- **1.3 Pas de `: any`** ✅ — 0 résultat dans stores/hooks/types
- **1.4 Explorateur niv 1** ✅ — `"feature": "reveal_adjacent_rarity"` correct dans classes.json

### Section 2 — Stores Phase 3
- **2.1 XP délégué** ✅ — `useCookStore` lit `usePlayerStore.getState().totalXp` (pas sa propre XP). Les 3 références trouvées (`totalXp` lignes 252, 254, 281) sont des lectures vers playerStore, non une duplication.
- **2.2 Extension usePlayerStore** ✅ — `classModifiers`, `activeEvents`, `prestigeLevel` présents dans state init et `partialize`
- **2.3 Pas de diagonales** ✅ — `getAllAdjacentTiles` : 0 résultat dans stores/hooks/pages/components
- **2.4 Reset minuit** ✅ — `getMidnightToday()` utilisé partout (lignes 17, 35, 125, 239, 266, 308 dans useMapStore), aucun `+ 86400000`
- **2.5 XP échec hunt** ⚠️ — La constante `FAILURE_XP_RATIO = 0.2` n'existe pas en tant que telle. L'XP sur échec est stocké directement dans `creature.xpOnFailure` (champ par créature). Approche différente du spec mais fonctionnelle — permet des XP d'échec variés par créature.
- **2.6 Clés persistence** ✅ — 7 clés uniques : harvest, inventory, craft, cook, player, map, bestiary
- **2.7 Camp en transit** ✅ — `removeCamp()` appelé ligne 196 avant `isInTransit: true` ligne 204

### Section 3 — Edge Function Boss Spawner
- **3.1 Fichier présent** ✅ — `supabase/functions/boss-spawner/index.ts` existe
- **3.2 Zones correctes** ✅ — Zone 1: 5-8, Zone 2: 9-14, Zone 3: 15-22
- **3.3 TODO push notif** ✅ — `// TODO Phase 4 : push notification ici` ligne 182
- **3.4 Max 1 boss/zone** ✅ — `activeByZone[zone.zone] >= 1` + comptage actif correct

### Section 4 — Logique métier critique
- **4.1 Visibilité sans diagonales** ✅ — `getTileVisibility()` n'appelle pas `getAllAdjacentTiles`
- **4.2 Explorateur niv 1 rareté** ✅ — `explorateurLevel >= 1` → logique `revealed` sans `explored` (ligne 342-348 useMapStore)
- **4.3 Quota reset minuit** ✅ — `getMidnightToday()` : logique correcte (pas de 24h glissantes)
- **4.4 Hunt messages** ✅ — `successMessages: string[]` et `failMessages: string[]` dans `Creature` type
- **4.5 familiarTick** ✅ — appelé ligne 68 dans useGameLoop (dans le setInterval 1s)
- **4.6 Planchers multiplicateurs** ✅ — `Math.max(0.1, ...)` sur `yieldMultiplier`, `expeditionMultiplier`, `travelTimeMultiplier`
- **4.7 Offline camp null** ✅ — `if (camp)` ligne 96 dans `calculateOfflineProgress` : aucune production si camp retiré (transit)

### Section 5 — UI & Composants
- **5.1 MapTile memo** ✅ — `export const MapTile = memo(function MapTile...)` ligne 27
- **5.2 Pas de lib externe** ✅ — 0 résultat pour react-map/leaflet/mapbox/hammer
- **5.3 DebugPanel invisible prod** ✅ — `if (!import.meta.env.DEV) return null`
- **5.4 ComingSoon restants** ✅ — 0 résultat : toutes les pages sont câblées
- **5.5 BossIndicator timer** ✅ — `setInterval(..., 60000)` dans useEffect
- **5.6 CampTravelBar message** ✅ — "⚠️ Le camp ne produit pas pendant le trajet" présent

### Section 6 — Intégration des stores
- **6.1 Ordre des ticks** ✅ — harvest → craft → cook → familiar → checkArrival → cleanExpiredModifiers (toutes les minutes)
- **6.2 saveService coverage** ✅ — `saveAll()` inclut map (`useMapStore.getState().saveToSupabase`) et bestiary (`useBestiaryStore.getState().saveToSupabase`)
- **6.3 useLoadSave coverage** ✅ — `loadTiles()`, `loadPlayerSave()`, `loadBosses()` tous présents
- **6.4 getHarvestMultipliers branché** ✅ — `getHarvestMultipliers()` passé à `useGameLoop` dans App.tsx

### Section 7 — Performance
- **7.1 MapGrid useCallback** ✅ — `centerOn` en `useCallback` ligne 40
- **7.2 onClick stable** ✅ — `onClick` transmis depuis MapGrid sans recréation inline
- **7.3 localStorage size** ⚠️ — Non mesurable sans navigateur. À vérifier manuellement (`JSON.stringify(localStorage).length` dans la console). Risque si playerTiles stocke les 961 tuiles en hidden.

### Section 8 — Sécurité & Configuration
- **8.1 Service role key** ✅ — 0 résultat pour `SUPABASE_SERVICE_ROLE_KEY` dans `src/`
- **8.2 Variables env** ✅ — uniquement `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, `import.meta.env.DEV`
- **8.3 RLS** ⚠️ — À vérifier manuellement dans Supabase Dashboard : `save_map`, `save_bestiary`, `game_boss_spawns`

### Section 9 — Documentation
- **9.1 & 9.2 CLAUDE.md** ❌ → ✅ — CLAUDE.md bloqué au prompt 016 ("Prochaine étape : Prompt 016"). Tous les stores, types, composants et pages Phase 3 manquaient. **Corrigé dans ce commit.**
- **9.3 Backlog** ✅ — 013-bis à 020 marqués ✅ Fait

---

## Correctifs appliqués
- **CLAUDE.md** : mise à jour complète Phase 3 (prompts exécutés, structure fichiers, stores, types, pages, composants)

## Points à surveiller
- **localStorage size** : vérifier manuellement que la grille 31×31 ne dépasse pas 500KB. Si c'est le cas, ne persister que les tuiles `discovered` ou `explored` (pas `hidden`).
- **RLS Supabase** : vérifier `save_map`, `save_bestiary`, `game_boss_spawns` dans le Dashboard.
- **xpOnFailure** : pas de constante globale `FAILURE_XP_RATIO` — les valeurs sont par créature dans les données. S'assurer que les données Supabase ont des `xp_on_failure` cohérents (≈ 20% de `xp_on_success`).
