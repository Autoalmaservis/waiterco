'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Building2, Search, Plus, X } from 'lucide-react'
import { toggleVenueActive, createVenueForOrg } from './actions'
import type { VenueAdminRow } from './page'

const typeLabels: Record<string, string> = {
  restaurant: 'Reštaurácia', bar: 'Bar', hotel: 'Hotel', cafe: 'Kaviareň',
}

const typeColors: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-700',
  bar: 'bg-purple-100 text-purple-700',
  hotel: 'bg-blue-100 text-blue-700',
  cafe: 'bg-amber-100 text-amber-700',
}

export default function VenuesAdminClient({ venues, orgs }: { venues: VenueAdminRow[]; orgs: { id: string; name: string }[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const filtered = venues.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.org_name.toLowerCase().includes(q) || !!v.city?.toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || v.type === typeFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? v.is_active : !v.is_active)
    return matchSearch && matchType && matchStatus
  })

  const handleCreate = (formData: FormData) => {
    setCreateError(null)
    startTransition(async () => {
      const result = await createVenueForOrg(formData)
      if (result?.error) setCreateError(result.error)
      else { setCreateOpen(false); router.refresh() }
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleVenueActive(id, !current)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prevádzky</h1>
          <p className="text-gray-500 text-sm mt-1">{venues.length} prevádzok na platforme · {venues.filter(v => v.is_active).length} aktívnych</p>
        </div>
        <button
          onClick={() => { setCreateError(null); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-orange)' }}
        >
          <Plus size={16} />
          Nová prevádzka
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Hľadať podľa názvu, org, mesta..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="all">Všetky typy</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="all">Všetky statusy</option>
          <option value="active">Aktívna</option>
          <option value="inactive">Neaktívna</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Building2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{venues.length === 0 ? 'Žiadne prevádzky' : 'Žiadne výsledky'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prevádzka</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organizácia</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Typ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Mesto</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Otvorená</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Aktívna</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vytvorená</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 text-sm">{v.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{v.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/super-admin/organizations/${v.organization_id}`}
                      className="text-sm text-gray-700 hover:underline">
                      {v.org_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[v.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[v.type] ?? v.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.city ?? '–'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {v.is_open ? 'Otvorená' : 'Zatvorená'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggle(v.id, v.is_active)}
                      disabled={isPending}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${v.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${v.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{new Date(v.created_at).toLocaleDateString('sk-SK')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog.Root open={createOpen} onOpenChange={open => { if (!isPending) setCreateOpen(open) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md z-50 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Nová prevádzka</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </Dialog.Close>
            </div>
            <form action={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Organizácia *</label>
                <select name="organization_id" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
                  <option value="">Vyber organizáciu...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Názov prevádzky *</label>
                <input name="name" required placeholder="Reštaurácia Koliba"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
                <select name="type"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
                  <option value="restaurant">Reštaurácia</option>
                  <option value="bar">Bar</option>
                  <option value="cafe">Kaviareň</option>
                  <option value="hotel">Hotel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mesto</label>
                <input name="city" placeholder="Bratislava"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
              {createError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>}
              <div className="flex gap-3 justify-end pt-1">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Zrušiť</button>
                </Dialog.Close>
                <button type="submit" disabled={isPending}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-orange)' }}>
                  {isPending ? 'Vytváranie…' : 'Vytvoriť'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
