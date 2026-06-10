import { useState, useEffect } from 'react'

export type FieldType = 'text' | 'number' | 'boolean' | 'textarea' | 'select'

export interface FormField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface AdminFormModalProps {
  title: string
  fields: FormField[]
  initialValues?: Record<string, any>
  onSubmit: (values: Record<string, any>) => Promise<void>
  onClose: () => void
}

export function AdminFormModal({
  title, fields, initialValues, onSubmit, onClose,
}: AdminFormModalProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues ?? {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(initialValues ?? {})
  }, [initialValues])

  function setValue(key: string, value: any) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    for (const field of fields) {
      if (field.required && !values[field.key] && values[field.key] !== 0) {
        setError(`Le champ "${field.label}" est requis.`)
        return
      }
    }
    setError(null)
    setLoading(true)
    try {
      await onSubmit(values)
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '480px',
        maxHeight: '85vh', overflowY: 'auto',
      }} onClick={(e) => e.stopPropagation()}>

        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0', marginBottom: '20px' }}>
          {title}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          {fields.map((field) => (
            <div key={field.key}>
              <label style={{ fontSize: '12px', color: '#636e8a', display: 'block', marginBottom: '5px' }}>
                {field.label}{field.required && <span style={{ color: '#ff453a' }}> *</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  style={{
                    width: '100%', background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', color: '#e2e8f0',
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              ) : field.type === 'boolean' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => setValue(field.key, val)}
                      style={{
                        padding: '6px 16px', borderRadius: '6px', cursor: 'pointer',
                        background: values[field.key] === val ? 'rgba(0,210,255,0.15)' : '#0d1117',
                        border: `1px solid ${values[field.key] === val ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: values[field.key] === val ? '#00d2ff' : '#636e8a',
                        fontSize: '13px',
                      }}
                    >
                      {val ? 'Oui' : 'Non'}
                    </button>
                  ))}
                </div>
              ) : field.type === 'select' ? (
                <select
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  style={{
                    width: '100%', background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', color: '#e2e8f0', outline: 'none',
                  }}
                >
                  <option value="">— Choisir —</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValue(
                    field.key,
                    field.type === 'number' ? parseFloat(e.target.value) : e.target.value
                  )}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', background: '#0d1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', color: '#e2e8f0',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,68,58,0.1)', border: '1px solid rgba(255,68,58,0.3)',
            borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
            color: '#ff453a', marginBottom: '14px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', color: '#636e8a', fontSize: '13px', cursor: 'pointer',
          }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '9px 18px',
            background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(0,210,255,0.15)',
            border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(0,210,255,0.4)'}`,
            borderRadius: '8px',
            color: loading ? '#4a5568' : '#00d2ff',
            fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ Sauvegarde...' : '✅ Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
