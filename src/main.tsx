import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  import('./lib/seedGameData').then(({ seedGameData }) => {
    ;(window as any).seedGameData = seedGameData
    console.log('[Dev] seedGameData() disponible dans la console')
  })
  import('./stores/usePlayerStore').then(({ usePlayerStore }) => {
    ;(window as any).debugClass = (classId: string, level: number) =>
      usePlayerStore.getState().debugSetClassLevel(classId as any, level)
    console.log('[Dev] debugClass(classId, level) disponible dans la console')
  })
}
