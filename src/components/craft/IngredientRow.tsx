import { RESOURCES } from '../../data'
import { useInventoryStore } from '../../stores/useInventoryStore'

interface IngredientRowProps {
  resourceId: string
  required: number
  quantity: number
}

export function IngredientRow({ resourceId, required, quantity }: IngredientRowProps) {
  const amount = useInventoryStore((state) => state.getAmount(resourceId))
  const resource = RESOURCES.find((r) => r.id === resourceId)
  const totalRequired = required * quantity
  const hasEnough = amount >= totalRequired

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '15px' }}>{resource?.emoji ?? '📦'}</span>
        <span style={{ fontSize: '12px', color: '#8b949e' }}>{resource?.name ?? resourceId}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: hasEnough ? '#30d158' : '#ff453a' }}>
          {Math.floor(amount).toLocaleString()}
        </span>
        <span style={{ fontSize: '12px', color: '#4a5568' }}>/</span>
        <span style={{ fontSize: '12px', color: '#636e8a' }}>{totalRequired}</span>
      </div>
    </div>
  )
}
