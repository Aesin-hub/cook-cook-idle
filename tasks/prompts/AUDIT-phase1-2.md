# Prompt AUDIT — Phase 1 & 2 — Cooking Fantasy

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 011 ont été exécutés (Phase 1 complète + Phase 2 complète).

Ce prompt est un **audit technique complet** à exécuter avant d'attaquer la Phase 2.5.
Son rôle : détecter les incohérences, les bugs silencieux, les dépendances cassées,
et les améliorations à faire avant d'aller plus loin.

**Claude Code doit exécuter chaque vérification, lire les fichiers concernés,
et produire un rapport structuré avec le statut de chaque point.**

---

## Instructions générales

Pour chaque section :
1. Lire les fichiers concernés
2. Exécuter les vérifications demandées
3. Marquer chaque point ✅ OK / ⚠️ Avertissement / ❌ Erreur
4. Proposer un correctif si ⚠️ ou ❌

À la fin : produire un fichier `tasks/audit-phase1-2.md` avec le rapport complet.

---

## Section 1 — Build TypeScript

### 1.1 Build propre
```bash
npm run build
```
- ✅ Attendu : 0 erreur, 0 warning TypeScript
- ❌ Si erreurs : les lister et les corriger

### 1.2 Types cohérents entre fichiers
Vérifier que les types utilisés dans les stores correspondent exactement
aux interfaces définies dans `src/types/` :

- `useHarvestStore` utilise bien `Camp`, `Expedition`, `HarvestYield` de `src/types/harvest.ts`
- `useCraftStore` utilise bien `CraftJob`, `CraftResult` de `src/types/craft.ts`
- `useCookStore` utilise bien `Furnace`, `ProductionResult`, `CookState` de `src/types/cook.ts`
- `useInventoryStore` utilise bien `HarvestYield` pour `addResources` et `removeResources`

### 1.3 Imports depuis `src/data/index.ts`
Vérifier qu'aucun fichier n'importe directement les JSON :
```bash
grep -r "from.*data/resources.json\|from.*data/craft-recipes\|from.*data/cook-recipes\|from.*data/machines\|from.*data/regions" src/
```
- ✅ Attendu : 0 résultat (tous les imports passent par `src/data/index.ts`)
- ❌ Si résultats : corriger pour passer par `index.ts`

---

## Section 2 — Cohérence des données JSON

### 2.1 Tous les champs requis présents
Lire `src/data/resources.json` et vérifier que chaque ressource a :
`id`, `name`, `emoji`, `region`, `rarity`, `rarityLabel`, `baseYieldPerMin`, `tooltip`

Lire `src/data/regions.json` et vérifier que chaque région a :
`id`, `name`, `emoji`, `unlocked`, `description`, `tooltip`, `unlockCondition`

Lire `src/data/craft-recipes.json` et vérifier que chaque recette a :
`id`, `name`, `emoji`, `description`, `tooltip`, `inputs`, `output`, `craftTimeSeconds`, `firstTimeFast`, `xpReward`

Lire `src/data/cook-recipes.json` et vérifier que chaque recette a :
`id`, `name`, `emoji`, `description`, `tooltip`, `productionLine`, `optimalRatio`, `cookTimeSeconds`, `outputPerBatch`, `xpReward`, `unlocked`

Lire `src/data/machines.json` et vérifier que chaque machine a :
`id`, `name`, `emoji`, `description`, `tooltip`, `tier`, `speedMultiplier`, `efficiencyBonus`, `compatibleRecipes`, `unlockLevel`, `unlockXp`

### 2.2 Références croisées valides
- Chaque ressource dans `resources.json` a un `region` qui existe dans `regions.json`
- Chaque `input.resourceId` dans `craft-recipes.json` existe dans `resources.json`
- Chaque `resourceId` dans `cook-recipes.json productionLine` existe soit dans
  `resources.json` soit comme `output.resourceId` dans `craft-recipes.json`
- Chaque `compatibleRecipes` dans `machines.json` référence un ID existant dans `cook-recipes.json`

### 2.3 RegionId TypeScript vs JSON
Vérifier que tous les `id` dans `regions.json` sont présents dans le type `RegionId`
de `src/types/game.ts` :
```bash
grep "RegionId" src/types/game.ts
```
Comparer avec les IDs dans `regions.json`.

### 2.4 Ratios cook cohérents
Pour chaque recette dans `cook-recipes.json`, vérifier que :
- `optimalRatio.ratios` a le même nombre d'éléments que `productionLine`
- Les ratios sont bien la simplification des `perMin` (PGCD)

---

## Section 3 — Stores Zustand

### 3.1 Clés de persistence uniques
Vérifier que chaque store `persist` utilise une clé unique :
```bash
grep -r "name: 'cooking-fantasy" src/stores/
```
- ✅ Attendu : 4 clés différentes (harvest, inventory, craft, cook)
- ❌ Si doublons : renommer

### 3.2 Accès inter-stores
Vérifier que les stores n'utilisent jamais les hooks React entre eux
(ils doivent utiliser `.getState()`) :
```bash
grep -r "useInventoryStore(\|useHarvestStore(\|useCraftStore(\|useCookStore(" src/stores/
```
- ✅ Attendu : 0 résultat (les stores utilisent `.getState()`, pas les hooks)
- ❌ Si résultats : remplacer par `.getState()`

### 3.3 Partialize correct
Vérifier que chaque store `partialize` n'inclut pas les fonctions (actions),
seulement l'état :
Lire chaque `partialize` dans les 4 stores et confirmer qu'il ne contient
que des données, jamais de fonctions.

### 3.4 useGameLoop — instance unique
Vérifier que `useGameLoop` n'est monté qu'une seule fois dans l'app :
```bash
grep -r "useGameLoop" src/
```
- ✅ Attendu : appelé uniquement dans `App.tsx` (ou `GameApp`)
- ❌ Si appelé ailleurs : risque de double tick

---

## Section 4 — Logique métier critique

### 4.1 Offline progress — pas de valeurs négatives
Vérifier dans `useHarvestStore.calculateOfflineProgress()` et
`useCookStore.calculateOfflineProgress()` que :
- `elapsedMs` est bien plafonné à `OFFLINE_CAP_MS` (8h)
- Les amounts retournés sont tous `>= 0`
- Le `productionRatio` dans le Cook offline est bien `Math.max(0, ratio)`

### 4.2 removeResources — vérification avant débit
Vérifier dans `useInventoryStore.removeResources()` que la fonction
vérifie le stock AVANT de débiter (pas de valeurs négatives en inventaire) :
Lire la fonction et confirmer le pattern :
```
canAfford = yields.every(...)
if (!canAfford) return false
// seulement ensuite : débiter
```

### 4.3 firstTimeFast — ne se redéclenche pas
Vérifier dans `useCraftStore` que `craftedOnce` est bien persisté
et que le `firstTimeFast` ne s'applique que si `!craftedOnce[recipeId]`.

### 4.4 Cook — pause auto sur stock vide
Vérifier que `checkCanProduce()` dans `cookHelpers.ts` retourne bien
`'no_stock'` si un seul ingrédient manque, et que `processTick()` dans
`useCookStore` ne débite RIEN si `pausedReason !== null`.

### 4.5 Expéditions — pas de collecte avant la fin
Vérifier dans `useHarvestStore.collectExpedition()` que la condition
`Date.now() < expedition.endsAt` empêche bien la collecte anticipée.

---

## Section 5 — UI & Composants

### 5.1 Aucun ID technique visible
Chercher les endroits où un `resourceId` brut pourrait s'afficher :
```bash
grep -r "resourceId\|\.id}" src/components/ src/pages/
```
Vérifier que dans chaque cas, l'ID est résolu en `name` + `emoji` avant affichage.

### 5.2 CraftQueueBar — position fixed
Vérifier que `CraftQueueBar` est en `position: fixed` avec `bottom: 64px`
(hauteur de la BottomNav) et `zIndex: 90`.

### 5.3 Safe area iOS
Vérifier que les composants fixes (BottomNav, CraftQueueBar, modals)
utilisent `paddingBottom: 'env(safe-area-inset-bottom)'`.

### 5.4 ComingSoon — pages restantes
Vérifier quelles pages sont encore en `<ComingSoon>` :
```bash
grep -r "ComingSoon" src/
```
- ✅ Attendu après Phase 2 : seulement `map` (Carte)
- ⚠️ Si `cook` ou `craft` ou `inventory` encore en ComingSoon : les câbler

### 5.5 Animations CSS déclarées
Vérifier que `@keyframes slideDown` et `@keyframes pulse-ring` sont bien
dans `src/index.css` (utilisées par ToastManager et FurnaceCard).

---

## Section 6 — Performance & bonnes pratiques

### 6.1 Pas de recalcul inutile
Vérifier que les listes triées / filtrées dans les pages utilisent `useMemo` :
- `CraftPage` : tri des recettes
- `InventoryPage` : filtre + tri
- `CookPage` : liste des fourneaux

### 6.2 Pas de setState dans le render
```bash
grep -r "setState\|set(" src/components/ | grep -v "onClick\|onChange\|useEffect\|useState"
```
Vérifier qu'il n'y a pas d'appel à `set()` directement dans le corps d'un composant.

### 6.3 Clés React uniques
Vérifier que tous les `.map()` dans les composants utilisent des clés
uniques et stables (pas d'index comme clé sur des listes réordonnées) :
```bash
grep -r "key={index\|key={i}" src/
```
- ⚠️ Si trouvé sur des listes réordonnées : remplacer par l'ID de l'élément

---

## Section 7 — Sécurité & configuration

### 7.1 .env.local non commité
```bash
cat .gitignore | grep env
```
- ✅ Attendu : `.env.local` présent dans `.gitignore`
- ❌ Si absent : ajouter immédiatement

### 7.2 Variables d'environnement préfixées VITE_
Vérifier que toutes les variables Supabase sont bien préfixées `VITE_`
(sinon elles ne sont pas exposées au client Vite) :
```bash
grep -r "import.meta.env" src/
```
- ✅ Attendu : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`

### 7.3 Aucune clé API en dur dans le code
```bash
grep -r "eyJ\|supabase.co" src/
```
- ✅ Attendu : 0 résultat (tout passe par `import.meta.env`)

---

## Section 8 — CLAUDE.md et tasks/

### 8.1 CLAUDE.md à jour
Vérifier que `CLAUDE.md` à la racine liste bien tous les fichiers créés
jusqu'au prompt 011 dans la section "Structure du projet".

### 8.2 backlog.md à jour
Vérifier que `tasks/backlog.md` marque bien les prompts 001 à 011 comme ✅ Fait.

### 8.3 Prompts dans tasks/prompts/
```bash
ls tasks/prompts/
```
- ✅ Attendu : 001 à 011 + AUDIT présents

---

## Output attendu

À la fin de l'audit, créer le fichier `tasks/audit-phase1-2.md` avec :

```markdown
# Audit Phase 1 & 2 — Cooking Fantasy
Date : [date]

## Résumé
- ✅ OK : X points
- ⚠️ Avertissements : X points
- ❌ Erreurs : X points

## Détail par section

### Section 1 — Build TypeScript
[résultats]

### Section 2 — Données JSON
[résultats]

### Section 3 — Stores Zustand
[résultats]

### Section 4 — Logique métier
[résultats]

### Section 5 — UI & Composants
[résultats]

### Section 6 — Performance
[résultats]

### Section 7 — Sécurité
[résultats]

### Section 8 — Documentation
[résultats]

## Correctifs appliqués
[liste des corrections effectuées pendant l'audit]

## Points à surveiller (non bloquants)
[liste des avertissements à garder en tête pour la suite]
```

## Critères de succès de l'audit
- [ ] `npm run build` passe sans erreur après les correctifs
- [ ] 0 erreur ❌ dans le rapport final
- [ ] Le fichier `tasks/audit-phase1-2.md` est créé et complet
- [ ] `tasks/backlog.md` est mis à jour avec l'audit comme étape ✅
