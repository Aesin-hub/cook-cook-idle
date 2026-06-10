import { useState, useEffect } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { DataTable } from '../../components/admin/DataTable'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { useToast } from '../../components/shared/ToastManager'
import type { Machine } from '../../types/cook'

const MACHINE_FIELDS: FormField[] = [
  { key: 'id',               label: 'ID (snake_case)',              type: 'text',    required: true, placeholder: 'ex: four_magique' },
  { key: 'name',             label: 'Nom affiché',                  type: 'text',    required: true },
  { key: 'emoji',            label: 'Emoji',                        type: 'text',    required: true },
  { key: 'description',      label: 'Description',                  type: 'textarea', required: true },
  { key: 'tooltip',          label: 'Tooltip',                      type: 'textarea', required: true },
  { key: 'tier',             label: 'Tier (1–5)',                   type: 'number',  required: true },
  { key: 'speedMultiplier',  label: 'Multiplicateur de vitesse',    type: 'number',  required: true, placeholder: 'ex: 1.5' },
  { key: 'efficiencyBonus',  label: 'Bonus efficacité (0–1)',       type: 'number',  required: true, placeholder: 'ex: 0.15' },
  { key: 'unlockLevel',      label: 'Niveau de déblocage',          type: 'number',  required: true },
  { key: 'unlockXp',         label: 'XP requis pour débloquer',     type: 'number',  required: true },
  { key: '_compatibleRecipes', label: 'Recettes compatibles (JSON ou null)', type: 'textarea',
    placeholder: '["soupe_champignon","bouillon_orc"] ou null' },
]

function toFormValues(item: Machine): Record<string, any> {
  return {
    ...item,
    _compatibleRecipes: item.compatibleRecipes === null
      ? 'null'
      : JSON.stringify(item.compatibleRecipes, null, 2),
  }
}

function fromFormValues(v: Record<string, any>): Machine {
  const raw = (v._compatibleRecipes ?? 'null').trim()
  const compatibleRecipes = raw === 'null' || raw === '' ? null : JSON.parse(raw)
  return {
    id: v.id,
    name: v.name,
    emoji: v.emoji,
    description: v.description,
    tooltip: v.tooltip,
    tier: Number(v.tier),
    speedMultiplier: Number(v.speedMultiplier),
    efficiencyBonus: Number(v.efficiencyBonus),
    unlockLevel: Number(v.unlockLevel),
    unlockXp: Number(v.unlockXp),
    compatibleRecipes,
  }
}

export function MachinesAdmin() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Machine | null>(null)
  const [showForm, setShowForm] = useState(false)
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAll<Machine>('game_machines')
      setMachines(data)
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(values: Record<string, any>) {
    try {
      const machine = fromFormValues(values)
      await upsertEntry('game_machines', machine.id, machine)
      addToast(`✅ Machine "${machine.name}" sauvegardée !`, 'success')
      await load()
    } catch (err: any) {
      throw new Error(`JSON invalide : ${err.message}`)
    }
  }

  async function handleDelete(item: Machine) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteEntry('game_machines', item.id)
      addToast(`🗑️ "${item.name}" supprimée.`, 'info')
      await load()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>🔧 Machines</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>{machines.length} machine{machines.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
          style={{ padding: '9px 16px', background: 'rgba(255,213,0,0.12)', border: '1px solid rgba(255,213,0,0.35)', borderRadius: '8px', color: '#ffd500', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >+ Ajouter</button>
      </div>
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <DataTable
          data={machines}
          loading={loading}
          columns={[
            { key: 'emoji', label: '', width: '40px' },
            { key: 'name', label: 'Nom' },
            { key: 'tier', label: 'Tier', width: '55px' },
            { key: 'speedMultiplier', label: 'Vitesse', width: '75px', render: (m) => `×${m.speedMultiplier}` },
            { key: 'efficiencyBonus', label: 'Eff.', width: '60px', render: (m) => m.efficiencyBonus > 0 ? `+${(m.efficiencyBonus * 100).toFixed(0)}%` : '—' },
            { key: 'unlockXp', label: 'XP req.', width: '75px' },
          ]}
          onEdit={(item) => { setEditItem(item); setShowForm(true) }}
          onDelete={handleDelete}
        />
      </div>
      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle machine'}
          fields={MACHINE_FIELDS}
          initialValues={editItem ? toFormValues(editItem) : undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
