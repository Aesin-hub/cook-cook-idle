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
            {mode === 'login' ? 'Bon retour, aventurier !' : "Rejoins l'aventure !"}
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

        <p style={{ fontSize: '11px', color: '#4a5568', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
          Sans compte, ta progression est sauvegardée localement sur cet appareil uniquement.
        </p>
      </div>
    </div>
  )
}
