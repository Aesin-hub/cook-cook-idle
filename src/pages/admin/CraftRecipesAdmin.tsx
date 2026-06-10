import { useState, useEffect } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { DataTable } from '../../components/admin/DataTable'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { useToast } from '../../components/shared/ToastManager'
import type { CraftRecipe } from '../../types/game'

const CRAFT_FIELDS: FormField[] = [
  { key: 'id',               label: 'ID (snake_case)',      type: 'text',    required: true, placeholder: 'ex: pain_elvish' },
  { key: 'name',             label: 'Nom affiché',          type: 'text',    required: true },
  { key: 'emoji',            label: 'Emoji',                type: 'text',    required: true },
  { key: 'description',      label: 'Description',          type: 'textarea', required: true },
  { key: 'tooltip',          label: 'Tooltip',              type: 'textarea', required: true },
  { key: 'craftTimeSeconds', label: 'Durée (secondes)',     type: 'number',  required: true },
  { key: 'xpReward',         label: 'XP récompense',        type: 'number',  required: true },
  { key: 'firstTimeFast',    label: '3s première fois ?',   type: 'boolean', required: true },
  { key: '_inputs',          label: 'Ingrédients (JSON)',   type: 'textarea', required: true,
    placeholder: '[{"resourceId":"farine","quantity":2}]' },
  { key: '_output',          label: 'Sortie (JSON)',        type: 'textarea', required: true,
    placeholder: '{"resourceId":"pain","quantity":1}' },
]

function toFormValues(item: CraftRecipe): Record<string, any> {
  return {
    ...item,
    _inputs: JSON.stringify(item.inputs, null, 2),
    _output: JSON.stringify(item.output, null, 2),
  }
}

function fromFormValues(v: Record<string, any>): CraftRecipe {
  return {
    id: v.id,
    name: v.name,
    emoji: v.emoji,
    description: v.description,
    tooltip: v.tooltip,
    craftTimeSeconds: Number(v.craftTimeSeconds),
    xpReward: Number(v.xpReward),
    firstTimeFast: v.firstTimeFast === true,
    inputs: JSON.parse(v._inputs),
    output: JSON.parse(v._output),
  }
}

export function CraftRecipesAdmin() {
  const [recipes, setRecipes] = useState<CraftRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<CraftRecipe | null>(null)
  const [showForm, setShowForm] = useState(false)
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAll<CraftRecipe>('game_craft_recipes')
      setRecipes(data)
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(values: Record<string, any>) {
    try {
      const recipe = fromFormValues(values)
      await upsertEntry('game_craft_recipes', recipe.id, recipe)
      addToast(`✅ Recette "${recipe.name}" sauvegardée !`, 'success')
      await load()
    } catch (err: any) {
      throw new Error(`JSON invalide : ${err.message}`)
    }
  }

  async function handleDelete(item: CraftRecipe) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteEntry('game_craft_recipes', item.id)
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
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>⚗️ Recettes Craft</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>{recipes.length} recette{recipes.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
          style={{ padding: '9px 16px', background: 'rgba(191,90,242,0.15)', border: '1px solid rgba(191,90,242,0.4)', borderRadius: '8px', color: '#bf5af2', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >+ Ajouter</button>
      </div>
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <DataTable
          data={recipes}
          loading={loading}
          columns={[
            { key: 'emoji', label: '', width: '40px' },
            { key: 'name', label: 'Nom' },
            { key: 'craftTimeSeconds', label: 'Durée', width: '80px', render: (r) => `${r.craftTimeSeconds}s` },
            { key: 'xpReward', label: 'XP', width: '60px' },
            { key: 'firstTimeFast', label: '3s', width: '50px', render: (r) => r.firstTimeFast ? '⚡' : '—' },
          ]}
          onEdit={(item) => { setEditItem(item); setShowForm(true) }}
          onDelete={handleDelete}
        />
      </div>
      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle recette craft'}
          fields={CRAFT_FIELDS}
          initialValues={editItem ? toFormValues(editItem) : undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
