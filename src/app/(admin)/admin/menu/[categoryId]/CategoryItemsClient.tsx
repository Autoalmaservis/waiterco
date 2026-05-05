"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, Pencil, Trash2, X, ImageOff, SlidersHorizontal, ChevronDown, ChevronUp, Upload } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { MenuItem } from "@/types/database"
import {
  createMenuItem, updateMenuItem, deleteMenuItem,
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifier, updateModifier, deleteModifier,
} from "../actions"

type ModifierGroup = { id: string; item_id: string; name: string; min_select: number; max_select: number; sort_order: number }
type Modifier = { id: string; group_id: string; name: string; price: number; is_available: boolean; sort_order: number }

interface Props {
  items: MenuItem[]
  categoryId: string
  venueId: string
  modifierGroups: ModifierGroup[]
  modifiers: Modifier[]
}

// Bucket must exist in Supabase: menu-images (public read, authenticated write)
function ImageUploadField({ value, onChange, venueId }: {
  value: string | null
  onChange: (url: string | null) => void
  venueId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setUploadError("Len obrázkové súbory (jpg, png, webp)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Súbor je príliš veľký (max 5 MB)")
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `${venueId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, { contentType: file.type })
      if (upErr) { setUploadError(upErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from("menu-images").getPublicUrl(path)
      onChange(publicUrl)
    } catch {
      setUploadError("Nepodarilo sa nahrať obrázok")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Obrázok</label>
      {value ? (
        <div className="relative rounded-xl overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
            <label className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50">
              <Upload size={12} /> Zmeniť
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-lg text-xs font-semibold text-white hover:bg-red-600"
            >
              <Trash2 size={12} /> Odstrániť
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 transition-colors ${uploading ? "border-orange-300 bg-orange-50/30 cursor-wait" : "border-gray-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/20"}`}>
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Nahrávam...</span>
            </>
          ) : (
            <>
              <Upload size={22} className="text-gray-300" />
              <span className="text-sm text-gray-500">Kliknite pre nahratie fotky</span>
              <span className="text-xs text-gray-400">JPG, PNG, WebP · max 5 MB</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
      {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
    </div>
  )
}

function ItemFormFields({ item, categoryId, venueId }: { item?: MenuItem; categoryId: string; venueId: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null)

  return (
    <div className="space-y-4">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Názov *</label>
        <input
          name="name"
          required
          defaultValue={item?.name}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Kurací rezeň"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Popis</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={item?.description ?? ""}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Cena (€) *</label>
          <input
            name="base_price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={item?.base_price ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Čas prípravy (min)</label>
          <input
            name="preparation_time"
            type="number"
            min="0"
            defaultValue={item?.preparation_time ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="15"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Kalórie (kcal)</label>
          <input
            name="calories"
            type="number"
            min="0"
            defaultValue={item?.calories ?? ""}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="450"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Poradie</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={item?.sort_order ?? 0}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Alergény (čiarkou oddelené)</label>
        <input
          name="allergens"
          defaultValue={(item?.allergens ?? []).join(", ")}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="gluten, mlieko, vajcia"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Štítky / Tagy (čiarkou oddelené)</label>
        <input
          name="tags"
          defaultValue={(item?.tags ?? []).join(", ")}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="vegan, bez-laktózy, popular"
        />
      </div>
      <ImageUploadField value={imageUrl} onChange={setImageUrl} venueId={venueId} />
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Stanica</label>
        <select
          name="station"
          defaultValue={(item as any)?.station ?? "kitchen"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="kitchen">🍳 Kuchyňa</option>
          <option value="bar">🍺 Bar</option>
          <option value="waiter">🧾 Čašník (bez prípravy)</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">Kde sa táto položka pripravuje / zobrazí na KDS</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Stav</label>
          <select
            name="is_active"
            defaultValue={item ? String(item.is_active) : "true"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="true">Aktívna</option>
            <option value="false">Neaktívna</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Dostupnosť</label>
          <select
            name="is_available"
            defaultValue={item ? String(item.is_available) : "true"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="true">Dostupná</option>
            <option value="false">Nedostupná</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Dôvod nedostupnosti</label>
        <input
          name="unavailable_reason"
          defaultValue={item?.unavailable_reason ?? ""}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Vypredané, dostupné od zajtra"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Donáška / Takeaway</label>
        <select
          name="available_for_delivery"
          defaultValue={(item as any)?.available_for_delivery === false ? "false" : "true"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="true">Áno — dostupné na donášku</option>
          <option value="false">Nie — iba v prevádzke</option>
        </select>
      </div>
    </div>
  )
}

function ModifierManagerDialog({
  item, categoryId, venueId, groups, modifiers, onClose,
}: {
  item: MenuItem
  categoryId: string
  venueId: string
  groups: ModifierGroup[]
  modifiers: Modifier[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  // Group form state
  const [addGroupOpen, setAddGroupOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState("")
  const [groupMin, setGroupMin] = useState("0")
  const [groupMax, setGroupMax] = useState("1")

  // Modifier form state
  const [addModifierGroupId, setAddModifierGroupId] = useState<string | null>(null)
  const [editModifier, setEditModifier] = useState<Modifier | null>(null)
  const [deleteModifierId, setDeleteModifierId] = useState<string | null>(null)
  const [modName, setModName] = useState("")
  const [modPrice, setModPrice] = useState("0")
  const [modAvailable, setModAvailable] = useState(true)

  const [error, setError] = useState("")

  function refresh() { router.refresh() }

  function openAddGroup() {
    setGroupName(""); setGroupMin("0"); setGroupMax("1"); setError(""); setAddGroupOpen(true)
  }

  function openEditGroup(g: ModifierGroup) {
    setGroupName(g.name); setGroupMin(String(g.min_select)); setGroupMax(String(g.max_select))
    setError(""); setEditGroup(g)
  }

  function openAddModifier(groupId: string) {
    setModName(""); setModPrice("0"); setModAvailable(true); setError(""); setAddModifierGroupId(groupId)
  }

  function openEditModifier(m: Modifier) {
    setModName(m.name); setModPrice(String(m.price)); setModAvailable(m.is_available); setError(""); setEditModifier(m)
  }

  function handleSaveGroup() {
    if (!groupName.trim()) return
    setError("")
    startTransition(async () => {
      if (editGroup) {
        const res = await updateModifierGroup(editGroup.id, categoryId, groupName.trim(), Number(groupMin), Number(groupMax))
        if (res?.error) { setError(res.error); return }
        setEditGroup(null)
      } else {
        const res = await createModifierGroup(item.id, venueId, categoryId, groupName.trim(), Number(groupMin), Number(groupMax), groups.length)
        if (res?.error) { setError(res.error); return }
        setAddGroupOpen(false)
      }
      refresh()
    })
  }

  function handleDeleteGroup() {
    if (!deleteGroupId) return
    startTransition(async () => {
      await deleteModifierGroup(deleteGroupId, categoryId)
      setDeleteGroupId(null)
      refresh()
    })
  }

  function handleSaveModifier() {
    if (!modName.trim()) return
    setError("")
    startTransition(async () => {
      if (editModifier) {
        const res = await updateModifier(editModifier.id, categoryId, modName.trim(), Number(modPrice), modAvailable)
        if (res?.error) { setError(res.error); return }
        setEditModifier(null)
      } else if (addModifierGroupId) {
        const groupMods = modifiers.filter(m => m.group_id === addModifierGroupId)
        const res = await createModifier(addModifierGroupId, categoryId, modName.trim(), Number(modPrice), groupMods.length)
        if (res?.error) { setError(res.error); return }
        setAddModifierGroupId(null)
      }
      refresh()
    })
  }

  function handleDeleteModifier() {
    if (!deleteModifierId) return
    startTransition(async () => {
      await deleteModifier(deleteModifierId, categoryId)
      setDeleteModifierId(null)
      refresh()
    })
  }

  const itemGroups = groups.filter(g => g.item_id === item.id)

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Modifikátory — {item.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Skupiny úprav pre túto položku</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {itemGroups.length === 0 && !addGroupOpen && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Žiadne skupiny modifikátorov. Pridajte prvú skupinu.
            </div>
          )}

          {itemGroups.map(group => {
            const groupMods = modifiers.filter(m => m.group_id === group.id)
            const isExpanded = expandedGroupId === group.id
            return (
              <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    <span className="font-medium text-gray-900 text-sm">{group.name}</span>
                    <span className="text-xs text-gray-400">
                      · min {group.min_select} / max {group.max_select} · {groupMods.length} volieb
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditGroup(group)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteGroupId(group.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Modifiers list */}
                {isExpanded && (
                  <div>
                    {groupMods.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-400">Žiadne voľby.</div>
                    )}
                    {groupMods.map(mod => (
                      <div key={mod.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
                        <span className={`flex-1 text-sm ${mod.is_available ? "text-gray-800" : "text-gray-400 line-through"}`}>
                          {mod.name}
                        </span>
                        <span className={`text-sm font-mono shrink-0 ${mod.price > 0 ? "text-orange-600" : mod.price < 0 ? "text-green-600" : "text-gray-400"}`}>
                          {mod.price > 0 ? "+" : ""}{formatCurrency(mod.price)}
                        </span>
                        {!mod.is_available && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">skrytá</span>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditModifier(mod)}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteModifierId(mod.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add modifier inline form */}
                    {addModifierGroupId === group.id ? (
                      <div className="px-4 py-3 border-t border-gray-100 bg-blue-50/40 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={modName}
                            onChange={e => setModName(e.target.value)}
                            placeholder="Názov voľby (napr. Bez syra)"
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            onKeyDown={e => e.key === "Enter" && handleSaveModifier()}
                          />
                          <input
                            value={modPrice}
                            onChange={e => setModPrice(e.target.value)}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            onKeyDown={e => e.key === "Enter" && handleSaveModifier()}
                          />
                          <span className="text-xs text-gray-400">€</span>
                          <button
                            onClick={handleSaveModifier}
                            disabled={isPending || !modName.trim()}
                            className="px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                            style={{ backgroundColor: "var(--brand-orange)" }}
                          >
                            {isPending ? "..." : "Pridať"}
                          </button>
                          <button onClick={() => { setAddModifierGroupId(null); setError("") }} className="text-gray-400 hover:text-gray-600">
                            <X size={15} />
                          </button>
                        </div>
                        {error && <p className="text-xs text-red-600 px-1">{error}</p>}
                      </div>
                    ) : (
                      <div className="px-4 py-2 border-t border-gray-100">
                        <button
                          onClick={() => { setExpandedGroupId(group.id); openAddModifier(group.id) }}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-600 transition-colors"
                        >
                          <Plus size={12} /> Pridať voľbu
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Add group inline form */}
          {addGroupOpen && (
            <div className="border-2 border-dashed border-orange-200 rounded-xl p-4 bg-orange-50/30 space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nová skupina</p>
              <input
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Názov skupiny (napr. Úpravy burgra)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min. výber</label>
                  <input
                    value={groupMin}
                    onChange={e => setGroupMin(e.target.value)}
                    type="number" min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max. výber</label>
                  <input
                    value={groupMax}
                    onChange={e => setGroupMax(e.target.value)}
                    type="number" min="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {Number(groupMin) === 0 ? "Voliteľné" : "Povinné"} · zákazník vyberie {Number(groupMin) === Number(groupMax) ? `práve ${groupMin}` : `${groupMin}–${groupMax}`}
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddGroupOpen(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
                <button
                  onClick={handleSaveGroup}
                  disabled={isPending || !groupName.trim()}
                  className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-orange)" }}
                >
                  {isPending ? "Ukladám..." : "Vytvoriť skupinu"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={openAddGroup}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 text-sm transition-colors w-full justify-center"
          >
            <Plus size={15} /> Pridať skupinu modifikátorov
          </button>
        </div>
      </div>

      {/* Edit group dialog */}
      {editGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditGroup(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Upraviť skupinu</h3>
            <div className="space-y-3">
              <input
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Názov skupiny"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min. výber</label>
                  <input value={groupMin} onChange={e => setGroupMin(e.target.value)} type="number" min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max. výber</label>
                  <input value={groupMax} onChange={e => setGroupMax(e.target.value)} type="number" min="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditGroup(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
              <button onClick={handleSaveGroup} disabled={isPending || !groupName.trim()}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {isPending ? "Ukladám..." : "Uložiť"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modifier dialog */}
      {editModifier && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditModifier(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Upraviť voľbu</h3>
            <div className="space-y-3">
              <input autoFocus value={modName} onChange={e => setModName(e.target.value)} placeholder="Názov voľby"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <div className="flex items-center gap-2">
                <input value={modPrice} onChange={e => setModPrice(e.target.value)} type="number" step="0.01" placeholder="0.00"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <span className="text-sm text-gray-500">€</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={modAvailable} onChange={e => setModAvailable(e.target.checked)} className="rounded" />
                Dostupná
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditModifier(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
              <button onClick={handleSaveModifier} disabled={isPending || !modName.trim()}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {isPending ? "Ukladám..." : "Uložiť"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete group confirm */}
      {deleteGroupId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteGroupId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Vymazať skupinu?</h3>
            <p className="text-sm text-gray-500 mb-6">Vymažú sa aj všetky voľby v tejto skupine.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteGroupId(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
              <button onClick={handleDeleteGroup} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {isPending ? "Mažem..." : "Vymazať"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modifier confirm */}
      {deleteModifierId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModifierId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Vymazať voľbu?</h3>
            <p className="text-sm text-gray-500 mb-6">Táto akcia je nevratná.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModifierId(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušiť</button>
              <button onClick={handleDeleteModifier} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {isPending ? "Mažem..." : "Vymazať"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CategoryItemsClient({ items: initial, categoryId, venueId, modifierGroups, modifiers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [modifiersItem, setModifiersItem] = useState<MenuItem | null>(null)
  const [error, setError] = useState("")

  function refresh() { router.refresh() }

  const handleCreate = (formData: FormData) => {
    setError("")
    startTransition(async () => {
      const result = await createMenuItem(formData)
      if (result?.error) { setError(result.error); return }
      setCreateOpen(false)
      refresh()
    })
  }

  const handleUpdate = (formData: FormData) => {
    if (!editItem) return
    setError("")
    startTransition(async () => {
      const result = await updateMenuItem(editItem.id, formData)
      if (result?.error) { setError(result.error); return }
      setEditItem(null)
      refresh()
    })
  }

  const handleDelete = () => {
    if (!deleteId) return
    startTransition(async () => {
      await deleteMenuItem(deleteId, categoryId)
      setDeleteId(null)
      refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-500 text-sm">{initial.length} položiek</p>
        <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
          <Dialog.Trigger asChild>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
              style={{ backgroundColor: "var(--brand-orange)" }}
            >
              <Plus size={16} />
              Nová položka
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <Dialog.Title className="font-semibold text-gray-900">Nová položka</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </Dialog.Close>
              </div>
              <form action={handleCreate} className="p-6 space-y-4">
                <ItemFormFields key="create" categoryId={categoryId} venueId={venueId} />
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

      {initial.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Zatiaľ žiadne položky. Pridajte prvú položku.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Položka</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cena</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stanica</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stav</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dostupnosť</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Donáška</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Modifikátory</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {initial.map((item) => {
                const groupCount = modifierGroups.filter(g => g.item_id === item.id).length
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <ImageOff size={16} className="text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(Number(item.base_price))}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const s = (item as any).station ?? "kitchen"
                        const map: Record<string, { label: string; bg: string; text: string }> = {
                          kitchen: { label: "Kuchyňa", bg: "bg-orange-100", text: "text-orange-700" },
                          bar:     { label: "Bar",     bg: "bg-blue-100",   text: "text-blue-700" },
                          waiter:  { label: "Čašník",  bg: "bg-gray-100",   text: "text-gray-600" },
                        }
                        const { label, bg, text } = map[s] ?? map.kitchen
                        return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bg} ${text}`}>{label}</span>
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {item.is_active ? "Aktívna" : "Neaktívna"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.is_available ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-600"}`}>
                        {item.is_available ? "Dostupná" : "Nedostupná"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(item as any).available_for_delivery !== false ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Áno</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Nie</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setModifiersItem(item)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          groupCount > 0
                            ? "border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100"
                            : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <SlidersHorizontal size={12} />
                        {groupCount > 0 ? `${groupCount} ${groupCount === 1 ? "skupina" : groupCount < 5 ? "skupiny" : "skupín"}` : "Pridať"}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setError(""); setEditItem(item) }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modifier manager */}
      {modifiersItem && (
        <ModifierManagerDialog
          item={modifiersItem}
          categoryId={categoryId}
          venueId={venueId}
          groups={modifierGroups}
          modifiers={modifiers}
          onClose={() => setModifiersItem(null)}
        />
      )}

      {/* Edit dialog */}
      <Dialog.Root open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <Dialog.Title className="font-semibold text-gray-900">Upraviť položku</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </Dialog.Close>
            </div>
            {editItem && (
              <form action={handleUpdate} className="p-6 space-y-4">
                <ItemFormFields key={editItem.id} item={editItem} categoryId={categoryId} venueId={venueId} />
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
            <Dialog.Title className="font-semibold text-gray-900 mb-2">Vymazať položku?</Dialog.Title>
            <p className="text-sm text-gray-500 mb-6">Táto akcia je nevratná.</p>
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
