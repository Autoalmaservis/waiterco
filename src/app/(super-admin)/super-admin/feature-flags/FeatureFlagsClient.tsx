'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb, Plus, Trash2, Check } from 'lucide-react'
import { toggleFeatureFlag, createFeatureFlag, deleteFeatureFlag } from './actions'
import type { FlagRow } from './page'

function CreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createFeatureFlag(formData)
      if (result?.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Novy plan / funkcia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form action={handleCreate} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Nazov <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              autoFocus
              placeholder="napr. Online platby, Rezervacie stolov..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Popis — co ma tato funkcia robit
            </label>
            <textarea
              name="description"
              rows={5}
              placeholder="Opiste co chces implementovat, ako by to malo fungovat, pre koho je to urcene..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Zrusit
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {isPending ? 'Ukladam...' : 'Ulozit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FeatureFlagsClient({ flags: initial }: { flags: FlagRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [flags, setFlags] = useState(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleToggle = (id: string, current: boolean) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, is_enabled: !current } : f))
    startTransition(async () => {
      await toggleFeatureFlag(id, !current)
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteFeatureFlag(id)
      setFlags(prev => prev.filter(f => f.id !== id))
      setDeleteId(null)
    })
  }

  const doneCount = flags.filter(f => f.is_enabled).length
  const pendingCount = flags.filter(f => !f.is_enabled).length

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Planner</h1>
          <p className="text-gray-500 text-sm mt-1">
            {flags.length} planov ·{' '}
            <span className="text-orange-600 font-medium">{pendingCount} caka</span>
            {doneCount > 0 && (
              <> · <span className="text-teal-600 font-medium">{doneCount} hotovych</span></>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-orange)' }}
        >
          <Plus size={16} />Novy plan
        </button>
      </div>

      {flags.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-20 text-gray-400">
          <Lightbulb size={36} className="mb-3 opacity-20" />
          <p className="text-sm font-medium">Ziadne plany</p>
          <p className="text-xs mt-1">Klikni na "Novy plan" a pridaj prvu funkciu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pending */}
          {flags.filter(f => !f.is_enabled).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Planuje sa</p>
              <div className="space-y-2">
                {flags.filter(f => !f.is_enabled).map(f => (
                  <FlagCard
                    key={f.id}
                    flag={f}
                    expanded={expanded === f.id}
                    onExpand={() => setExpanded(expanded === f.id ? null : f.id)}
                    onToggle={() => handleToggle(f.id, f.is_enabled)}
                    onDelete={() => setDeleteId(f.id)}
                    isPending={isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {flags.filter(f => f.is_enabled).length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Hotove</p>
              <div className="space-y-2">
                {flags.filter(f => f.is_enabled).map(f => (
                  <FlagCard
                    key={f.id}
                    flag={f}
                    expanded={expanded === f.id}
                    onExpand={() => setExpanded(expanded === f.id ? null : f.id)}
                    onToggle={() => handleToggle(f.id, f.is_enabled)}
                    onDelete={() => setDeleteId(f.id)}
                    isPending={isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Odstranit plan?</h3>
            <p className="text-sm text-gray-500 mb-6">Tato akcia sa neda vratit.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600">Zrusit</button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? 'Odstranujem...' : 'Odstranit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FlagCard({
  flag, expanded, onExpand, onToggle, onDelete, isPending,
}: {
  flag: FlagRow
  expanded: boolean
  onExpand: () => void
  onToggle: () => void
  onDelete: () => void
  isPending: boolean
}) {
  const done = flag.is_enabled
  return (
    <div className={`bg-white rounded-xl border transition-all ${done ? 'border-teal-100 opacity-70' : 'border-gray-100 hover:border-gray-200'}`}>
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Done checkbox */}
        <button
          onClick={onToggle}
          disabled={isPending}
          title={done ? 'Oznacit ako nehotove' : 'Oznacit ako hotove'}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all disabled:opacity-50 ${
            done
              ? 'border-teal-500 bg-teal-500'
              : 'border-gray-300 hover:border-teal-400'
          }`}
        >
          {done && <Check size={12} color="white" strokeWidth={3} />}
        </button>

        {/* Title + date */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
          <p className={`text-sm font-semibold truncate ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {flag.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
          {!expanded && flag.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{flag.description}</p>
          )}
        </div>

        <span className="text-xs text-gray-400 shrink-0">
          {new Date(flag.updated_at).toLocaleDateString('sk-SK')}
        </span>

        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Expanded description */}
      {expanded && flag.description && (
        <div className="px-5 pb-4">
          <div className="border-t border-gray-50 pt-3">
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{flag.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}
