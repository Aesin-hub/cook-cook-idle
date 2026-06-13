import { useState, useEffect } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { DataTable } from '../../components/admin/DataTable'
import { AdminFormModal, type FormField } from '../../components/admin/AdminFormModal'
import { SpriteDropdown } from '../../components/admin/SpriteDropdown'
import { assignSprite } from '../../lib/assetService'
import { useToast } from '../../components/shared/ToastManager'
import type { CookRecipe } from '../../types/game'

const COOK_FIELDS: FormField[] = [
  { key: 'id',             label: 'ID (snake_case)',          type: 'text',    required: true, placeholder: 'ex: soupe_champignon' },
  { key: 'name',           label: 'Nom affiché',              type: 'text',    required: true },
  { key: 'emoji',          label: 'Emoji',                    type: 'text',    required: true },
  { key: 'description',    label: 'Description',              type: 'textarea', required: true },
  { key: 'tooltip',        label: 'Tooltip',                  type: 'textarea', required: true },
  { key: 'inspired',       label: 'Inspiré de (Dungeon Meshi)', type: 'text', required: true },
  { key: 'cookTimeSeconds', label: 'Durée de cuisson (s)',    type: 'number',  required: true },
  { key: 'outputPerBatch', label: 'Sorties par batch',        type: 'number',  required: true },
  { key: 'xpReward',       label: 'XP récompense',           type: 'number',  required: true },
  { key: 'unlocked',       label: 'Débloquée',               type: 'boolean', required: true },
  { key: '_productionLine', label: 'Ligne de production (JSON)', type: 'textarea', required: true,
    placeholder: '[{"resourceId":"champignon","perMin":6}]' },
  { key: '_optimalRatio',  label: 'Ratio optimal (JSON)',     type: 'textarea', required: true,
    placeholder: '{"description":"2 fours","ratios":[1,2]}' },
]

function toFormValues(item: CookRecipe): Record<string, any> {
  return {
    ...item,
    _productionLine: JSON.stringify(item.productionLine, null, 2),
    _optimalRatio: JSON.stringify(item.optimalRatio, null, 2),
  }
}

function fromFormValues(v: Record<string, any>): CookRecipe {
  return {
    id: v.id,
    name: v.name,
    emoji: v.emoji,
    description: v.description,
    tooltip: v.tooltip,
    inspired: v.inspired,
    cookTimeSeconds: Number(v.cookTimeSeconds),
    outputPerBatch: Number(v.outputPerBatch),
    xpReward: Number(v.xpReward),
    unlocked: v.unlocked === true,
    productionLine: JSON.parse(v._productionLine),
    optimalRatio: JSON.parse(v._optimalRatio),
  }
}

export function CookRecipesAdmin() {
  const [recipes, setRecipes] = useState<CookRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<CookRecipe | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [spriteId, setSpriteId] = useState<string | null>(null)
  const [spriteChanged, setSpriteChanged] = useState(false)
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAll<CookRecipe>('game_cook_recipes')
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
      await upsertEntry('game_cook_recipes', recipe.id, recipe)
      if (spriteChanged) {
        await assignSprite('game_cook_recipes', recipe.id, spriteId)
        setSpriteChanged(false)
      }
      addToast(`✅ Recette "${recipe.name}" sauvegardée !`, 'success')
      await load()
    } catch (err: any) {
      throw new Error(`JSON invalide : ${err.message}`)
    }
  }

  async function handleDelete(item: CookRecipe) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteEntry('game_cook_recipes', item.id)
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
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>🍳 Recettes Cook</h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>{recipes.length} recette{recipes.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setSpriteId(null); setSpriteChanged(false); setShowForm(true) }}
          style={{ padding: '9px 16px', background: 'rgba(255,149,0,0.15)', border: '1px solid rgba(255,149,0,0.4)', borderRadius: '8px', color: '#ff9500', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >+ Ajouter</button>
      </div>
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <DataTable
          data={recipes}
          loading={loading}
          columns={[
            { key: 'emoji', label: '', width: '40px' },
            { key: 'name', label: 'Nom' },
            { key: 'cookTimeSeconds', label: 'Durée', width: '80px', render: (r) => `${r.cookTimeSeconds}s` },
            { key: 'outputPerBatch', label: 'Batch', width: '60px' },
            { key: 'unlocked', label: 'Débloquée', width: '90px', render: (r) => r.unlocked ? '✅' : '🔒' },
          ]}
          onEdit={(item) => { setEditItem(item); setSpriteId(null); setSpriteChanged(false); setShowForm(true) }}
          onDelete={handleDelete}
        />
      </div>
      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle recette cook'}
          fields={COOK_FIELDS}
          initialValues={editItem ? toFormValues(editItem) : undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        >
          <div>
            <label style={{ fontSize: '12px', color: '#636e8a', display: 'block', marginBottom: '5px' }}>
              Sprite (optionnel)
            </label>
            <SpriteDropdown
              category="dish"
              value={spriteId}
              onChange={(id) => { setSpriteId(id); setSpriteChanged(true) }}
              fallbackEmoji={editItem?.emoji}
            />
          </div>
        </AdminFormModal>
      )}
    </div>
  )
}
