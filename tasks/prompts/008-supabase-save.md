# Prompt 008 — Sauvegarde Supabase

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 007 ont été exécutés. Le jeu tourne avec 3 onglets jouables.

Structure existante pertinente :
- `src/stores/useHarvestStore.ts` — `camp`, `expeditions`, `lastSavedAt` (persist localStorage)
- `src/stores/useInventoryStore.ts` — `resources: Record<string, number>` (persist localStorage)
- `src/stores/useCraftStore.ts` — `queue`, `totalXp`, `craftedOnce` (persist localStorage)
- `src/hooks/useGameLoop.ts` — tick 1s, monté dans App.tsx
- `src/App.tsx` — shell principal

## Prérequis OBLIGATOIRES avant d'exécuter ce prompt
- [ ] Projet Supabase créé sur supabase.com
- [ ] Les 4 tables SQL créées (voir checklist Notion "Actions manuelles")
- [ ] RLS activé sur les 4 tables
- [ ] `.env.local` à la racine avec :
  ```
  VITE_SUPABASE_URL=https://xxxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJxxx...
  ```

## Décisions d'architecture

### Stratégie de sauvegarde : une table par store
Chaque store Zustand a sa propre table Supabase.
Chaque ligne = 1 joueur (clé unique sur `user_id`).
On utilise `upsert` pour créer ou mettre à jour en une seule opération.

```
Supabase tables         ←→    Zustand stores
save_inventory          ←→    useInventoryStore  (resources)
save_harvest            ←→    useHarvestStore    (camp, expeditions, lastSavedAt)
save_craft              ←→    useCraftStore      (queue, totalXp, craftedOnce)
```

### Stratégie de sync : sauvegarde périodique + au départ
- **Sauvegarde auto** toutes les **30 secondes** via `useSaveManager`
- **Sauvegarde immédiate** quand l'utilisateur quitte la page (`beforeunload`)
- **Chargement** au login : les données Supabase écrasent le localStorage
- **Fallback** : si Supabase est inaccessible, le localStorage continue de fonctionner

### Auth : email/password simple
- Page de login/register minimaliste (pas de design élaboré pour le MVP)
- Session persistée automatiquement par le client Supabase
- Pas de social login pour l'instant

### Priorité des données au chargement
```
Login joueur
  → Charger depuis Supabase
  → Si données Supabase existent → écraser le localStorage
  → Si pas de données Supabase → utiliser le localStorage (nouveau joueur)
  → Lancer le jeu
```

---

## Installation

```bash
npm install @supabase/supabase-js
```

---

## Fichiers à créer / modifier

---

### `src/lib/supabase.ts`

Client Supabase singleton. Lit les variables d'environnement Vite.

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes dans .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types des tables Supabase
export interface SaveInventoryRow {
  user_id: string
  resources: Record<string, number>
  updated_at?: string
}

export interface SaveHarvestRow {
  user_id: string
  camp: import('../types/harvest').Camp | null
  expeditions: import('../types/harvest').Expedition[]
  last_saved_at: number
  updated_at?: string
}

export interface SaveCraftRow {
  user_id: string
  queue: import('../types/craft').CraftJob[]
  total_xp: number
  crafted_once: Record<string, boolean>
  updated_at?: string
}
```

---

### `src/stores/useAuthStore.ts`

Store Zustand pour l'authentification. Gère la session Supabase.

```typescript
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

interface AuthActions {
  initialize: () => Promise<void>           // à appeler au démarrage de l'app
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  initialize: async () => {
    set({ loading: true })

    // Récupérer la session existante
    const { data: { session } } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null, loading: false })

    // Écouter les changements de session (login/logout)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
    })
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ error: error.message, loading: false })
      return false
    }
    set({ user: data.user, session: data.session, loading: false })
    return true
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ error: error.message, loading: false })
      return false
    }
    set({ user: data.user, session: data.session ?? null, loading: false })
    return true
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  clearError: () => set({ error: null }),
}))
```

---

### `src/lib/saveService.ts`

Service de sauvegarde/chargement. Toutes les opérations Supabase sont ici.
Les stores ne connaissent pas Supabase — la séparation est nette.

```typescript
import { supabase } from './supabase'
import type { SaveInventoryRow, SaveHarvestRow, SaveCraftRow } from './supabase'

// ─── SAUVEGARDE ───────────────────────────────────────────────

export async function saveInventory(
  userId: string,
  resources: Record<string, number>
): Promise<void> {
  const { error } = await supabase
    .from('save_inventory')
    .upsert(
      { user_id: userId, resources, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[SaveService] saveInventory error:', error.message)
}

export async function saveHarvest(
  userId: string,
  camp: SaveHarvestRow['camp'],
  expeditions: SaveHarvestRow['expeditions'],
  lastSavedAt: number
): Promise<void> {
  const { error } = await supabase
    .from('save_harvest')
    .upsert(
      {
        user_id: userId,
        camp,
        expeditions,
        last_saved_at: lastSavedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[SaveService] saveHarvest error:', error.message)
}

export async function saveCraft(
  userId: string,
  queue: SaveCraftRow['queue'],
  totalXp: number,
  craftedOnce: Record<string, boolean>
): Promise<void> {
  const { error } = await supabase
    .from('save_craft')
    .upsert(
      {
        user_id: userId,
        queue,
        total_xp: totalXp,
        crafted_once: craftedOnce,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[SaveService] saveCraft error:', error.message)
}

// Sauvegarde complète des 3 stores en parallèle
export async function saveAll(userId: string): Promise<void> {
  const { useInventoryStore } = await import('../stores/useInventoryStore')
  const { useHarvestStore } = await import('../stores/useHarvestStore')
  const { useCraftStore } = await import('../stores/useCraftStore')

  const inventory = useInventoryStore.getState()
  const harvest = useHarvestStore.getState()
  const craft = useCraftStore.getState()

  await Promise.all([
    saveInventory(userId, inventory.resources),
    saveHarvest(userId, harvest.camp, harvest.expeditions, harvest.lastSavedAt),
    saveCraft(userId, craft.queue, craft.totalXp, craft.craftedOnce),
  ])
}

// ─── CHARGEMENT ───────────────────────────────────────────────

export async function loadSave(userId: string): Promise<{
  inventory: SaveInventoryRow | null
  harvest: SaveHarvestRow | null
  craft: SaveCraftRow | null
}> {
  const [inventoryRes, harvestRes, craftRes] = await Promise.all([
    supabase.from('save_inventory').select('*').eq('user_id', userId).single(),
    supabase.from('save_harvest').select('*').eq('user_id', userId).single(),
    supabase.from('save_craft').select('*').eq('user_id', userId).single(),
  ])

  return {
    inventory: inventoryRes.data ?? null,
    harvest: harvestRes.data ?? null,
    craft: craftRes.data ?? null,
  }
}

// Applique les données chargées aux stores Zustand
export async function applyLoadedSave(
  inventory: SaveInventoryRow | null,
  harvest: SaveHarvestRow | null,
  craft: SaveCraftRow | null
): Promise<void> {
  const { useInventoryStore } = await import('../stores/useInventoryStore')
  const { useHarvestStore } = await import('../stores/useHarvestStore')
  const { useCraftStore } = await import('../stores/useCraftStore')

  if (inventory) {
    useInventoryStore.setState({ resources: inventory.resources })
  }

  if (harvest) {
    useHarvestStore.setState({
      camp: harvest.camp,
      expeditions: harvest.expeditions,
      lastSavedAt: harvest.last_saved_at,
    })
  }

  if (craft) {
    useCraftStore.setState({
      queue: craft.queue,
      totalXp: craft.total_xp,
      craftedOnce: craft.crafted_once,
    })
  }
}
```

---

### `src/hooks/useSaveManager.ts`

Hook monté dans App.tsx. Gère la sauvegarde automatique (30s) et au départ.

```typescript
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { saveAll } from '../lib/saveService'

const AUTOSAVE_INTERVAL_MS = 30_000  // 30 secondes

/**
 * useSaveManager
 *
 * - Sauvegarde automatique toutes les 30s si l'utilisateur est connecté
 * - Sauvegarde immédiate quand la page se ferme (beforeunload)
 *
 * À monter UNE SEULE FOIS dans App.tsx.
 */
export function useSaveManager() {
  const user = useAuthStore((state) => state.user)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user) {
      // Pas connecté → pas de sauvegarde cloud, localStorage suffit
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    // Autosave toutes les 30s
    intervalRef.current = setInterval(() => {
      saveAll(user.id).catch(console.error)
    }, AUTOSAVE_INTERVAL_MS)

    // Sauvegarde au départ de la page
    const handleUnload = () => saveAll(user.id)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [user])
}
```

---

### `src/hooks/useLoadSave.ts`

Hook qui charge la sauvegarde Supabase après le login et l'applique aux stores.

```typescript
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { loadSave, applyLoadedSave } from '../lib/saveService'

export type LoadStatus = 'idle' | 'loading' | 'done' | 'error'

/**
 * useLoadSave
 *
 * Appelé une fois après le login.
 * Charge les données Supabase et les applique aux stores Zustand.
 * Les données cloud écrasent le localStorage.
 */
export function useLoadSave(): LoadStatus {
  const user = useAuthStore((state) => state.user)
  const [status, setStatus] = useState<LoadStatus>('idle')

  useEffect(() => {
    if (!user) {
      setStatus('idle')
      return
    }

    setStatus('loading')

    loadSave(user.id)
      .then(({ inventory, harvest, craft }) => {
        return applyLoadedSave(inventory, harvest, craft)
      })
      .then(() => setStatus('done'))
      .catch((err) => {
        console.error('[useLoadSave] Erreur chargement:', err)
        setStatus('error')
        // Fallback : localStorage déjà chargé par Zustand persist → le jeu peut continuer
      })
  }, [user?.id])

  return status
}
```

---

### `src/pages/AuthPage.tsx`

Page de login/register. Design minimaliste dans le thème du jeu.
Deux modes : "Connexion" et "Créer un compte", bascule par un toggle.

```tsx
import { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, signUp, loading, error, clearError } = useAuthStore()

  async function handleSubmit() {
    clearError()
    if (mode === 'login') {
      await signIn(email, password)
    } else {
      const success = await signUp(email, password)
      if (success) {
        // Après inscription, passer en mode login avec confirmation
        setMode('login')
      }
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '32px 24px',
          width: '100%',
          maxWidth: '380px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🍖</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
            Cooking Fantasy
          </h1>
          <p style={{ fontSize: '13px', color: '#636e8a', margin: '4px 0 0' }}>
            {mode === 'login' ? 'Bon retour, aventurier !' : 'Rejoins l\'aventure !'}
          </p>
        </div>

        {/* Toggle login / register */}
        <div
          style={{
            display: 'flex',
            background: '#0d1117',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '20px',
          }}
        >
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); clearError() }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: mode === m ? '#161b22' : 'transparent',
                color: mode === m ? '#e2e8f0' : '#636e8a',
                fontSize: '13px',
                fontWeight: mode === m ? 600 : 400,
                cursor: 'pointer',
                border: mode === m ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
              }}
            >
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        {/* Champs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{
              background: '#0d1117',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '14px',
              color: '#e2e8f0',
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{
              background: '#0d1117',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '14px',
              color: '#e2e8f0',
              outline: 'none',
            }}
          />
        </div>

        {/* Message d'erreur */}
        {error && (
          <div
            style={{
              background: 'rgba(255,68,58,0.1)',
              border: '1px solid rgba(255,68,58,0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#ff453a',
              marginBottom: '12px',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Bouton submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          style={{
            width: '100%',
            padding: '13px',
            background: loading || !email || !password
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,210,255,0.15)',
            border: `1px solid ${loading || !email || !password
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,210,255,0.4)'}`,
            borderRadius: '10px',
            color: loading || !email || !password ? '#4a5568' : '#00d2ff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? '⏳ Chargement...'
            : mode === 'login' ? '🚀 Se connecter' : '✨ Créer mon compte'
          }
        </button>

        {/* Note mode de jeu offline */}
        <p style={{ fontSize: '11px', color: '#4a5568', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
          Sans compte, ta progression est sauvegardée localement sur cet appareil uniquement.
        </p>
      </div>
    </div>
  )
}
```

---

### Mise à jour `src/App.tsx`

Intégrer auth + save manager + chargement de sauvegarde.

```tsx
import { useEffect, useState } from 'react'
import { useGameLoop } from './hooks/useGameLoop'
import { useOfflineProgress } from './hooks/useOfflineProgress'
import { useSaveManager } from './hooks/useSaveManager'
import { useLoadSave } from './hooks/useLoadSave'
import { useAuthStore } from './stores/useAuthStore'
import { useToast, ToastManager } from './components/shared/ToastManager'
import { OfflineModal } from './components/shared/OfflineModal'
import { AppShell } from './components/layout/AppShell'
import { HarvestPage } from './pages/HarvestPage'
import { CraftPage } from './pages/CraftPage'
import { InventoryPage } from './pages/InventoryPage'
import { AuthPage } from './pages/AuthPage'

type Tab = 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'

function GameApp() {
  const [activeTab, setActiveTab] = useState<Tab>('harvest')
  const addToast = useToast()

  // Hooks principaux
  useGameLoop((craftResults) => {
    craftResults.forEach((result: any) => {
      addToast(
        `${result.recipeEmoji} +${result.output.amount} ${result.recipeName} ! (+${result.xpGained} XP)`,
        'success'
      )
    })
  })

  const offlineProgress = useOfflineProgress()
  useSaveManager()
  const loadStatus = useLoadSave()

  // Écran de chargement pendant la récupération de la sauvegarde
  if (loadStatus === 'loading') {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ fontSize: '40px' }}>🍖</div>
        <p style={{ fontSize: '14px', color: '#636e8a' }}>Chargement de ta sauvegarde...</p>
      </div>
    )
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'harvest':   return <HarvestPage />
      case 'craft':     return <CraftPage />
      case 'inventory': return <InventoryPage />
      case 'cook':      return <ComingSoon label="🍳 Cook" color="#ff9500" />
      case 'map':       return <ComingSoon label="🗺️ Carte" color="#636e8a" />
    }
  }

  return (
    <>
      <ToastManager />
      {offlineProgress && <OfflineModal progress={offlineProgress} />}
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {renderPage()}
      </AppShell>
    </>
  )
}

function App() {
  const { user, loading, initialize } = useAuthStore()

  // Initialiser la session Supabase au démarrage
  useEffect(() => {
    initialize()
  }, [initialize])

  // Écran de chargement initial (vérification session)
  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '40px' }}>🍖</div>
      </div>
    )
  }

  // Non connecté → page de login
  if (!user) return <AuthPage />

  // Connecté → jeu complet
  return <GameApp />
}

function ComingSoon({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '48px' }}>{label.split(' ')[0]}</div>
      <p style={{ fontSize: '16px', color, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '13px', color: '#636e8a' }}>En construction — prompt suivant</p>
    </div>
  )
}

export default App
```

---

## Architecture globale après ce prompt

```
App.tsx
├── useAuthStore.initialize()     → vérifie session Supabase au démarrage
│
├── [Non connecté] → AuthPage     → signIn / signUp
│
└── [Connecté] → GameApp
    ├── useGameLoop()             → tick 1s (harvest + craft)
    ├── useOfflineProgress()      → calcul offline au chargement
    ├── useSaveManager()          → autosave 30s + beforeunload
    ├── useLoadSave()             → charge Supabase → applique aux stores
    └── AppShell + pages

Flux de sauvegarde :
  Zustand stores (état live)
    ↓ toutes les 30s + beforeunload
  saveService.saveAll(userId)
    ↓ upsert
  Supabase tables (save_inventory / save_harvest / save_craft)

Flux de chargement :
  Login réussi
    ↓
  loadSave(userId) → Supabase SELECT
    ↓
  applyLoadedSave() → setState sur les 3 stores
    ↓
  Jeu démarre avec les données cloud
```

---

## Critères de succès

### Auth
- [ ] `npm run build` passe sans erreur TypeScript
- [ ] La page de login s'affiche au premier chargement (pas de session)
- [ ] Créer un compte → redirection vers le jeu
- [ ] Se déconnecter → retour à la page de login
- [ ] Rafraîchir la page → session restaurée automatiquement (pas besoin de se reconnecter)
- [ ] Message d'erreur précis si email/mot de passe invalide

### Sauvegarde
- [ ] Après login, les données sont chargées depuis Supabase (vérifiable dans les DevTools Zustand)
- [ ] Jouer 30s → vérifier dans Supabase Table Editor que les lignes sont créées / mises à jour
- [ ] Fermer et rouvrir le jeu → les ressources, le camp et les crafts sont restaurés depuis Supabase
- [ ] Si Supabase est inaccessible (réseau coupé) → le jeu continue avec le localStorage sans planter

### Nouveau joueur
- [ ] Premier login → aucune donnée Supabase → localStorage utilisé → jeu démarre normalement
- [ ] Après 30s de jeu → données sauvegardées dans Supabase pour la première fois

### Sécurité
- [ ] Vérifier dans Supabase que Row Level Security est actif sur les 4 tables
- [ ] Un joueur ne peut pas lire/écrire les données d'un autre joueur
- [ ] `.env.local` n'est pas commité dans Git

## Notes pour la suite
- La page Auth est intentionnellement minimaliste — le design sera amélioré plus tard
- `useSaveManager` sauvegarde toutes les 30s. Si le jeu devient plus complexe,
  on pourra réduire à 15s ou ajouter une sauvegarde déclenchée par des événements clés
- La fonction `applyLoadedSave` utilise `setState` directement sur les stores Zustand —
  cela contourne le `persist` middleware mais c'est intentionnel : la source de vérité
  devient Supabase, pas localStorage
- En Phase 4 (social / commerce), on ajoutera des tables Supabase supplémentaires
  pour les échanges inter-joueurs — l'architecture est prête pour ça
