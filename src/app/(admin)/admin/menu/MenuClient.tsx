"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
import type { MenuCategory, VenueType } from "@/types/database"
import { createCategory, updateCategory, deleteCategory, moveCategoryOrder } from "./actions"

interface VenueOption {
  id: string
  name: string
  type: VenueType
  is_active: boolean
}

interface CategoryWithCount extends MenuCategory {
  item_count: number
}

interface Props {
  venues: VenueOption[]
  categories: CategoryWithCount[]
  selectedVenueId: string
}

function CategoryFormFields({ cat, venueId }: { cat?: MenuCategory; venueId: string }) {
  return (
    <div className="space-y-4">
      <input type="hidden" name="venue_id" value={venueId} />
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Názov *</label>
        <input
          name="name"
          required
          defaultValue={cat?.name}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Predjedlá"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Popis</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={cat?.description ?? ""}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Poradie</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={cat?.sort_order ?? 0}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Stav</label>
          <select
            name="is_active"
            defaultValue={cat ? String(cat.is_active) : "true"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="true">Aktívna</option>
            <option value="false">Neaktívna</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Dostupná od</label>
          <input
            name="available_from"
            type="time"
            defaultValue={cat?.available_from ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Dostupná do</label>
          <input
            name="available_to"
            type="time"
            defaultValue={cat?.available_to ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>
    </div>
  )
}

export default function MenuClient({ venues, categories: initial, selectedVenueId: initialVenueId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenueId)
  const [createOpen, setCreateOpen] = useState(false)
  const [editCat, setEditCat] = useState<MenuCategory | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const filteredCats = initial.filter((c) => c.venue_id === selectedVenueId)

  function refresh() {
    router.refresh()
  }

  const handleCreate = (formData: FormData) => {
    setError("")
    startTransition(async () => {
      const result = await createCategory(formData)
      if (result?.error) { setError(result.error); return }
      setCreateOpen(false)
      refresh()
    })
  }

  const handleUpdate = (formData: FormData) => {
    if (!editCat) return
    setError("")
    startTransition(async () => {
      const result = await updateCategory(editCat.id, formData)
      if (result?.error) { setError(result.error); return }
      setEditCat(null)
      refresh()
    })
  }

  const handleDelete = () => {
    if (!deleteId) return
    startTransition(async () => {
      await deleteCategory(deleteId)
      setDeleteId(null)
      refresh()
    })
  }

  const handleMove = (id: string, direction: "up" | "down") => {
    startTransition(async () => {
      await moveCategoryOrder(id, direction)
      refresh()
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="text-gray-500 text-sm mt-1">{filteredCats.length} kategórií</p>
        </div>
        <div className="flex items-center gap-3">
          {venues.length > 1 && (
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
          <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Trigger asChild>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                style={{ backgroundColor: "var(--brand-orange)" }}
              >
                <Plus size={16} />
                Nová kategória
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md z-50">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <Dialog.Title className="font-semibold text-gray-900">Nová kategória</Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                  </Dialog.Close>
                </div>
                <form action={handleCreate} className="p-6 space-y-4">
                  <CategoryFormFields venueId={selectedVenueId} />
                  {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                  <div className="flex gap-3 justify-end pt-2">
                    <Dialog.Close asChild>
                      <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
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
      </div>

      {/* Categories list */}
      {filteredCats.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Zatiaľ žiadne kategórie. Vytvorte prvú kategóriu menu.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Poradie</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategória</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Položky</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stav</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dostupnosť</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCats.map((cat, i) => (
                <tr
                  key={cat.id}
                  onClick={() => router.push(`/admin/menu/${cat.id}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMove(cat.id, "up")}
                        disabled={isPending || i === 0}
                        className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <span className="text-xs text-center text-gray-400 font-mono">{cat.sort_order}</span>
                      <button
                        onClick={() => handleMove(cat.id, "down")}
                        disabled={isPending || i === filteredCats.length - 1}
                        className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cat.description}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{cat.item_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {cat.is_active ? "Aktívna" : "Neaktívna"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500">
                      {cat.available_from && cat.available_to
                        ? `${cat.available_from} – ${cat.available_to}`
                        : "Celý deň"}
                    </span>
                  </td>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <ChevronRight size={15} className="text-gray-300 mr-1" />
                      <button
                        onClick={() => { setError(""); setEditCat(cat) }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(cat.id)}
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
      <Dialog.Root open={!!editCat} onOpenChange={(open) => !open && setEditCat(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md z-50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <Dialog.Title className="font-semibold text-gray-900">Upraviť kategóriu</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </Dialog.Close>
            </div>
            {editCat && (
              <form action={handleUpdate} className="p-6 space-y-4">
                <CategoryFormFields cat={editCat} venueId={editCat.venue_id} />
                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <div className="flex gap-3 justify-end pt-2">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
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

      {/* Delete confirm */}
      <Dialog.Root open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-sm z-50 p-6">
            <Dialog.Title className="font-semibold text-gray-900 mb-2">Vymazať kategóriu?</Dialog.Title>
            <p className="text-sm text-gray-500 mb-6">Všetky položky v tejto kategórii budú tiež vymazané.</p>
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
