# Prompt 013 — Admin Panel

## Contexte
Projet : **Cooking Fantasy** — jeu idle / crafting / gestion en heroic fantasy.
Les prompts 001 à 012 ont été exécutés. Phase 2.5.

Structure existante pertinente :
- `src/lib/supabase.ts` — client Supabase
- `src/stores/useAuthStore.ts` — auth (signIn, user, session)
- `src/stores/useGameDataStore.ts` — données de jeu (depuis Supabase)
- Tables Supabase : `game_regions`, `game_resources`, `game_craft_recipes`,
  `game_cook_recipes`, `game_machines`, `game_furnace_levels`
- Design system : fond `#0d1117`, accents néon, composants existants

## Objectif
Créer une interface d'administration protégée permettant de gérer
toutes les données du jeu (régions, ressources, recettes, machines)
**sans toucher au code ni redéployer**.

Accessible uniquement via `/admin` avec un email admin défini.
Les modifications sont **live immédiatement** pour tous les joueurs.

## Décisions d'architecture

### Protection de la route admin
- L'email admin est défini dans `.env.local` : `VITE_ADMIN_EMAIL=ton@email.com`
- Si l'utilisateur connecté n'est pas l'admin → redirection vers le jeu
- Pas de système de rôles complexe pour le MVP — juste une comparaison d'email

### Navigation admin
5 sections, une par type de donnée :
Régions / Ressources / Recettes Craft / Recettes Cook / Machines

### Pattern CRUD pour chaque section
- **Liste** : tableau de toutes les entrées avec boutons Modifier / Supprimer
- **Formulaire** : modal avec les champs de l'entrée (pré-rempli en édition)
- **Validation** : vérification des champs requis avant envoi
- **Feedback** : toast succès / erreur après chaque opération

### Sécurité Supabase
Après ce prompt, remplacer les policies "Auth write" du prompt 012
par des policies "Admin email only" :

```sql
-- Supprimer les policies d'écriture ouvertes
DROP POLICY IF EXISTS "Auth write regions" ON game_regions;
DROP POLICY IF EXISTS "Auth write resources" ON game_resources;
DROP POLICY IF EXISTS "Auth write craft recipes" ON game_craft_recipes;
DROP POLICY IF EXISTS "Auth write cook recipes" ON game_cook_recipes;
DROP POLICY IF EXISTS "Auth write machines" ON game_machines;
DROP POLICY IF EXISTS "Auth write furnace levels" ON game_furnace_levels;

-- Remplacer par des policies admin uniquement
-- Remplace 'VOTRE_EMAIL_ADMIN@email.com' par ton vrai email
CREATE POLICY "Admin write regions" ON game_regions FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Admin write resources" ON game_resources FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Admin write craft recipes" ON game_craft_recipes FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Admin write cook recipes" ON game_cook_recipes FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Admin write machines" ON game_machines FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
CREATE POLICY "Admin write furnace levels" ON game_furnace_levels FOR ALL
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

-- Définir l'email admin dans la config Supabase
ALTER DATABASE postgres SET app.admin_email = 'VOTRE_EMAIL_ADMIN@email.com';
```

---

## Fichiers à créer

---

### `src/lib/adminService.ts`

Service d'accès aux données admin. Toutes les opérations CRUD Supabase sont ici.

```typescript
import { supabase } from './supabase'

type TableName =
  | 'game_regions'
  | 'game_resources'
  | 'game_craft_recipes'
  | 'game_cook_recipes'
  | 'game_machines'
  | 'game_furnace_levels'

// ─── LECTURE ──────────────────────────────────────────────────────────────────

export async function fetchAll<T>(table: TableName): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, data, updated_at')
    .order('id')
  if (error) throw new Error(`[Admin] fetchAll ${table}: ${error.message}`)
  return data.map((row) => ({ ...row.data, _updatedAt: row.updated_at })) as T[]
}

// ─── CRÉATION ─────────────────────────────────────────────────────────────────

export async function createEntry(table: TableName, id: string, data: object): Promise<void> {
  const { error } = await supabase
    .from(table)
    .insert({ id, data, updated_at: new Date().toISOString() })
  if (error) throw new Error(`[Admin] create ${table}: ${error.message}`)
}

// ─── MISE À JOUR ──────────────────────────────────────────────────────────────

export async function updateEntry(table: TableName, id: string, data: object): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[Admin] update ${table}: ${error.message}`)
}

// ─── SUPPRESSION ──────────────────────────────────────────────────────────────

export async function deleteEntry(table: TableName, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
  if (error) throw new Error(`[Admin] delete ${table}: ${error.message}`)
}

// ─── UPSERT (création ou mise à jour) ────────────────────────────────────────

export async function upsertEntry(table: TableName, id: string, data: object): Promise<void> {
  const { error } = await supabase
    .from(table)
    .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw new Error(`[Admin] upsert ${table}: ${error.message}`)
}
```

---

### `src/components/admin/AdminLayout.tsx`

Layout de l'admin panel. Sidebar de navigation + zone de contenu.

```tsx
import { useState, ReactNode } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'

type AdminSection =
  | 'regions'
  | 'resources'
  | 'craft-recipes'
  | 'cook-recipes'
  | 'machines'

const SECTIONS: { id: AdminSection; label: string; emoji: string }[] = [
  { id: 'regions',       label: 'Régions',         emoji: '🗺️' },
  { id: 'resources',     label: 'Ressources',       emoji: '🌿' },
  { id: 'craft-recipes', label: 'Recettes Craft',   emoji: '⚗️' },
  { id: 'cook-recipes',  label: 'Recettes Cook',    emoji: '🍳' },
  { id: 'machines',      label: 'Machines',         emoji: '🔧' },
]

interface AdminLayoutProps {
  children: (section: AdminSection) => ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('resources')
  const { signOut, user } = useAuthStore()

  return (
    <div style={{ minHeight: '100dvh', background: '#0d1117', display: 'flex' }}>

      {/* Sidebar */}
      <div style={{
        width: '220px', background: '#161b22',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 0',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>🍖</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>Admin Panel</div>
          <div style={{ fontSize: '11px', color: '#636e8a', marginTop: '2px' }}>Cooking Fantasy</div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '8px',
                  background: isActive ? 'rgba(0,210,255,0.1)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(0,210,255,0.2)' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left', marginBottom: '2px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{s.emoji}</span>
                <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? '#00d2ff' : '#8b949e' }}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Footer : user + déconnexion */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: '#636e8a', marginBottom: '8px', wordBreak: 'break-all' }}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '7px',
              background: 'rgba(255,68,58,0.08)',
              border: '1px solid rgba(255,68,58,0.2)',
              borderRadius: '6px', color: '#ff453a',
              fontSize: '12px', cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {children(activeSection)}
      </main>
    </div>
  )
}
```

---

### `src/components/admin/DataTable.tsx`

Tableau générique réutilisable pour toutes les sections.
Affiche les entrées avec colonnes configurables + boutons Modifier / Supprimer.

```tsx
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

import { ReactNode } from 'react'

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
```

---

### `src/components/admin/AdminFormModal.tsx`

Modal générique pour les formulaires d'ajout / modification.
Génère automatiquement les champs selon le schéma fourni.

```tsx
import { useState, useEffect } from 'react'

export type FieldType = 'text' | 'number' | 'boolean' | 'textarea' | 'select'

export interface FormField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]  // pour type 'select'
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
    // Validation des champs requis
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
```

---

### `src/pages/admin/ResourcesAdmin.tsx`

Section admin pour gérer les ressources. Référence pour toutes les autres sections.

```tsx
import { useState, useEffect } from 'react'
import { fetchAll, upsertEntry, deleteEntry } from '../../lib/adminService'
import { DataTable } from '../../components/admin/DataTable'
import { AdminFormModal, FormField } from '../../components/admin/AdminFormModal'
import { useToast } from '../../components/shared/ToastManager'
import type { Resource } from '../../types/game'

const RESOURCE_FIELDS: FormField[] = [
  { key: 'id',            label: 'ID (snake_case)',   type: 'text',    required: true, placeholder: 'ex: herbe_magique' },
  { key: 'name',          label: 'Nom affiché',       type: 'text',    required: true, placeholder: 'ex: Herbe Magique' },
  { key: 'emoji',         label: 'Emoji',             type: 'text',    required: true, placeholder: 'ex: 🌿' },
  { key: 'region',        label: 'Région',            type: 'select',  required: true,
    options: [
      { value: 'foret',   label: '🌲 Forêt' },
      { value: 'caverne', label: '⛰️ Caverne' },
      { value: 'marais',  label: '🌿 Marais' },
      { value: 'plaine',  label: '🌾 Plaine' },
    ]
  },
  { key: 'rarity',        label: 'Rareté (code)',     type: 'select',  required: true,
    options: [
      { value: 'common',   label: 'Commun' },
      { value: 'uncommon', label: 'Peu commun' },
      { value: 'rare',     label: 'Rare' },
      { value: 'epic',     label: 'Épique' },
    ]
  },
  { key: 'rarityLabel',      label: 'Rareté (affiché)', type: 'text',    required: true, placeholder: 'ex: Commun' },
  { key: 'baseYieldPerMin',  label: 'Production/min',   type: 'number',  required: true },
  { key: 'tooltip',          label: 'Tooltip (1 phrase)', type: 'textarea', required: true },
]

export function ResourcesAdmin() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<Resource | null>(null)
  const [showForm, setShowForm] = useState(false)
  const addToast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAll<Resource>('game_resources')
      setResources(data)
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(values: Record<string, any>) {
    await upsertEntry('game_resources', values.id, values)
    addToast(`✅ Ressource "${values.name}" sauvegardée !`, 'success')
    await load()
  }

  async function handleDelete(item: Resource) {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return
    try {
      await deleteEntry('game_resources', item.id)
      addToast(`🗑️ "${item.name}" supprimée.`, 'info')
      await load()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            🌿 Ressources
          </h1>
          <p style={{ fontSize: '12px', color: '#636e8a', margin: '4px 0 0' }}>
            {resources.length} ressource{resources.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true) }}
          style={{
            padding: '9px 16px', background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.4)',
            borderRadius: '8px', color: '#00d2ff',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Ajouter
        </button>
      </div>

      {/* Tableau */}
      <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <DataTable
          data={resources}
          loading={loading}
          columns={[
            { key: 'emoji', label: '', width: '40px' },
            { key: 'name', label: 'Nom' },
            { key: 'region', label: 'Région', width: '100px' },
            { key: 'rarityLabel', label: 'Rareté', width: '120px' },
            { key: 'baseYieldPerMin', label: '/min', width: '60px' },
          ]}
          onEdit={(item) => { setEditItem(item); setShowForm(true) }}
          onDelete={handleDelete}
        />
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <AdminFormModal
          title={editItem ? `Modifier : ${editItem.name}` : 'Nouvelle ressource'}
          fields={RESOURCE_FIELDS}
          initialValues={editItem ?? undefined}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
```

---

### `src/pages/AdminPage.tsx`

Page principale admin. Vérifie que l'utilisateur est bien l'admin,
puis affiche le layout avec les sections.

```tsx
import { useAuthStore } from '../stores/useAuthStore'
import { AdminLayout } from '../components/admin/AdminLayout'
import { ResourcesAdmin } from './admin/ResourcesAdmin'
import { useToast } from '../components/shared/ToastManager'
import { useEffect } from 'react'

// Les autres sections (Régions, Recettes Craft, Cook, Machines) suivent
// exactement le même pattern que ResourcesAdmin.
// Claude Code doit créer les 4 fichiers suivants sur le même modèle :
// - src/pages/admin/RegionsAdmin.tsx
// - src/pages/admin/CraftRecipesAdmin.tsx
// - src/pages/admin/CookRecipesAdmin.tsx
// - src/pages/admin/MachinesAdmin.tsx
// En adaptant les FIELDS et la table Supabase correspondante.

export function AdminPage() {
  const user = useAuthStore((state) => state.user)
  const addToast = useToast()

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin = user?.email === adminEmail

  useEffect(() => {
    if (user && !isAdmin) {
      addToast('Accès refusé — zone admin réservée.', 'error')
    }
  }, [user, isAdmin])

  // Non connecté ou pas admin
  if (!user || !isAdmin) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e2e8f0' }}>Accès refusé</h1>
        <p style={{ fontSize: '13px', color: '#636e8a' }}>
          Cette zone est réservée à l'administrateur du jeu.
        </p>
      </div>
    )
  }

  return (
    <AdminLayout>
      {(section) => {
        switch (section) {
          case 'resources':     return <ResourcesAdmin />
          case 'regions':       return <div style={{ color: '#e2e8f0' }}>RegionsAdmin — à créer sur le modèle ResourcesAdmin</div>
          case 'craft-recipes': return <div style={{ color: '#e2e8f0' }}>CraftRecipesAdmin — à créer sur le modèle ResourcesAdmin</div>
          case 'cook-recipes':  return <div style={{ color: '#e2e8f0' }}>CookRecipesAdmin — à créer sur le modèle ResourcesAdmin</div>
          case 'machines':      return <div style={{ color: '#e2e8f0' }}>MachinesAdmin — à créer sur le modèle ResourcesAdmin</div>
        }
      }}
    </AdminLayout>
  )
}
```

---

### Mise à jour `src/App.tsx`

Ajouter la route `/admin` et le `VITE_ADMIN_EMAIL` check.

```tsx
// Ajouter l'import :
import { AdminPage } from './pages/AdminPage'

// Dans App(), AVANT le check user, ajouter :
// Détection de la route /admin
const isAdminRoute = window.location.pathname === '/admin'
if (isAdminRoute) {
  return (
    <>
      <ToastManager />
      <AdminPage />
    </>
  )
}
```

### Mise à jour `.env.local`

Ajouter la variable admin :
```
VITE_ADMIN_EMAIL=ton@email.com
```

---

## Instructions pour les sections manquantes

Claude Code doit créer les 4 fichiers suivants **sur le modèle exact de `ResourcesAdmin.tsx`** :

### `RegionsAdmin.tsx` — fields :
`id`, `name`, `emoji`, `unlocked` (boolean), `description`, `tooltip`, `unlockCondition`

### `CraftRecipesAdmin.tsx` — fields :
`id`, `name`, `emoji`, `description`, `tooltip`, `craftTimeSeconds` (number),
`firstTimeFast` (boolean), `xpReward` (number)
Note : les `inputs` et `output` sont complexes (tableaux) — afficher en textarea JSON
pour le MVP admin.

### `CookRecipesAdmin.tsx` — fields :
`id`, `name`, `emoji`, `description`, `tooltip`, `cookTimeSeconds` (number),
`outputPerBatch` (number), `xpReward` (number), `unlocked` (boolean), `inspired`
Note : `productionLine` et `optimalRatio` en textarea JSON pour le MVP.

### `MachinesAdmin.tsx` — fields :
`id`, `name`, `emoji`, `description`, `tooltip`, `tier` (number),
`speedMultiplier` (number), `efficiencyBonus` (number), `unlockLevel` (number), `unlockXp` (number)
Note : `compatibleRecipes` en textarea JSON (null ou tableau d'IDs).

---

## Critères de succès

### Accès
- [ ] Aller sur `/admin` sans être connecté → page "Accès refusé"
- [ ] Se connecter avec un autre compte → page "Accès refusé"
- [ ] Se connecter avec l'email `VITE_ADMIN_EMAIL` → admin panel accessible

### Ressources
- [ ] La liste des ressources s'affiche avec les données Supabase
- [ ] "Ajouter" → modal → remplir les champs → Sauvegarder → nouvelle ressource dans le tableau
- [ ] "Modifier" → modal pré-remplie → changer un champ → Sauvegarder → mis à jour
- [ ] "Supprimer" → confirmation → ressource supprimée du tableau
- [ ] Les 4 autres sections (Régions, Craft, Cook, Machines) fonctionnent sur le même modèle

### Live update
- [ ] Ajouter une ressource dans l'admin, recharger le jeu → nouvelle ressource visible dans l'inventaire
- [ ] Modifier le `baseYieldPerMin` d'une ressource → yield mis à jour après rechargement

### Sécurité
- [ ] `VITE_ADMIN_EMAIL` défini dans `.env.local` (jamais en dur dans le code)
- [ ] Le script SQL de restriction admin a été exécuté dans Supabase

## Notes pour la suite
- Les champs complexes (inputs, productionLine, compatibleRecipes) sont en textarea JSON
  pour le MVP. En Phase 3, on pourra construire des éditeurs spécialisés (builder de recette,
  éditeur de ligne de production visuel).
- L'admin panel n'a pas de système de preview — les changements sont directs en production.
  En Phase 3, ajouter un environnement "staging" si nécessaire.
- Quand on ajoute une nouvelle région via l'admin, il faudra toujours mettre à jour
  `RegionId` dans `src/types/game.ts` — noter ce point dans le guide du game designer.
