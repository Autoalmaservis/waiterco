"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, Pencil, Trash2, X, Globe, Phone, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Venue, VenueType } from "@/types/database"
import {
  createVenue,
  updateVenue,
  deleteVenue,
  toggleVenueActive,
  toggleVenueOpen,
} from "./actions"

const venueTypeLabels: Record<VenueType, string> = {
  restaurant: "Reštaurácia",
  bar: "Bar",
  hotel: "Hotel",
  cafe: "Kaviareň",
}

const venueTypeColors: Record<VenueType, string> = {
  restaurant: "bg-orange-100 text-orange-700",
  bar: "bg-purple-100 text-purple-700",
  hotel: "bg-blue-100 text-blue-700",
  cafe: "bg-amber-100 text-amber-700",
}

interface Props {
  venues: Venue[]
}

function VenueFormFields({ venue }: { venue?: Venue }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Názov *</label>
          <input
            name="name"
            required
            defaultValue={venue?.name}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Moja Reštaurácia"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Typ</label>
          <select
            name="type"
            defaultValue={venue?.type ?? "restaurant"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="restaurant">Reštaurácia</option>
            <option value="bar">Bar</option>
            <option value="hotel">Hotel</option>
            <option value="cafe">Kaviareň</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Mena</label>
          <select
            name="currency"
            defaultValue={venue?.currency ?? "EUR"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="EUR">EUR – Euro</option>
            <option value="CZK">CZK – Česká koruna</option>
            <option value="USD">USD – Dolár</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Popis</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={venue?.description ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            placeholder="Krátky popis prevádzky..."
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Adresa</label>
          <input
            name="address"
            defaultValue={venue?.address ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Hlavná 1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Mesto</label>
          <input
            name="city"
            defaultValue={venue?.city ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Bratislava"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Krajina</label>
          <input
            name="country"
            defaultValue={venue?.country ?? "SK"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="SK"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Telefón</label>
          <input
            name="phone"
            defaultValue={venue?.phone ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="+421 900 000 000"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={venue?.email ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="info@restaurant.sk"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Webstránka</label>
          <input
            name="website"
            defaultValue={venue?.website ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="https://restaurant.sk"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Časové pásmo</label>
          <select
            name="timezone"
            defaultValue={venue?.timezone ?? "Europe/Bratislava"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="Europe/Bratislava">Europe/Bratislava</option>
            <option value="Europe/Prague">Europe/Prague</option>
            <option value="Europe/Vienna">Europe/Vienna</option>
          </select>
        </div>
        {venue && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Primárna farba</label>
            <input
              name="primary_color"
              type="color"
              defaultValue={venue?.primary_color ?? "#E85B1A"}
              className="w-full h-9 px-1 border border-gray-200 rounded-lg cursor-pointer"
            />
          </div>
        )}
        {venue && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dôvod zatvorenia</label>
            <input
              name="closed_reason"
              defaultValue={venue?.closed_reason ?? ""}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Napr. Dovolenka do 15.8."
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function VenuesClient({ venues: initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [venues, setVenues] = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [editVenue, setEditVenue] = useState<Venue | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState("")

  function refresh() {
    router.refresh()
  }

  const handleCreate = (formData: FormData) => {
    setError("")
    startTransition(async () => {
      const result = await createVenue(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setCreateOpen(false)
      refresh()
    })
  }

  const handleUpdate = (formData: FormData) => {
    if (!editVenue) return
    setError("")
    startTransition(async () => {
      const result = await updateVenue(editVenue.id, formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setEditVenue(null)
      refresh()
    })
  }

  const handleDelete = () => {
    if (!deleteId) return
    startTransition(async () => {
      await deleteVenue(deleteId)
      setDeleteId(null)
      refresh()
    })
  }

  const handleToggleActive = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleVenueActive(id, !current)
      refresh()
    })
  }

  const handleToggleOpen = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleVenueOpen(id, !current)
      refresh()
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prevádzky</h1>
          <p className="text-gray-500 text-sm mt-1">{venues.length} prevádzok</p>
        </div>
        <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
          <Dialog.Trigger asChild>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-orange)" }}
            >
              <Plus size={16} />
              Nová prevádzka
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <Dialog.Title className="font-semibold text-gray-900">Nová prevádzka</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </Dialog.Close>
              </div>
              <form action={handleCreate} className="p-6 space-y-4">
                <VenueFormFields />
                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <div className="flex gap-3 justify-end pt-2">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                      Zrušiť
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand-orange)" }}
                  >
                    {isPending ? "Ukladám..." : "Vytvoriť"}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Table */}
      {venues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <p className="text-sm">Zatiaľ žiadne prevádzky</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Názov</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Typ</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesto</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktívna</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Otvorená</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {venues.map((venue) => (
                <tr key={venue.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{venue.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {venue.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone size={11} />
                            {venue.phone}
                          </span>
                        )}
                        {venue.website && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Globe size={11} />
                            {venue.website}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${venueTypeColors[venue.type]}`}>
                      {venueTypeLabels[venue.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin size={13} className="text-gray-400" />
                      {venue.city ?? "–"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(venue.id, venue.is_active)}
                      disabled={isPending}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        venue.is_active ? "bg-green-500" : "bg-gray-200"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                          venue.is_active ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleOpen(venue.id, venue.is_open)}
                      disabled={isPending}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        venue.is_open ? "bg-teal-500" : "bg-gray-200"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                          venue.is_open ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setError(""); setEditVenue(venue) }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(venue.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Edit dialog */}
      <Dialog.Root open={!!editVenue} onOpenChange={(open) => !open && setEditVenue(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <Dialog.Title className="font-semibold text-gray-900">Upraviť prevádzku</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </Dialog.Close>
            </div>
            {editVenue && (
              <form action={handleUpdate} className="p-6 space-y-4">
                <VenueFormFields venue={editVenue} />
                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <div className="flex gap-3 justify-end pt-2">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                      Zrušiť
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand-orange)" }}
                  >
                    {isPending ? "Ukladám..." : "Uložiť"}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirm dialog */}
      <Dialog.Root open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-sm z-50 p-6">
            <Dialog.Title className="font-semibold text-gray-900 mb-2">Vymazať prevádzku?</Dialog.Title>
            <p className="text-sm text-gray-500 mb-6">
              Táto akcia je nevratná. Všetky stoly, menu a objednávky tejto prevádzky budú tiež vymazané.
            </p>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
              </Dialog.Close>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Mažem..." : "Vymazať"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
