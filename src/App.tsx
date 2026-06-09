import { useState } from 'react'
import { useGameLoop } from './hooks/useGameLoop'
import { useOfflineProgress } from './hooks/useOfflineProgress'
import { useToast, ToastManager } from './components/shared/ToastManager'
import { OfflineModal } from './components/shared/OfflineModal'
import { AppShell } from './components/layout/AppShell'
import { HarvestPage } from './pages/HarvestPage'
import { CraftPage } from './pages/CraftPage'
import { InventoryPage } from './pages/InventoryPage'
import type { CraftResult } from './types/craft'

type Tab = 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('harvest')
  const addToast = useToast()

  useGameLoop((craftResults: CraftResult[]) => {
    craftResults.forEach((result) => {
      addToast(`${result.recipeEmoji} +${result.output.amount} ${result.recipeName} crafté ! (+${result.xpGained} XP)`, 'success')
    })
  })

  const offlineProgress = useOfflineProgress()

  const renderPage = () => {
    switch (activeTab) {
      case 'harvest':   return <HarvestPage />
      case 'craft':     return <CraftPage />
      case 'cook':      return <ComingSoon label="🍳 Cook" color="#ff9500" />
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
