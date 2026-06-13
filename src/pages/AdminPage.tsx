import { useAuthStore } from '../stores/useAuthStore'
import { AdminLayout } from '../components/admin/AdminLayout'
import { ResourcesAdmin } from './admin/ResourcesAdmin'
import { RegionsAdmin } from './admin/RegionsAdmin'
import { CraftRecipesAdmin } from './admin/CraftRecipesAdmin'
import { CookRecipesAdmin } from './admin/CookRecipesAdmin'
import { MachinesAdmin } from './admin/MachinesAdmin'
import { CreaturesAdmin } from './admin/CreaturesAdmin'
import { MapAdmin } from './admin/MapAdmin'
import { AssetsAdmin } from './admin/AssetsAdmin'
import { AuthPage } from './AuthPage'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined

export function AdminPage() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '13px', color: '#636e8a' }}>⏳ Vérification...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  const isAuthorized = !ADMIN_EMAIL || user.email === ADMIN_EMAIL
  if (!isAuthorized) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ fontSize: '40px' }}>🚫</div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#ff453a' }}>Accès refusé</p>
        <p style={{ fontSize: '13px', color: '#636e8a' }}>Tu n'as pas les droits pour accéder à ce panneau.</p>
        <button
          onClick={() => window.location.href = '/'}
          style={{ marginTop: '8px', padding: '9px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', cursor: 'pointer' }}
        >Retour au jeu</button>
      </div>
    )
  }

  return (
    <AdminLayout>
      {(section) => {
        switch (section) {
          case 'assets':        return <AssetsAdmin />
          case 'regions':       return <RegionsAdmin />
          case 'resources':     return <ResourcesAdmin />
          case 'craft-recipes': return <CraftRecipesAdmin />
          case 'cook-recipes':  return <CookRecipesAdmin />
          case 'machines':      return <MachinesAdmin />
          case 'creatures':     return <CreaturesAdmin />
          case 'map':           return <MapAdmin />
        }
      }}
    </AdminLayout>
  )
}
