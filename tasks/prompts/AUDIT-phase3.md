# Prompt AUDIT — Phase 3 — Cooking Fantasy

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 013-bis à 020 ont été exécutés (Phase 3 complète).

Ce prompt est un **audit technique complet** de la Phase 3.
Son rôle : détecter les régressions, incohérences, bugs silencieux et points
d'amélioration avant d'attaquer la Phase 4.

**Claude Code doit exécuter chaque vérification, lire les fichiers concernés,
et produire un rapport structuré dans `tasks/audit-phase3.md`.**

---

## Section 1 — Build & Types

### 1.1 Build propre
```bash
npm run build
```
- ✅ Attendu : 0 erreur TypeScript, 0 warning

### 1.2 Nouveaux types cohérents
Vérifier que les types Phase 3 sont bien importés et utilisés :
- `src/types/map.ts` — `TileCoord`, `HarvestMultipliers`, `MAP_CENTER`, `MAP_SIZE`
- `src/types/mapState.ts` — `TilePlayerState`, `CampTravel`, `TileVisibility`
- `src/types/tile.ts` — `TileStatic`, `TileDynamic`, `TILE_RARITY_COLORS`
- `src/types/creature.ts` — `Creature`, `CreatureDrop`, `HuntSuccessEntry`
- `src/types/bestiary.ts` — `HuntResult`, `ActiveBoss`, `BestiaryState`
- `src/types/player.ts` — `ClassId`, `ClassModifier`, `ActiveEvent`

### 1.3 Pas de `any` non justifié
```bash
grep -r ": any" src/stores/ src/hooks/ src/types/
```
- ⚠️ Si `any` trouvé dans les stores ou types → proposer le bon type

### 1.4 Classes.json correction Explorateur niv 1
Vérifier que le niveau 1 de l'Explorateur a bien été corrigé :
```bash
grep -A3 '"level": 1' src/data/classes.json | grep "feature"
```
- ✅ Attendu : `"feature": "reveal_adjacent_rarity"` (pas `"reveal_diagonals"`)

---

## Section 2 — Stores Phase 3

### 2.1 usePlayerStore — migration XP
Vérifier que `useCraftStore` et `useCookStore` ne gèrent plus leur propre XP :
```bash
grep -n "totalXp\|totalCookXp" src/stores/useCraftStore.ts src/stores/useCookStore.ts
```
- ✅ Attendu : 0 résultat (tout délégué à `usePlayerStore.addXp()`)

### 2.2 usePlayerStore — points d'extension
Vérifier que les 3 champs d'extension existent et sont persistés :
```bash
grep -n "classModifiers\|activeEvents\|prestigeLevel" src/stores/usePlayerStore.ts
```
- ✅ Attendu : présents dans state, initialisation et partialize

### 2.3 useMapStore — pas de diagonales
Vérifier que `getAllAdjacentTiles` n'est JAMAIS appelé pour le dévoilement :
```bash
grep -rn "getAllAdjacentTiles" src/stores/ src/hooks/ src/pages/ src/components/
```
- ✅ Attendu : 0 résultat (ou uniquement dans un fichier utilitaire sans appel)

### 2.4 useMapStore — reset à minuit
Vérifier que `getMidnightToday()` est utilisé (pas de logique 24h glissantes) :
```bash
grep -n "getMidnightToday\|86400000\|24 \* 60" src/stores/useMapStore.ts
```
- ✅ Attendu : `getMidnightToday()` présent, pas de calcul `+ 86400000`

### 2.5 useBestiaryStore — FAILURE_XP_RATIO
Vérifier que l'XP en cas d'échec est bien 20% :
```bash
grep -n "FAILURE_XP_RATIO\|0.2" src/stores/useBestiaryStore.ts
```
- ✅ Attendu : `FAILURE_XP_RATIO = 0.2`

### 2.6 Clés de persistence uniques
```bash
grep -rn "name: 'cooking-fantasy" src/stores/
```
- ✅ Attendu : 6 clés différentes
  (harvest, inventory, craft, cook, player, map, bestiary)
- ❌ Si doublons : renommer

### 2.7 useMapStore — campTravel en transit = pas de production
Vérifier que `removeCamp()` est appelé lors du départ :
```bash
grep -n "removeCamp\|isInTransit" src/stores/useMapStore.ts
```
- ✅ Attendu : `removeCamp()` appelé dans `moveCamp()` avant de set `isInTransit: true`

---

## Section 3 — Edge Function Boss Spawner

### 3.1 Fichier existe
```bash
ls supabase/functions/boss-spawner/index.ts
```
- ✅ Attendu : fichier présent

### 3.2 Zones de spawn correctes
Vérifier les distances des 3 zones :
```bash
grep -A5 "distanceMin\|distanceMax" supabase/functions/boss-spawner/index.ts
```
- ✅ Attendu :
  - Zone 1 : distanceMin 5, distanceMax 8
  - Zone 2 : distanceMin 9, distanceMax 14
  - Zone 3 : distanceMin 15, distanceMax 22

### 3.3 Placeholder notifs push présent
```bash
grep -n "TODO Phase 4\|sendPushNotification" supabase/functions/boss-spawner/index.ts
```
- ✅ Attendu : commentaire TODO présent

### 3.4 Max 1 boss par zone
```bash
grep -n "activeByZone\[zone.zone\] >= 1" supabase/functions/boss-spawner/index.ts
```
- ✅ Attendu : condition présente

---

## Section 4 — Logique métier critique

### 4.1 Visibilité tuile — pas de diagonales dans la logique
Vérifier `getTileVisibility()` dans `useMapStore` :
- Ne doit jamais appeler `getAllAdjacentTiles()`
- Doit utiliser uniquement `getAdjacentTiles()` (4 cardinaux)

### 4.2 Explorateur niv 1 — rareté adjacente sans explorer
Vérifier dans `getTileVisibility()` :
```bash
grep -n "reveal_adjacent_rarity\|explorateur.*1\|explorateurLevel >= 1" src/stores/useMapStore.ts
```
- ✅ Attendu : logique qui révèle la rareté des tuiles cardinales adjacentes
  sans les explorer (state `revealed`)

### 4.3 Quota — reset à minuit pas 24h glissantes
Simuler mentalement : si `quotaLastReset` = hier 14h et `getMidnightToday()` = aujourd'hui 0h
→ `quotaLastReset < midnight` = true → quota reset ✅
Si `quotaLastReset` = aujourd'hui 2h → `quotaLastReset > midnight` → pas de reset ✅

### 4.4 Hunt — messages aléatoires non vides
Vérifier que `successMessages` et `failMessages` ont au moins 1 entrée
dans les créatures de test :
```bash
grep -c "successMessages\|failMessages" src/types/creature.ts
```
- ✅ Attendu : les deux champs sont dans le type

### 4.5 Familier — tick continu comme le camp
Vérifier dans `useGameLoop` que `familiarTick()` est appelé toutes les secondes :
```bash
grep -n "familiarTick" src/hooks/useGameLoop.ts
```
- ✅ Attendu : appelé dans l'interval de 1s

### 4.6 getHarvestMultipliers — planchers actifs
Vérifier que les valeurs ne peuvent pas descendre en dessous de leurs planchers :
```bash
grep -n "Math.max(0.1\|Math.min(2" src/stores/usePlayerStore.ts
```
- ✅ Attendu : planchers présents sur tous les multiplicateurs

### 4.7 Camp en transit — pas de production offline
Vérifier dans `useHarvestStore.calculateOfflineProgress()` :
Si `camp === null` (camp retiré pendant le transit) → aucune production calculée.

---

## Section 5 — UI & Composants

### 5.1 MapTile — memo() présent
```bash
grep -n "memo" src/components/map/MapTile.tsx
```
- ✅ Attendu : `export const MapTile = memo(function MapTile...)`
- ❌ Si absent : risque de re-render des 961 tuiles à chaque tick → performance

### 5.2 Pan/zoom — pas de librairie externe
```bash
grep -rn "import.*react-map\|import.*leaflet\|import.*mapbox\|import.*hammer" src/
```
- ✅ Attendu : 0 résultat

### 5.3 DebugPanel — invisible en production
```bash
grep -n "import.meta.env.DEV" src/components/profile/DebugPanel.tsx
```
- ✅ Attendu : `if (!import.meta.env.DEV) return null`

### 5.4 ComingSoon restants
```bash
grep -rn "ComingSoon" src/
```
- ✅ Attendu après Phase 3 : 0 `ComingSoon` (toutes les pages sont câblées)
- ⚠️ Si trouvé : identifier quelle page n'est pas encore câblée

### 5.5 BossIndicator — timer mis à jour
Vérifier que `BossIndicator` a bien un `setInterval` pour mettre à jour les timers :
```bash
grep -n "setInterval\|useEffect" src/components/map/BossIndicator.tsx
```
- ✅ Attendu : interval toutes les minutes pour rafraîchir les timers

### 5.6 CampTravelBar — message "pas de production"
```bash
grep -n "Le camp ne produit pas" src/components/map/CampTravelBar.tsx
```
- ✅ Attendu : message présent

---

## Section 6 — Intégration des stores

### 6.1 useGameLoop — ordre des ticks
Vérifier l'ordre d'exécution dans le setInterval :
```bash
grep -n "harvestTick\|craftTick\|cookTick\|familiarTick\|checkArrival\|cleanExpired" src/hooks/useGameLoop.ts
```
- ✅ Attendu (dans l'ordre) :
  1. harvestTick
  2. craftTick
  3. cookTick
  4. familiarTick
  5. checkArrival
  6. cleanExpiredModifiers (toutes les minutes)

### 6.2 useSaveManager — tous les stores sauvegardés
```bash
grep -n "saveToSupabase\|saveAll" src/lib/saveService.ts
```
- ✅ Attendu : harvest, inventory, craft, cook, map, bestiary tous présents

### 6.3 useLoadSave — tous les saves chargés
```bash
grep -n "loadPlayerSave\|loadTiles\|loadBosses" src/hooks/useLoadSave.ts
```
- ✅ Attendu : map, bestiary et bosses chargés après login

### 6.4 App.tsx — multiplicateurs branchés
```bash
grep -n "getHarvestMultipliers" src/App.tsx
```
- ✅ Attendu : `getHarvestMultipliers()` passé à `useGameLoop`
- ❌ Si `DEFAULT_HARVEST_MULTIPLIERS` encore utilisé → classes n'ont aucun effet

---

## Section 7 — Performance

### 7.1 Pas de recalcul inutile sur MapGrid
Vérifier que `MapGrid` utilise `useCallback` sur `handleTileClick` :
```bash
grep -n "useCallback" src/components/map/MapGrid.tsx
```
- ✅ Attendu : `centerOn` en `useCallback`

### 7.2 MapTile — pas de fonctions inline dans le render
Les fonctions `onClick` dans la grille doivent être stables pour que `memo()` soit efficace.
Vérifier que le `onClick` de chaque tuile est bien transmis depuis `MapGrid`
sans être recréé à chaque render.

### 7.3 Taille du localStorage
```bash
# Dans la console du navigateur :
# JSON.stringify(localStorage).length
# ✅ Attendu : < 500KB (la grille 31×31 peut être lourde)
```
Si > 500KB → `playerTiles` dans `useMapStore` est trop volumineux →
envisager de ne persister que les tuiles discovered/explored (pas les tuiles hidden)

---

## Section 8 — Sécurité & Configuration

### 8.1 Edge Function — service role key non exposée
```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/
```
- ✅ Attendu : 0 résultat (la service role key ne doit jamais être dans `src/`)
- Elle est uniquement dans la Edge Function via `Deno.env.get()`

### 8.2 Variables d'environnement
```bash
grep -rn "import.meta.env" src/
```
- ✅ Attendu : uniquement `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`

### 8.3 RLS save_map et save_bestiary
Vérifier dans Supabase Table Editor que les RLS sont actives sur :
- `save_map` — policy `auth.uid() = user_id`
- `save_bestiary` — policy `auth.uid() = user_id`
- `game_boss_spawns` — lecture publique, écriture service_role uniquement

---

## Section 9 — CLAUDE.md à jour

### 9.1 Section Phase 3 complète
```bash
grep -n "useMapStore\|useBestiaryStore\|usePlayerStore\|MAP_CENTER\|TileCoord" CLAUDE.md
```
- ✅ Attendu : tous ces éléments documentés dans CLAUDE.md

### 9.2 Structure de fichiers à jour
Vérifier que CLAUDE.md liste bien tous les nouveaux dossiers et fichiers :
- `src/types/map.ts`, `mapState.ts`, `tile.ts`, `creature.ts`, `bestiary.ts`, `player.ts`
- `src/stores/useMapStore.ts`, `useBestiaryStore.ts`, `usePlayerStore.ts`
- `src/pages/MapPage.tsx`, `ProfilePage.tsx`
- `src/components/map/`, `src/components/profile/`
- `supabase/functions/boss-spawner/`

Si des fichiers manquent → mettre à jour CLAUDE.md.

### 9.3 Backlog à jour
```bash
cat tasks/backlog.md
```
- ✅ Attendu : 013-bis à 020 marqués ✅ Fait + AUDIT Phase 3 en cours

---

## Output attendu

Créer `tasks/audit-phase3.md` :

```markdown
# Audit Phase 3 — Cooking Fantasy
Date : [date]

## Résumé
- ✅ OK : X points
- ⚠️ Avertissements : X points
- ❌ Erreurs : X points

## Détail par section
### Section 1 — Build & Types
### Section 2 — Stores Phase 3
### Section 3 — Edge Function
### Section 4 — Logique métier
### Section 5 — UI & Composants
### Section 6 — Intégration stores
### Section 7 — Performance
### Section 8 — Sécurité
### Section 9 — Documentation

## Correctifs appliqués
## Points à surveiller
```

## Critères de succès de l'audit
- [ ] `npm run build` passe sans erreur après correctifs
- [ ] 0 erreur ❌ dans le rapport final
- [ ] `tasks/audit-phase3.md` créé et complet
- [ ] `CLAUDE.md` mis à jour avec tous les fichiers Phase 3
- [ ] `tasks/backlog.md` mis à jour
