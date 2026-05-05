'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { CreditCard, Plus, Search, MoreVertical, Pencil, Trash2, X } from 'lucide-react'
import { createSubscription, updateSubscription, deleteSubscription } from './actions'
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/database'

export type SubRow = {
  id: string
  organization_id: string
  org_name: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  started_at: string
  expires_at: string | null
  monthly_price: number | null
  stripe_subscription_id: string | null
  created_at: string
}

export type OrgOption = { id: string; name: string }

const planColors: Record<SubscriptionPlan, string> = {
  free: 'bg-gray-100 text-gray-600',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

const statusColors: Record<SubscriptionStatus, string> = {
  trial: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
}

const statusLabels: Record<SubscriptionStatus, string> = {
  trial: 'Trial', active: 'Aktívny', expired: 'Vypršal', cancelled: 'Zrušený',
}

const plans: SubscriptionPlan[] = ['free', 'basic', 'pro', 'enterprise']
const statuses: SubscriptionStatus[] = ['trial', 'active', 'expired', 'cancelled']

function Field({ label, name, type = 'text', required, defaultValue, placeholder, children }: {
  label: string; name: string; type?: string; required?: boolean
  defaultValue?: string; placeholder?: string; children?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
      {children ?? (
        <input type={type} name={name} required={required} defaultValue={defaultValue} placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent" />
      )}
    </div>
  )
}

function SubForm({ orgs, sub }: { orgs: OrgOption[]; sub?: SubRow }) {
  return (
    <div className="space-y-3">
      {!sub && (
        <Field label="Organizácia" name="organization_id" required>
          <select name="organization_id" required defaultValue=""
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
            <option value="" disabled>Vyber organizáciu...</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plán" name="plan" required>
          <select name="plan" required defaultValue={sub?.plan ?? 'free'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
            {plans.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status" name="status" required>
          <select name="status" required defaultValue={sub?.status ?? 'trial'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
            {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Začiatok" name="started_at" type="date" required
          defaultValue={sub?.started_at ? sub.started_at.slice(0, 10) : new Date().toISOString().slice(0, 10)} />
        <Field label="Platnosť do" name="expires_at" type="date"
          defaultValue={sub?.expires_at ? sub.expires_at.slice(0, 10) : ''} />
      </div>
      <Field label="Mesačná cena (€)" name="monthly_price" type="number"
        defaultValue={sub?.monthly_price != null ? String(sub.monthly_price) : ''} placeholder="0" />
    </div>
  )
}

export default function BillingClient({ subs, orgs }: { subs: SubRow[]; orgs: OrgOption[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editSub, setEditSub] = useState<SubRow | null>(null)
  const [deleteSub, setDeleteSub] = useState<SubRow | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = subs.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.org_name.toLowerCase().includes(q)
    const matchPlan = planFilter === 'all' || s.plan === planFilter
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchPlan && matchStatus
  })

  const totalMRR = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.monthly_price ?? 0), 0)

  const handleCreate = (formData: FormData) => {
    setCreateError(null)
    startTransition(async () => {
      const result = await createSubscription(formData)
      if (result?.error) setCreateError(result.error)
      else { setCreateOpen(false); router.refresh() }
    })
  }

  const handleEdit = (formData: FormData) => {
    if (!editSub) return
    setEditError(null)
    startTransition(async () => {
      const result = await updateSubscription(editSub.id, formData)
      if (result?.error) setEditError(result.error)
      else { setEditSub(null); router.refresh() }
    })
  }

  const handleDelete = () => {
    if (!deleteSub) return
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteSubscription(deleteSub.id)
      if (result?.error) setDeleteError(result.error)
      else { setDeleteSub(null); router.refresh() }
    })
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Predplatné</h1>
          <p className="text-gray-500 text-sm mt-1">
            {subs.filter(s => s.status === 'active').length} aktívnych · MRR: <strong>{totalMRR.toFixed(2)} €</strong>
          </p>
        </div>
        <button onClick={() => { setCreateError(null); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-orange)' }}>
          <Plus size={16} /> Nové predplatné
        </button>
      </div>

      {/* MRR cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {plans.map(p => {
          const count = subs.filter(s => s.plan === p && s.status === 'active').length
          const mrr = subs.filter(s => s.plan === p && s.status === 'active').reduce((sum, s) => sum + (s.monthly_price ?? 0), 0)
          return (
            <div key={p} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColors[p]}`}>{p}</span>
                <span className="text-lg font-bold text-gray-900">{count}</span>
              </div>
              <p className="text-xs text-gray-400">{mrr.toFixed(0)} € / mes</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Hľadať organizáciu..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="all">Všetky plány</option>
          {plans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="all">Všetky statusy</option>
          {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CreditCard size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{subs.length === 0 ? 'Žiadne predplatné' : 'Žiadne výsledky'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organizácia</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plán</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cena / mes</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Začiatok</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Platnosť do</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.org_name}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColors[s.plan]}`}>{s.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[s.status]}`}>{statusLabels[s.status]}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {s.monthly_price != null ? `${s.monthly_price} €` : '–'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{new Date(s.started_at).toLocaleDateString('sk-SK')}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {s.expires_at ? new Date(s.expires_at).toLocaleDateString('sk-SK') : '∞'}
                  </td>
                  <td className="px-6 py-4">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[140px] z-50" align="end" sideOffset={4}>
                          <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
                            onSelect={() => { setEditError(null); setEditSub(s) }}>
                            <Pencil size={14} /> Upraviť
                          </DropdownMenu.Item>
                          <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
                            onSelect={() => { setDeleteError(null); setDeleteSub(s) }}>
                            <Trash2 size={14} /> Zmazať
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog.Root open={createOpen} onOpenChange={open => { if (!isPending) setCreateOpen(open) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md z-50 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Nové predplatné</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </Dialog.Close>
            </div>
            <form action={handleCreate}>
              <SubForm orgs={orgs} />
              {createError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{createError}</p>}
              <div className="flex gap-3 justify-end mt-5">
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

      {/* Edit Dialog */}
      <Dialog.Root open={!!editSub} onOpenChange={open => { if (!isPending && !open) setEditSub(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md z-50 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Upraviť predplatné</Dialog.Title>
              <button onClick={() => setEditSub(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            {editSub && (
              <form key={editSub.id} action={handleEdit}>
                <p className="text-sm text-gray-500 mb-3 pb-3 border-b border-gray-100">{editSub.org_name}</p>
                <SubForm orgs={orgs} sub={editSub} />
                {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{editError}</p>}
                <div className="flex gap-3 justify-end mt-5">
                  <button type="button" onClick={() => setEditSub(null)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Zrušiť</button>
                  <button type="submit" disabled={isPending}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-orange)' }}>
                    {isPending ? 'Ukladanie…' : 'Uložiť'}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Dialog */}
      <Dialog.Root open={!!deleteSub} onOpenChange={open => { if (!isPending && !open) setDeleteSub(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-sm z-50 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Zmazať predplatné?</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-5">
              Naozaj chceš zmazať predplatné pre <strong className="text-gray-900">{deleteSub?.org_name}</strong>?
            </Dialog.Description>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteSub(null)} disabled={isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Zrušiť</button>
              <button onClick={handleDelete} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {isPending ? 'Mazanie…' : 'Zmazať'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
