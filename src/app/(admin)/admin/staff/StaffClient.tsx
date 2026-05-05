"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, Trash2, X, KeyRound, Check, Pencil } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { StaffRole, VenueType } from "@/types/database"
import { addStaff, removeStaff, toggleStaffActive, setStaffPassword } from "./actions"
import { assignPosition, updateStaffMember } from "./positions-actions"
import { ALL_PERMISSIONS } from "./permissions"
import PositionsManager, { type PositionRow } from "./PositionsManager"

const roleLabels: Record<StaffRole, string> = {
  manager: "Manager",
  waiter:  "Casnik",
  cook:    "Kuchar",
  barman:  "Barman",
}

const roleColors: Record<StaffRole, string> = {
  manager: "bg-purple-100 text-purple-700",
  waiter:  "bg-blue-100 text-blue-700",
  cook:    "bg-orange-100 text-orange-700",
  barman:  "bg-teal-100 text-teal-700",
}

interface StaffEntry {
  id: string
  venue_id: string
  user_id: string
  role: StaffRole
  is_active: boolean
  joined_at: string
  email: string
  profile: { full_name: string | null; avatar_url: string | null } | null
  venue_name: string
  position_id: string | null
  position: PositionRow | null
  permissions: string[] | null
}

interface VenueOption {
  id: string
  name: string
  type: VenueType
  is_active: boolean
}

interface Props {
  staffEntries: StaffEntry[]
  venues: VenueOption[]
  positions: PositionRow[]
}

export default function StaffClient({ staffEntries: initial, venues, positions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<"staff" | "positions">("staff")
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pwdEntry, setPwdEntry] = useState<StaffEntry | null>(null)
  const [error, setError] = useState("")
  const [pwdError, setPwdError] = useState("")
  const [pwdDone, setPwdDone] = useState(false)
  const [venueFilter, setVenueFilter] = useState<string>("all")
  const [editEntry, setEditEntry] = useState<StaffEntry | null>(null)
  const [editRole, setEditRole] = useState<string>("waiter")
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [editError, setEditError] = useState("")
  const [editUsingCustom, setEditUsingCustom] = useState(false)

  const filtered = venueFilter === "all"
    ? initial
    : initial.filter(e => e.venue_id === venueFilter)

  function refresh() { router.refresh() }

  const handleAdd = (formData: FormData) => {
    setError("")
    startTransition(async () => {
      const result = await addStaff(formData)
      if (result?.error) { setError(result.error); return }
      setAddOpen(false)
      refresh()
    })
  }

  const handleRemove = () => {
    if (!deleteId) return
    startTransition(async () => {
      await removeStaff(deleteId)
      setDeleteId(null)
      refresh()
    })
  }

  const handleToggleActive = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleStaffActive(id, !current)
      refresh()
    })
  }

  const handleSetPassword = (formData: FormData) => {
    if (!pwdEntry) return
    setPwdError("")
    const pwd = formData.get("password") as string
    startTransition(async () => {
      const result = await setStaffPassword(pwdEntry.user_id, pwd)
      if (result?.error) { setPwdError(result.error); return }
      setPwdDone(true)
      setTimeout(() => { setPwdEntry(null); setPwdDone(false) }, 1200)
    })
  }

  function openEdit(entry: StaffEntry) {
    const hasCustom = entry.permissions !== null
    setEditEntry(entry)
    setEditRole(entry.role)
    setEditUsingCustom(hasCustom)
    setEditPerms(hasCustom ? (entry.permissions ?? []) : (entry.position?.permissions ?? []))
    setEditError("")
  }

  const handleUpdateStaff = () => {
    if (!editEntry) return
    startTransition(async () => {
      const result = await updateStaffMember(editEntry.id, {
        role: editRole as StaffRole,
        permissions: editUsingCustom ? editPerms : null,
      })
      if (result?.error) { setEditError(result.error); return }
      setEditEntry(null)
      refresh()
    })
  }

  function toggleEditPerm(key: string) {
    setEditUsingCustom(true)
    setEditPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleAssignPosition = (staffId: string, positionId: string | null) => {
    startTransition(async () => {
      await assignPosition(staffId, positionId)
      refresh()
    })
  }

  const displayName = (e: StaffEntry) =>
    e.profile?.full_name || e.email || "Neznamy"

  const initials = (e: StaffEntry) =>
    (e.profile?.full_name?.[0] ?? e.email?.[0] ?? "?").toUpperCase()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tab === "staff" ? `${filtered.length} clenov timu` : `${positions.length} pozicii`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
            <button
              onClick={() => setTab("staff")}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
                tab === "staff" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Zamestnanci
            </button>
            <button
              onClick={() => setTab("positions")}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
                tab === "positions" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Pozicie
            </button>
          </div>

          {tab === "staff" && (
            <Dialog.Root open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) setError("") }}>
              <Dialog.Trigger asChild>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                  style={{ backgroundColor: "var(--brand-orange)" }}
                >
                  <Plus size={16} />
                  Pridat zamestnanca
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md z-50">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">Novy zamestnanec</Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </Dialog.Close>
                  </div>
                  <form action={handleAdd} className="p-6 space-y-4">
                    {venues.length > 1 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Prevadzka *</label>
                        <select name="venue_id" required
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    )}
                    {venues.length === 1 && (
                      <input type="hidden" name="venue_id" value={venues[0].id} />
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cele meno *</label>
                      <input name="full_name" required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Jan Novak" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                      <input name="email" type="email" required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="zamestnanec@restauracia.sk" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Heslo *</label>
                      <input name="password" type="password" required minLength={8}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="min. 8 znakov" />
                      <p className="text-xs text-gray-400 mt-1">Zamestnanec si ho moze neskor zmenit</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Typ *</label>
                      <select name="role" required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="waiter">Casnik</option>
                        <option value="cook">Kuchar</option>
                        <option value="barman">Barman</option>
                        <option value="manager">Manager</option>
                      </select>
                    </div>
                    {positions.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pozicia (povolenia)</label>
                        <select name="position_id"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                          <option value="">-- Bez pozicie --</option>
                          {positions.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">Urcuje co zamestnanec uvidi vo svojom rozhrani</p>
                      </div>
                    )}
                    {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                    <div className="flex gap-3 justify-end pt-2">
                      <Dialog.Close asChild>
                        <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrusit</button>
                      </Dialog.Close>
                      <button type="submit" disabled={isPending}
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                        style={{ backgroundColor: "var(--brand-orange)" }}>
                        {isPending ? "Vytvorit..." : "Vytvorit ucet"}
                      </button>
                    </div>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      </div>

      {/* Positions tab */}
      {tab === "positions" && (
        <PositionsManager initialPositions={positions} />
      )}

      {/* Staff tab */}
      {tab === "staff" && (
        <>
          {venues.length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setVenueFilter("all")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${venueFilter === "all" ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={venueFilter === "all" ? { backgroundColor: "var(--brand-navy)" } : {}}
              >
                Vsetky ({initial.length})
              </button>
              {venues.map(v => {
                const count = initial.filter(e => e.venue_id === v.id).length
                return (
                  <button key={v.id} onClick={() => setVenueFilter(v.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${venueFilter === v.id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    style={venueFilter === v.id ? { backgroundColor: "var(--brand-orange)" } : {}}>
                    {v.name} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
              {initial.length === 0 ? "Zatial ziadny personal. Pridajte prveho zamestnanca." : "Ziadni zamestnanci v tejto prevadzke."}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Zamestnanec</th>
                    {venues.length > 1 && venueFilter === "all" && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prevadzka</th>
                    )}
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Typ</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pozicia</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktivny</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pridany</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: "var(--brand-navy)" }}
                          >
                            {initials(entry)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{displayName(entry)}</p>
                            <p className="text-xs text-gray-400">{entry.email}</p>
                          </div>
                        </div>
                      </td>
                      {venues.length > 1 && venueFilter === "all" && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">{entry.venue_name}</p>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[entry.role]}`}>
                          {roleLabels[entry.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {positions.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            {entry.position && (
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.position.color }} />
                            )}
                            <select
                              value={entry.position_id ?? ""}
                              onChange={e => handleAssignPosition(entry.id, e.target.value || null)}
                              disabled={isPending}
                              className="text-sm text-gray-700 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-300 rounded cursor-pointer disabled:opacity-50 max-w-[140px]"
                            >
                              <option value="">Bez pozicie</option>
                              {positions.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(entry.id, entry.is_active)}
                          disabled={isPending}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            entry.is_active ? "bg-green-500" : "bg-gray-200"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                            entry.is_active ? "translate-x-4" : "translate-x-0.5"
                          )} />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-gray-500">{formatDate(entry.joined_at)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Upravit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setPwdEntry(entry); setPwdError(""); setPwdDone(false) }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Zmenit heslo"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteId(entry.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Odstranit"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Set password dialog */}
      <Dialog.Root open={!!pwdEntry} onOpenChange={o => !o && setPwdEntry(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-sm z-50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <Dialog.Title className="font-semibold text-gray-900">Zmenit heslo</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </Dialog.Close>
            </div>
            <form action={handleSetPassword} className="p-6 space-y-4">
              {pwdEntry && (
                <p className="text-sm text-gray-500">
                  Zamestnanec: <span className="font-medium text-gray-800">{displayName(pwdEntry)}</span>
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nove heslo *</label>
                <input name="password" type="password" required minLength={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="min. 8 znakov" />
              </div>
              {pwdError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{pwdError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrusit</button>
                </Dialog.Close>
                <button type="submit" disabled={isPending || pwdDone}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-colors ${pwdDone ? "bg-emerald-500" : ""}`}
                  style={!pwdDone ? { backgroundColor: "var(--brand-orange)" } : {}}>
                  {pwdDone ? <><Check size={14} /> Ulozene</> : isPending ? "Ukladam..." : "Ulozit heslo"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit staff dialog */}
      <Dialog.Root open={!!editEntry} onOpenChange={o => !o && setEditEntry(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md z-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <Dialog.Title className="font-semibold text-gray-900">Upravit zamestnanca</Dialog.Title>
                {editEntry && (
                  <p className="text-xs text-gray-400 mt-0.5">{displayName(editEntry)}</p>
                )}
              </div>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </Dialog.Close>
            </div>

            <div className="p-6 space-y-5">
              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Typ zamestnanca</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="waiter">Casnik</option>
                  <option value="cook">Kuchar</option>
                  <option value="barman">Barman</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Povolenia</label>
                  {editUsingCustom && editEntry?.position && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditUsingCustom(false)
                        setEditPerms(editEntry.position?.permissions ?? [])
                      }}
                      className="text-xs text-orange-500 hover:text-orange-700"
                    >
                      Resetovat na poziciu
                    </button>
                  )}
                </div>

                {!editUsingCustom && editEntry?.position && (
                  <p className="text-xs text-gray-400 mb-3 bg-gray-50 px-3 py-2 rounded-lg">
                    Pouziva povolenia pozicie <span className="font-medium text-gray-600">{editEntry.position.name}</span>. Zmenou prepnete na vlastne povolenia.
                  </p>
                )}
                {!editEntry?.position && !editUsingCustom && (
                  <p className="text-xs text-gray-400 mb-3 bg-gray-50 px-3 py-2 rounded-lg">
                    Bez pozicie — vidi vsetko. Nastavte vlastne povolenia alebo priradte poziciu.
                  </p>
                )}

                <div className="space-y-2">
                  {ALL_PERMISSIONS.map(perm => {
                    const checked = editPerms.includes(perm.key)
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() => toggleEditPerm(perm.key)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          checked
                            ? "border-orange-200 bg-orange-50"
                            : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-medium ${checked ? "text-orange-700" : "text-gray-700"}`}>
                            {perm.label}
                          </p>
                          <p className="text-xs text-gray-400">{perm.description}</p>
                        </div>
                        <div className={`w-9 h-5 rounded-full transition-colors shrink-0 ml-3 relative ${checked ? "bg-orange-500" : "bg-gray-200"}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrusit</button>
              </Dialog.Close>
              <button
                onClick={handleUpdateStaff}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: "var(--brand-orange)" }}
              >
                {isPending ? "Ukladam..." : "Ulozit"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirm */}
      <Dialog.Root open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-sm z-50 p-6">
            <Dialog.Title className="font-semibold text-gray-900 mb-2">Odstranit zamestnanca?</Dialog.Title>
            <p className="text-sm text-gray-500 mb-6">Strati pristup k tejto prevadzke. Jeho ucet zostane zachovany.</p>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrusit</button>
              </Dialog.Close>
              <button onClick={handleRemove} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {isPending ? "Odstranujem..." : "Odstranit"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
