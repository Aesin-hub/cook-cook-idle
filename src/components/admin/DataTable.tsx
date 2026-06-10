import type { ReactNode } from 'react'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  width?: string
}

interface DataTableProps<T extends { id: string }> {
  data: T[]
  columns: Column<T>[]
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  loading?: boolean
}

export function DataTable<T extends { id: string }>({
  data, columns, onEdit, onDelete, loading
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
        ⏳ Chargement...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#636e8a' }}>
        Aucune entrée. Clique sur "Ajouter" pour commencer.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {columns.map((col) => (
              <th key={String(col.key)} style={{
                padding: '10px 12px', textAlign: 'left',
                fontSize: '11px', fontWeight: 500,
                color: '#636e8a', textTransform: 'uppercase', letterSpacing: '0.08em',
                width: col.width,
              }}>
                {col.label}
              </th>
            ))}
            <th style={{ padding: '10px 12px', width: '100px' }} />
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              {columns.map((col) => (
                <td key={String(col.key)} style={{ padding: '10px 12px', fontSize: '13px', color: '#e2e8f0' }}>
                  {col.render
                    ? col.render(item)
                    : String((item as any)[col.key] ?? '—')}
                </td>
              ))}
              <td style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => onEdit(item)}
                    style={{
                      padding: '4px 10px', fontSize: '11px',
                      background: 'rgba(0,210,255,0.08)',
                      border: '1px solid rgba(0,210,255,0.2)',
                      borderRadius: '6px', color: '#00d2ff', cursor: 'pointer',
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    style={{
                      padding: '4px 10px', fontSize: '11px',
                      background: 'rgba(255,68,58,0.08)',
                      border: '1px solid rgba(255,68,58,0.2)',
                      borderRadius: '6px', color: '#ff453a', cursor: 'pointer',
                    }}
                  >
                    Suppr.
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
