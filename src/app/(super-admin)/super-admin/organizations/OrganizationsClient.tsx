'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Building2, Plus, Search, MoreVertical, Pencil, Trash2, X, ExternalLink, LogIn } from 'lucide-react'
import { createOrganization, updateOrganization, deleteOrganization } from './actions'
import { enterOrgPreview } from './preview-actions'
import type { OrgRow } from './page'

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

const statusColors: Record<string, string> = {
  trial: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
}

const statusLabels: Record<string, string> = {
  trial: 'Trial',
  active: 'Aktívny',
  expired: 'Vypršal',
  cancelled: 'Zrušený',
}

// ── Reusable field components ────────────────────────────────────────────────

function Field({ label, name, type = 'text', required, defaultValue, placeholder }: {
  label: string; name: string; type?: string
  required?: boolean; defaultValue?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
      <input
        type={type} name={name} required={required}
        defaultValue={defaultValue} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">{children}</p>
}

// ── Org form fields (reused in create + edit) ────────────────────────────────

function OrgFormFields({ org }: { org?: OrgRow }) {
  return (
    <div className="space-y-3">
      <SectionTitle>Základné údaje</SectionTitle>
      <Field label="Názov organizácie" name="name" required defaultValue={org?.name} placeholder="Reštaurácia Koliba" />
      <Field label="Logo URL" name="logo_url" type="url" defaultValue={org?.logo_url ?? ''} placeholder="https://..." />
      {!org && (
        <Field label="Email vlastníka (restaurant_admin)" name="owner_email" type="email" placeholder="admin@restauracia.sk" />
      )}

      <SectionTitle>Fakturačné a právne údaje</SectionTitle>
      <Field label="Fakturačný email" name="billing_email" type="email" defaultValue={org?.billing_email ?? ''} placeholder="billing@firma.sk" />
      <div className="grid grid-cols-3 gap-2">
        <Field label="IČO" name="ico" defaultValue={org?.ico ?? ''} placeholder="12345678" />
        <Field label="DIČ" name="dic" defaultValue={org?.dic ?? ''} placeholder="2012345678" />
        <Field label="IČ DPH" name="ic_dph" defaultValue={org?.ic_dph ?? ''} placeholder="SK2012345678" />
      </div>

      <SectionTitle>Adresa</SectionTitle>
      <Field label="Ulica a číslo" name="street" defaultValue={org?.street ?? ''} placeholder="Hlavná 12" />
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Mesto" name="city" defaultValue={org?.city ?? ''} placeholder="Bratislava" />
        </div>
        <Field label="PSČ" name="postal_code" defaultValue={org?.postal_code ?? ''} placeholder="81101" />
      </div>
      <Field label="Krajina" name="country" defaultValue={org?.country ?? 'SK'} placeholder="SK" />

      <SectionTitle>Kontakt</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Telefón" name="phone" type="tel" defaultValue={org?.phone ?? ''} placeholder="+421 900 000 000" />
        <Field label="Web" name="website" type="url" defaultValue={org?.website ?? ''} placeholder="https://firma.sk" />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OrganizationsClient({ orgs }: { orgs: OrgRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null)
  const [deleteOrg, setDeleteOrg] = useState<OrgRow | null>(null)

  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = orgs.filter(org => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      org.name.toLowerCase().includes(q) ||
      !!org.billing_email?.toLowerCase().includes(q) ||
      !!org.city?.toLowerCase().includes(q) ||
      !!org.ico?.includes(q)
    const matchesPlan = planFilter === 'all' || org.subscription?.plan === planFilter
    return matchesSearch && matchesPlan
  })

  const handleCreate = (formData: FormData) => {
    setCreateError(null)
    startTransition(async () => {
      const result = await createOrganization(formData)
      if (result?.error) setCreateError(result.error)
      else { setCreateOpen(false); router.refresh() }
    })
  }

  const handleEdit = (formData: FormData) => {
    if (!editOrg) return
    setEditError(null)
    startTransition(async () => {
      const result = await updateOrganization(editOrg.id, formData)
      if (result?.error) setEditError(result.error)
      else { setEditOrg(null); router.refresh() }
    })
  }

  const handleDelete = () => {
    if (!deleteOrg) return
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteOrganization(deleteOrg.id)
      if (result?.error) setDeleteError(result.error)
      else { setDeleteOrg(null); router.refresh() }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizácie</h1>
          <p className="text-gray-500 text-sm mt-1">{orgs.length} organizácií na platforme</p>
        </div>
        <button
          onClick={() => { setCreateError(null); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-orange)' }}
        >
          <Plus size={16} />
          Nová organizácia
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Hľadať podľa názvu, mesta, IČO..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
        >
          <option value="all">Všetky plány</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Building2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">
              {orgs.length === 0 ? 'Zatiaľ žiadne organizácie' : 'Žiadne výsledky pre daný filter'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organizácia</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">IČO</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plán</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prevádzky</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vytvorená</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: 'var(--brand-orange)' }}
                      >
                        {org.name[0].toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/super-admin/organizations/${org.id}`}
                          className="font-medium text-gray-900 text-sm hover:underline"
                        >
                          {org.name}
                        </Link>
                        <p className="text-xs text-gray-400">{org.city ?? org.billing_email ?? '–'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{org.ico ?? '–'}</td>
                  <td className="px-6 py-4">
                    {org.subscription ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColors[org.subscription.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {org.subscription.plan}
                      </span>
                    ) : <span className="text-xs text-gray-400">–</span>}
                  </td>
                  <td className="px-6 py-4">
                    {org.subscription ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[org.subscription.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[org.subscription.status] ?? org.subscription.status}
                      </span>
                    ) : <span className="text-xs text-gray-400">–</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{org.venue_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(org.created_at).toLocaleDateString('sk-SK')}
                  </td>
                  <td className="px-6 py-4">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[150px] z-50" align="end" sideOffset={4}>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
                            onSelect={() => router.push(`/super-admin/organizations/${org.id}`)}
                          >
                            <ExternalLink size={14} />
                            Detail
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-orange-50 cursor-pointer outline-none"
                            style={{ color: 'var(--brand-orange)' }}
                            onSelect={() => startTransition(() => enterOrgPreview(org.id))}
                          >
                            <LogIn size={14} />
                            Vstúpiť do admin
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
                            onSelect={() => { setEditError(null); setEditOrg(org) }}
                          >
                            <Pencil size={14} />
                            Upraviť
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
                            onSelect={() => { setDeleteError(null); setDeleteOrg(org) }}
                          >
                            <Trash2 size={14} />
                            Zmazať
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
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-lg z-50 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Nová organizácia</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </Dialog.Close>
            </div>
            <form action={handleCreate}>
              <OrgFormFields />
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
      <Dialog.Root open={!!editOrg} onOpenChange={open => { if (!isPending && !open) setEditOrg(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-lg z-50 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Upraviť organizáciu</Dialog.Title>
              <button onClick={() => { if (!isPending) setEditOrg(null) }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            {editOrg && (
              <form key={editOrg.id} action={handleEdit}>
                <OrgFormFields org={editOrg} />
                {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{editError}</p>}
                <div className="flex gap-3 justify-end mt-5">
                  <button type="button" onClick={() => setEditOrg(null)}
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
      <Dialog.Root open={!!deleteOrg} onOpenChange={open => { if (!isPending && !open) setDeleteOrg(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-sm z-50 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Zmazať organizáciu?</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-5">
              Naozaj chceš zmazať <strong className="text-gray-900">{deleteOrg?.name}</strong>?
              Táto akcia je nevratná a zmaže aj všetky prevádzky a dáta.
            </Dialog.Description>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOrg(null)} disabled={isPending}
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
