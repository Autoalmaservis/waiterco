'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, Pencil, Trash2, X, Shield } from 'lucide-react'
import { ALL_PERMISSIONS } from './permissions'
import { createPosition, updatePosition, deletePosition } from './positions-actions'

export type PositionRow = {
  id: string
  name: string
  color: string
  permissions: string[]
}

const COLORS = ['#6B7280', '#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EF4444']

function PositionDialog({
  position,
  onClose,
  onSaved,
}: {
  position: PositionRow | null
  onClose: () => void
  onSaved: (pos: PositionRow) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(position?.name ?? '')
  const [color, setColor] = useState(position?.color ?? '#6B7280')
  const [perms, setPerms] = useState<string[]>(position?.permissions ?? [])
  const [error, setError] = useState('')

  const toggle = (key: string) =>
    setPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])

  const handleSave = () => {
    if (!name.trim()) { setError('Nazov je povinny'); return }
    startTransition(async () => {
      const data = { name: name.trim(), color, permissions: perms }
      const result = position
        ? await updatePosition(position.id, data)
        : await createPosition(data)
      if (result?.error) { setError(result.error); return }
      onSaved({ id: position?.id ?? crypto.randomUUID(), ...data })
      onClose()
    })
  }

  return (
    <>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md z-50 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <Dialog.Title className="font-semibold text-gray-900">
            {position ? 'Upravit poziciu' : 'Nova pozicia'}
          </Dialog.Title>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nazov pozicie *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="napr. Casnik, Kuchar, Barman..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Farba</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 shrink-0"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : '2px solid transparent',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Povolenia</label>
            <div className="space-y-2">
              {ALL_PERMISSIONS.map(p => {
                const enabled = perms.includes(p.key)
                return (
                  <button key={p.key} type="button" onClick={() => toggle(p.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                      enabled ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${enabled ? 'bg-orange-500' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.label}</p>
                      <p className="text-xs text-gray-400">{p.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Zrusit
          </button>
          <button type="button" onClick={handleSave} disabled={isPending}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-orange)' }}
          >
            {isPending ? 'Ukladam...' : 'Ulozit'}
          </button>
        </div>
      </Dialog.Content>
    </>
  )
}

export default function PositionsManager({ initialPositions }: { initialPositions: PositionRow[] }) {
  const [positions, setPositions] = useState(initialPositions)
  const [editOpen, setEditOpen] = useState(false)
  const [editPos, setEditPos] = useState<PositionRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const openCreate = () => { setEditPos(null); setEditOpen(true) }
  const openEdit = (pos: PositionRow) => { setEditPos(pos); setEditOpen(true) }
  const closeEdit = () => { setEditOpen(false); setEditPos(null) }

  const handleSaved = (pos: PositionRow) => {
    setPositions(prev => {
      const idx = prev.findIndex(p => p.id === pos.id)
      return idx >= 0 ? prev.map(p => p.id === pos.id ? pos : p) : [...prev, pos]
    })
  }

  const handleDelete = () => {
    if (!deleteId) return
    startTransition(async () => {
      await deletePosition(deleteId)
      setPositions(prev => prev.filter(p => p.id !== deleteId))
      setDeleteId(null)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{positions.length} pozicii</p>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-orange)' }}
        >
          <Plus size={16} />Nova pozicia
        </button>
      </div>

      {positions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Shield size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">Zatial ziadne pozicie</p>
          <p className="text-xs text-gray-300 mt-1">Vytvorte prvu poziciu a priradte jej povolenia</p>
        </div>
      ) : (
        <div className="space-y-2">
          {positions.map(pos => (
            <div key={pos.id} className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pos.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{pos.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {pos.permissions.length === 0 ? (
                    <span className="text-xs text-gray-300">Ziadne povolenia</span>
                  ) : pos.permissions.map(perm => {
                    const def = ALL_PERMISSIONS.find(p => p.key === perm)
                    return def ? (
                      <span key={perm} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {def.label}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
              <button onClick={() => openEdit(pos)}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => setDeleteId(pos.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={editOpen} onOpenChange={o => { if (!o) closeEdit() }}>
        <Dialog.Portal>
          {editOpen && <PositionDialog position={editPos} onClose={closeEdit} onSaved={handleSaved} />}
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-sm z-50 p-6">
            <Dialog.Title className="font-semibold text-gray-900 mb-2">Odstranit poziciu?</Dialog.Title>
            <p className="text-sm text-gray-500 mb-6">Zamestnanci s touto poziciu stratia priradene povolenia.</p>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm text-gray-600">Zrusit</button>
              </Dialog.Close>
              <button onClick={handleDelete} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {isPending ? 'Odstranujem...' : 'Odstranit'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
