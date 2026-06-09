import { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

interface AppShellProps {
  children: ReactNode
  activeTab: 'harvest' | 'craft' | 'cook' | 'inventory' | 'map'
  onTabChange: (tab: AppShellProps['activeTab']) => void
}

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  return (
    <div style={{ background: '#0d1117', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {children}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}
