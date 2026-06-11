# Backlog — Cooking Fantasy

## ✅ Fait

### Phase 1 — Core Loop MVP
- 001 — Init projet (Vite + React + Tailwind + Zustand + shadcn) ✅ (2026-06-09)
- 002 — Modélisation données ressources (JSON config + types TS) ✅ (2026-06-09)
- 003 — Système de timers idle (camp + expéditions + offline progress) ✅ (2026-06-09)
- 004 — Système de craft (timer + file d'attente) ✅ (2026-06-09)
- 005 — UI Récolte (HarvestPage + AppShell + BottomNav + Toasts + OfflineModal) ✅ (2026-06-09)
- 006 — UI Craft (RecipeCard + CraftQueueBar + XpBadge) ✅ (2026-06-09)
- 007 — UI Inventaire (InventoryPage + filtres + tri + summary) ✅ (2026-06-09)
- 008 — Sauvegarde Supabase (auth + save cloud) ✅ (2026-06-10)

### Phase 2 — Cook Layer
- 009 — Données Cook (machines.json + furnace-levels.json + types) ✅ (2026-06-10)
- 010 — Store Cook (useCookStore + gameLoop + offline) ✅ (2026-06-10)
- 011 — UI Cook (CookPage + FurnaceCard + modals) ✅ (2026-06-10)
- AUDIT — Audit Phase 1 & 2 ✅ (2026-06-10)

### Phase 2.5 — Admin Panel & Migration données
- 012 — Migration JSON → Supabase (6 tables game data + seedGameData) ✅ (2026-06-10)
- 013 — Admin Panel (CRUD régions / ressources / recettes / machines) ✅ (2026-06-10)

### Phase 3 — World & Progression
- 013-bis — Migration stores Phase 2 → Phase 3 (types carte, multiplicateurs) ✅ (2026-06-11)

## 🔄 En cours
- 014 — usePlayerStore (XP global + 6 classes × 10 niveaux)

## 📋 À faire

### Phase 3 (suite)
- 015 — Données carte 31×31 + créatures + admin carte
- 016 — useMapStore (brouillard de guerre + déplacement + quotas)
- 017 — Extension usePlayerStore (classModifiers, activeEvents, prestigeLevel)
- 018 — useBestiaryStore + Edge Function boss spawns
- 019 — UI Carte (grille joueur 31×31, pan/zoom, bottom sheet)
- 020 — UI Classes & Profil (ProfilePage + ClassCard + FamiliarCollection)
- AUDIT Phase 3

### Post-Phase 3
- 021 — Craft Automatique (seuils de stock + chaînes Cook)
- 022 — Cahier de Recettes (vraies recettes depuis le Profil)

### Phase 4 — Social & Méta
- Commerce avec villages, cartes à collectionner, monétisation cosmétique

---

## 📝 Format d'une entrée "Fait"
```
- 001 — Init projet ✅ (date)
```
