'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Users, Plus, Search, MoreVertical, Pencil, Trash2, X, ShieldCheck, KeyRound } from 'lucide-react'
import { createUser, updateUser, deleteUser, setUserPassword } from './actions'
import type { UserRow, VenueOption } from './page'
import type { UserRole } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

type DisplayRole = 'super_admin' | 'restaurant_admin' | 'manager' | 'waiter' | 'cook' | 'barman' | 'customer'

const displayRoles: { value: DisplayRole; label: string; group: 'system' | 'staff' }[] = [
  { value: 'super_admin',      label: 'Super Admin',        group: 'system' },
  { value: 'restaurant_admin', label: 'Admin reštaurácie',  group: 'system' },
  { value: 'manager',          label: 'Manager',            group: 'staff'  },
  { value: 'waiter',           label: 'Čašník',             group: 'staff'  },
  { value: 'cook',             label: 'Kuchár',             group: 'staff'  },
  { value: 'barman',           label: 'Barman',             group: 'staff'  },
  { value: 'customer',         label: 'Zákazník',           group: 'system' },
]

const staffRoles = new Set<DisplayRole>(['manager', 'waiter', 'cook', 'barman'])

function toDisplayRole(u: UserRow): DisplayRole {
  if (u.staff_role === 'waiter')  return 'waiter'
  if (u.staff_role === 'cook')    return 'cook'
  if (u.staff_role === 'barman')  return 'barman'
  if (u.staff_role === 'manager') return 'manager'
  return u.role as DisplayRole
}

const roleColors: Record<DisplayRole, string> = {
  super_admin:      'bg-red-100 text-red-700',
  restaurant_admin: 'bg-purple-100 text-purple-700',
  manager:          'bg-blue-100 text-blue-700',
  waiter:           'bg-teal-100 text-teal-700',
  cook:             'bg-orange-100 text-orange-700',
  barman:           'bg-indigo-100 text-indigo-700',
  customer:         'bg-gray-100 text-gray-500',
}

const allUserRoles: UserRole[] = ['super_admin', 'restaurant_admin', 'manager', 'waiter', 'kitchen', 'bar', 'customer']
const userRoleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin', restaurant_admin: 'Admin', manager: 'Manager',
  waiter: 'Čašník', kitchen: 'Kuchár', bar: 'Barman', customer: 'Zákazník',
}

// ── Helper components ─────────────────────────────────────────────────────────

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: 'var(--brand-navy)' }}>
      {initials}
    </div>
  )
}

function Input({ label, name, type = 'text', placeholder, defaultValue, required, minLength }: {
  label: string; name: string; type?: string; placeholder?: string
  defaultValue?: string; required?: boolean; minLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
      <input type={type} name={name} placeholder={placeholder} defaultValue={defaultValue}
        required={required} minLength={minLength}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
    </div>
  )
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateUserForm({ venues, onSuccess, error, setError, isPending, startT }: {
  venues: VenueOption[]
  onSuccess: () => void
  error: string | null
  setError: (e: string | null) => void
  isPending: boolean
  startT: (fn: () => Promise<void>) => void
}) {
  const [role, setRole] = useState<DisplayRole>('restaurant_admin')
  const isAdmin = role === 'restaurant_admin'
  const isStaff = staffRoles.has(role)

  return (
    <form action={(fd) => { setError(null); startT(async () => { const r = await createUser(fd); if (r?.error) setError(r.error); else onSuccess() }) }}
      className="space-y-4">
      <Input label="Celé meno" name="full_name" placeholder="Ján Novák" />
      <Input label="Email" name="email" type="email" placeholder="user@example.com" required />
      <Input label="Heslo" name="password" type="password" placeholder="min. 8 znakov" required minLength={8} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pozícia / Rola *</label>
        <select name="display_role" value={role} onChange={e => setRole(e.target.value as DisplayRole)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
          <optgroup label="Systémové roly">
            {displayRoles.filter(r => r.group === 'system').map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </optgroup>
          <optgroup label="Personál prevádzky">
            {displayRoles.filter(r => r.group === 'staff').map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Staff: venue selector */}
      {isStaff && (
        <div className="border border-blue-100 rounded-lg p-4 space-y-3 bg-blue-50/40">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Priradenie k prevádzke</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prevádzka *</label>
            <select name="venue_id" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
              <option value="">– Vyber prevádzku –</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.org_name})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Admin: org + venue creation */}
      {isAdmin && (
        <div className="border border-orange-100 rounded-lg p-4 space-y-3 bg-orange-50/40">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Reštaurácia (voliteľné)</p>
          <Input label="Názov organizácie" name="org_name" placeholder="Koliba s.r.o." />
          <Input label="Názov prevádzky" name="venue_name" placeholder="Reštaurácia Koliba" />
          <p className="text-xs text-gray-400">Ak nevyplníš, prevádzku pridáš neskôr.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
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
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UsersClient({ users, currentUserId, venues }: {
  users: UserRow[]
  currentUserId: string
  venues: VenueOption[]
}) {
  const router = useRouter()
  const [isPending, startT] = useTransition()

  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState('all')
  const [venueFilter,  setVenueFilter]  = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [createOpen,    setCreateOpen]    = useState(false)
  const [editUser,      setEditUser]      = useState<UserRow | null>(null)
  const [deleteUser_,   setDeleteUser]    = useState<UserRow | null>(null)
  const [passwordUser,  setPasswordUser]  = useState<UserRow | null>(null)

  const [createError,   setCreateError]   = useState<string | null>(null)
  const [editError,     setEditError]     = useState<string | null>(null)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordOk,    setPasswordOk]    = useState(false)

  const refresh = () => router.refresh()

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const disp = toDisplayRole(u)
    if (search && !u.email.toLowerCase().includes(q) && !u.full_name?.toLowerCase().includes(q)) return false
    if (roleFilter !== 'all' && disp !== roleFilter) return false
    if (venueFilter !== 'all') {
      if (venueFilter === 'none') { if (u.venue_id) return false }
      else if (u.venue_id !== venueFilter) return false
    }
    if (statusFilter !== 'all' && (statusFilter === 'active') !== u.is_active) return false
    return true
  })

  const handleEdit = (fd: FormData) => {
    if (!editUser) return
    setEditError(null)
    startT(async () => {
      const r = await updateUser(editUser.id, fd)
      if (r?.error) setEditError(r.error)
      else { setEditUser(null); refresh() }
    })
  }

  const handleDelete = () => {
    if (!deleteUser_) return
    setDeleteError(null)
    startT(async () => {
      const r = await deleteUser(deleteUser_.id)
      if (r?.error) setDeleteError(r.error)
      else { setDeleteUser(null); refresh() }
    })
  }

  const handleSetPassword = (fd: FormData) => {
    if (!passwordUser) return
    setPasswordError(null); setPasswordOk(false)
    startT(async () => {
      const r = await setUserPassword(passwordUser.id, fd)
      if (r?.error) setPasswordError(r.error)
      else { setPasswordOk(true); setTimeout(() => setPasswordUser(null), 1500) }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Používatelia</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} používateľov na platforme</p>
        </div>
        <button onClick={() => { setCreateError(null); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-orange)' }}>
          <Plus size={16} /> Nový používateľ
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Hľadať…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>
        <select value={venueFilter} onChange={e => setVenueFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
          <option value="all">Všetky prevádzky</option>
          <option value="none">Bez prevádzky</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
          <option value="all">Všetky roly</option>
          {displayRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
          <option value="all">Všetky statusy</option>
          <option value="active">Aktívny</option>
          <option value="inactive">Neaktívny</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{users.length === 0 ? 'Zatiaľ žiadni používatelia' : 'Žiadne výsledky'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Používateľ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prevádzka</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rola</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Posl. prihlásenie</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => {
                const disp = toDisplayRole(u)
                const dispLabel = displayRoles.find(r => r.value === disp)?.label ?? disp
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} email={u.email} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 text-sm">
                              {u.full_name ?? <span className="text-gray-400 italic">Bez mena</span>}
                            </p>
                            {u.id === currentUserId && <ShieldCheck size={13} className="text-orange-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{u.venue_name ?? <span className="text-gray-300">–</span>}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[disp]}`}>
                        {dispLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Aktívny' : 'Neaktívny'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('sk-SK') : '–'}
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
                              onSelect={() => { setEditError(null); setEditUser(u) }}>
                              <Pencil size={14} /> Upraviť
                            </DropdownMenu.Item>
                            {u.id !== currentUserId && (
                              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
                                onSelect={() => { setPasswordError(null); setPasswordOk(false); setPasswordUser(u) }}>
                                <KeyRound size={14} /> Nastaviť heslo
                              </DropdownMenu.Item>
                            )}
                            {u.id !== currentUserId && (
                              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
                                onSelect={() => { setDeleteError(null); setDeleteUser(u) }}>
                                <Trash2 size={14} /> Zmazať
                              </DropdownMenu.Item>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog.Root open={createOpen} onOpenChange={o => { if (!isPending) setCreateOpen(o) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md z-50 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Nový používateľ</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </Dialog.Close>
            </div>
            <CreateUserForm venues={venues} error={createError} setError={setCreateError}
              isPending={isPending} startT={startT}
              onSuccess={() => { setCreateOpen(false); refresh() }} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit Dialog */}
      <Dialog.Root open={!!editUser} onOpenChange={o => { if (!isPending && !o) setEditUser(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md z-50 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Upraviť používateľa</Dialog.Title>
              <button onClick={() => !isPending && setEditUser(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            {editUser && (
              <form key={editUser.id} action={handleEdit} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                  <Avatar name={editUser.full_name} email={editUser.email} />
                  <p className="text-sm text-gray-500">{editUser.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celé meno</label>
                  <input type="text" name="full_name" defaultValue={editUser.full_name ?? ''} placeholder="Ján Novák"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                  <select name="role" defaultValue={editUser.role}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
                    {allUserRoles.map(r => <option key={r} value={r}>{userRoleLabels[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="is_active" defaultValue={editUser.is_active ? 'true' : 'false'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
                    <option value="true">Aktívny</option>
                    <option value="false">Neaktívny</option>
                  </select>
                </div>
                {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Zrušiť</button>
                  <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: 'var(--brand-orange)' }}>
                    {isPending ? 'Ukladanie…' : 'Uložiť'}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Password Dialog */}
      <Dialog.Root open={!!passwordUser} onOpenChange={o => { if (!isPending && !o) setPasswordUser(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-sm z-50 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Nastaviť heslo</Dialog.Title>
              <button onClick={() => !isPending && setPasswordUser(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            {passwordUser && (
              <form key={passwordUser.id} action={handleSetPassword} className="space-y-4">
                <p className="text-sm text-gray-500">Pre: <strong className="text-gray-900">{passwordUser.full_name ?? passwordUser.email}</strong></p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nové heslo</label>
                  <input type="password" name="password" required autoFocus minLength={8} placeholder="min. 8 znakov"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                {passwordError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>}
                {passwordOk && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Heslo bolo nastavené.</p>}
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={() => setPasswordUser(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Zrušiť</button>
                  <button type="submit" disabled={isPending || passwordOk} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: 'var(--brand-orange)' }}>
                    {isPending ? 'Ukladám…' : 'Nastaviť'}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Dialog */}
      <Dialog.Root open={!!deleteUser_} onOpenChange={o => { if (!isPending && !o) setDeleteUser(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-sm z-50 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Zmazať používateľa?</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-5">
              Naozaj chceš natrvalo zmazať <strong className="text-gray-900">{deleteUser_?.full_name ?? deleteUser_?.email}</strong>? Táto akcia je nevratná.
            </Dialog.Description>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteUser(null)} disabled={isPending} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Zrušiť</button>
              <button onClick={handleDelete} disabled={isPending} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {isPending ? 'Mazanie…' : 'Zmazať'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
