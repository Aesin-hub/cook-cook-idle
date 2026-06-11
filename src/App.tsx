import { useEffect, useState } from 'react'
import { useGameLoop } from './hooks/useGameLoop'
import { DEFAULT_HARVEST_MULTIPLIERS } from './types/map'
import { useOfflineProgress } from './hooks/useOfflineProgress'
import { useSaveManager } from './hooks/useSaveManager'
import { useLoadSave } from './hooks/useLoadSave'
import { useGameData } from './hooks/useGameData'
import { useAuthStore } from './stores/useAuthStore'
import { useToast, ToastManager } from './components/shared/ToastManager'
import { OfflineModal } from './components/shared/OfflineModal'
import { AppShell } from './components/layout/AppShell'
import { HarvestPage } from './pages/HarvestPage'
import { CraftPage } from './pages/CraftPage'
import { InventoryPage } from './pages/InventoryPage'
import { CookPage } from './pages/CookPage'
import { AuthPage } from './pages/AuthPage'
import { AdminPage } from './pages/AdminPage'
import type { CraftResult } from './types/craft'
import type { ProductionResult } from './types/cook'

type Tab = 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'

function GameApp() {
  const [activeTab, setActiveTab] = useState<Tab>('harvest')
  const addToast = useToast()

  useGameLoop(
    (craftResults: CraftResult[]) => {
      craftResults.forEach((result) => {
        addToast(`${result.recipeEmoji} +${result.output.amount} ${result.recipeName} crafté ! (+${result.xpGained} XP)`, 'success')
      })
    },
    (cookResults: ProductionResult[]) => {
      cookResults.forEach((result) => {
        if (result.amount >= 0.5) {
          addToast(`${result.outputEmoji} +${Math.floor(result.amount)} ${result.outputName} cuisiné ! (+${result.xpGained} XP)`, 'success')
        }
      })
    },
    (message: string) => {
      addToast(`🍳 ${message}`, 'success')
    },
    // Phase 3 — sera remplacé par usePlayerStore.getHarvestMultipliers() au prompt 014
    DEFAULT_HARVEST_MULTIPLIERS
  )

  const offlineProgress = useOfflineProgress()
  useSaveManager()
  const loadStatus = useLoadSave()

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
      case 'cook':      return <CookPage />
      case 'inventory': return <InventoryPage />
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
  const { loaded: gameDataLoaded } = useGameData()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Route /admin — avant tout check auth
  const isAdminRoute = window.location.pathname === '/admin'
  if (isAdminRoute) {
    return (
      <>
        <ToastManager />
        <AdminPage />
      </>
    )
  }

  if (loading || !gameDataLoaded) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '8px',
      }}>
        <div style={{ fontSize: '40px' }}>🍖</div>
        <p style={{ fontSize: '13px', color: '#636e8a' }}>
          {!gameDataLoaded ? 'Chargement des données du jeu...' : 'Vérification de la session...'}
        </p>
      </div>
    )
  }

  if (!user) return <AuthPage />

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
