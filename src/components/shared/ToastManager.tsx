import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  return useToastStore((state) => state.addToast)
}

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#30d158',
  error: '#ff453a',
  info: '#00d2ff',
}

export function ToastManager() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        pointerEvents: 'none',
        width: '90%',
        maxWidth: '360px',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: '#161b22',
            border: `1px solid ${TOAST_COLORS[toast.type]}40`,
            borderLeft: `3px solid ${TOAST_COLORS[toast.type]}`,
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: TOAST_COLORS[toast.type],
            width: '100%',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            animation: 'slideDown 0.2s ease',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
