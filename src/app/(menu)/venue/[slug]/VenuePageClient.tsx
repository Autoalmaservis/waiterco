"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft, MapPin, Phone, Star, UtensilsCrossed, Wine, Coffee,
  ChevronDown, AlertTriangle, Tag, Plus, Minus, X, Check,
  ShoppingCart, ChevronRight, Truck, Package, QrCode, Loader2, CheckCircle2,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { getCategoryEmoji } from "@/lib/category-emoji"
import { placeDeliveryOrder, type DeliveryInfo } from "./actions"

type MenuItem = {
  id: string; category_id: string; name: string; description: string | null
  image_url: string | null; base_price: number; is_available: boolean
  allergens: string[]; tags: string[]; station: string
}
type Category = { id: string; name: string; description: string | null; sort_order: number }
type ModifierGroupRow = { id: string; item_id: string; name: string; min_select: number; max_select: number; sort_order: number }
type ModifierRow = { id: string; group_id: string; name: string; price: number; is_available: boolean; sort_order: number }
type CartModifier = { modifierId: string; name: string; price: number }
type CartItem = {
  cartId: string; menuItemId: string; name: string; basePrice: number
  quantity: number; modifiers: CartModifier[]; station: string
}
type VenueInfo = {
  id: string; name: string; slug: string; type: string
  description: string | null; logo_url: string | null; cover_image_url: string | null
  address: string | null; city: string | null; country: string
  phone: string | null; website: string | null
  currency: string; primary_color: string | null
  is_open: boolean; closed_reason: string | null
}
type Props = {
  venue: VenueInfo; categories: Category[]; items: MenuItem[]
  modifierGroups: ModifierGroupRow[]; modifiers: ModifierRow[]
  avgRating: number | null; reviewCount: number
}

const typeLabel: Record<string, string> = {
  restaurant: "Reštaurácia", bar: "Bar", cafe: "Kaviareň", hotel: "Hotel",
}
const typeIcon: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed, bar: Wine, cafe: Coffee, hotel: Coffee,
}

export default function VenuePageClient({ venue, categories, items, modifierGroups, modifiers, avgRating, reviewCount }: Props) {
  const brand = venue.primary_color ?? "#E85B1A"
  const Icon = typeIcon[venue.type] ?? Coffee

  const [activeTab, setActiveTab] = useState<"menu" | "info">("menu")
  const [menuView, setMenuView] = useState<"categories" | "items">("categories")
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "")
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null)
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null)
  const [orderMode, setOrderMode] = useState<"delivery" | "takeaway" | null>(null)
  const [pressId, setPressId] = useState<string | null>(null)

  function hasModifiers(itemId: string) { return modifierGroups.some(g => g.item_id === itemId) }
  function itemGroupsFor(itemId: string) {
    return modifierGroups.filter(g => g.item_id === itemId).sort((a, b) => a.sort_order - b.sort_order)
  }

  function addSimple(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.cartId === item.id)
      if (existing) return prev.map(c => c.cartId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { cartId: item.id, menuItemId: item.id, name: item.name, basePrice: item.base_price, quantity: 1, modifiers: [], station: item.station }]
    })
  }
  function addWithModifiers(item: MenuItem, selectedModifiers: CartModifier[], qty: number) {
    setCart(prev => [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, name: item.name, basePrice: item.base_price, quantity: qty, modifiers: selectedModifiers, station: item.station }])
    setPickerItem(null)
  }
  function changeQty(cartId: string, delta: number) {
    setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0))
  }
  function cartQtyFor(itemId: string) {
    return cart.filter(c => c.menuItemId === itemId && c.modifiers.length === 0).reduce((s, c) => s + c.quantity, 0)
  }
  const cartTotal = cart.reduce((s, c) => s + (c.basePrice + c.modifiers.reduce((ms, m) => ms + m.price, 0)) * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover image */}
      <div className="relative h-52">
        {venue.cover_image_url ? (
          <img src={venue.cover_image_url} alt={venue.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${brand}20` }}>
            <Icon size={52} style={{ color: brand }} className="opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <Link href="/restaurants"
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </Link>
        {!venue.is_open && (
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold">
            Zatvorené
          </div>
        )}
      </div>

      {/* Venue info strip */}
      <div className="bg-white border-b border-gray-100 px-4 pb-4 -mt-8 relative">
        <div className="max-w-lg mx-auto">
          <div className="flex items-end gap-3 mb-3">
            {venue.logo_url ? (
              <img src={venue.logo_url} alt={venue.name} className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-md shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-md flex items-center justify-center shrink-0 bg-white" style={{ color: brand }}>
                <Icon size={28} />
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-bold text-gray-900 text-xl leading-tight">{venue.name}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-xs text-gray-400">{typeLabel[venue.type] ?? venue.type}</span>
                {venue.city && (
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <MapPin size={10} />{venue.city}
                  </span>
                )}
                {avgRating !== null && (
                  <span className="text-xs flex items-center gap-0.5 text-amber-500 font-medium">
                    <Star size={10} fill="currentColor" />{avgRating.toFixed(1)}
                    <span className="text-gray-400 font-normal">({reviewCount})</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          {venue.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{venue.description}</p>
          )}

          {/* Order mode selector */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => setOrderMode("delivery")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-colors"
              style={orderMode === "delivery" ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` } : { borderColor: "#e5e7eb", color: "#6b7280" }}
            >
              <Truck size={18} />
              Donáška
            </button>
            <button
              onClick={() => setOrderMode("takeaway")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-colors"
              style={orderMode === "takeaway" ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` } : { borderColor: "#e5e7eb", color: "#6b7280" }}
            >
              <Package size={18} />
              Takeaway
            </button>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-200 text-xs font-semibold text-gray-400">
              <QrCode size={18} />
              Na stole
            </div>
          </div>
          {orderMode && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              {orderMode === "delivery" ? "Pridajte položky do košíka a vyplňte adresu doručenia." : "Pridajte položky do košíka a odoberte si pri pokladni."}
            </p>
          )}
        </div>
      </div>

      {/* Sticky orange header */}
      <div className="sticky top-0 z-30 shadow-sm" style={{ backgroundColor: brand }}>
        {/* Row 1: back + name + cart */}
        <div className="max-w-lg mx-auto px-3 h-12 flex items-center gap-2">
          <Link href="/restaurants"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {venue.logo_url && (
              <img src={venue.logo_url} alt={venue.name} className="w-6 h-6 rounded-lg object-cover shrink-0" />
            )}
            <span className="font-bold text-white text-sm truncate">{venue.name}</span>
          </div>
          {/* Cart icon + total */}
          <button
            onClick={() => cartCount > 0 && setCartOpen(true)}
            className={`relative flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-all shrink-0 ${cartCount > 0 ? "gap-1.5 px-2.5 h-9 rounded-xl" : "w-9 h-9 rounded-xl"}`}
          >
            <div className="relative">
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: "white", color: brand }}>
                  {cartCount}
                </span>
              )}
            </div>
            {cartCount > 0 && (
              <span className="text-sm font-bold text-white tabular-nums">
                {formatCurrency(cartTotal, venue.currency)}
              </span>
            )}
          </button>
        </div>
        {/* Row 2: tabs */}
        <div className="max-w-lg mx-auto flex border-t border-white/20">
          {(["menu", "info"] as const).map(tab => (
            <button key={tab}
              onClick={() => { setActiveTab(tab); if (tab === "menu") setMenuView("categories") }}
              className="flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center justify-center gap-1.5"
              style={activeTab === tab ? { color: "white", borderColor: "white" } : { color: "rgba(255,255,255,0.6)", borderColor: "transparent" }}
            >
              {tab === "menu" && menuView === "items" && activeTab === "menu" && (
                <ArrowLeft size={14} onClick={e => { e.stopPropagation(); setMenuView("categories") }} />
              )}
              {tab === "menu" ? (menuView === "items" && activeTab === "menu" ? categories.find(c => c.id === activeCategoryId)?.name ?? "Menu" : "Menu") : "Informácie"}
            </button>
          ))}
        </div>
      </div>

      {/* Category tiles */}
      {activeTab === "menu" && menuView === "categories" && (
        <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id)
              if (catItems.length === 0) return null
              const firstImage = catItems.find(i => i.image_url)?.image_url ?? null
              return (
                <button key={cat.id}
                  onClick={() => { setPressId(cat.id); setTimeout(() => setPressId(null), 320); setActiveCategoryId(cat.id); setMenuView("items") }}
                  className={`relative rounded-2xl overflow-hidden aspect-square flex flex-col justify-end text-left shadow-sm ${pressId === cat.id ? "animate-item-press" : ""}`}
                >
                  {firstImage ? (
                    <img src={firstImage} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${brand}18` }}>
                      <span className="animate-cat-float text-5xl select-none">{getCategoryEmoji(cat.name)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="relative p-3">
                    <p className="text-white font-bold text-base leading-tight">{cat.name}</p>
                    <p className="text-white/70 text-xs mt-0.5">{catItems.length} {catItems.length === 1 ? "položka" : catItems.length < 5 ? "položky" : "položiek"}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Items in selected category */}
      {activeTab === "menu" && menuView === "items" && (
        <div className="max-w-lg mx-auto pb-28">
          {categories.find(c => c.id === activeCategoryId)?.description && (
            <p className="text-gray-500 text-sm px-4 pt-4">{categories.find(c => c.id === activeCategoryId)?.description}</p>
          )}
          <div className="space-y-2 px-4 pt-4">
            {items.filter(i => i.category_id === activeCategoryId).map(item => {
              const qty = cartQtyFor(item.id)
              const withMods = hasModifiers(item.id)
              return (
                <div key={item.id}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${!item.is_available ? "opacity-60" : ""}`}>
                  <button className="w-full text-left"
                    onClick={() => { if (!item.is_available) return; if (withMods) setPickerItem(item); else setDetailItem(item) }}
                    disabled={!item.is_available}
                  >
                    <div className="flex gap-3 p-3">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
                        {item.description && <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{item.description}</p>}
                        {item.allergens?.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                            <span className="text-amber-600 text-[10px]">{item.allergens.join(", ")}</span>
                          </div>
                        )}
                        {withMods && (
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">
                            <ChevronDown size={10} />Možnosti výberu
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center justify-between px-3 pb-3">
                    <span className="font-bold text-sm" style={{ color: brand }}>{formatCurrency(item.base_price, venue.currency)}</span>
                    {!item.is_available ? (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Nedostupné</span>
                    ) : withMods ? (
                      <button onClick={() => setPickerItem(item)} className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold" style={{ backgroundColor: brand }}>Vybrať</button>
                    ) : qty === 0 ? (
                      <button onClick={e => { e.stopPropagation(); addSimple(item) }} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: brand }}>
                        <Plus size={16} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); changeQty(item.id, -1) }} className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ borderColor: brand, color: brand }}><Minus size={14} /></button>
                        <span className="text-sm font-bold w-4 text-center text-gray-900">{qty}</span>
                        <button onClick={e => { e.stopPropagation(); addSimple(item) }} className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: brand }}><Plus size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info tab */}
      {activeTab === "info" && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
          {venue.address && (
            <InfoCard icon={<MapPin size={16} className="text-gray-400" />} label="Adresa">
              {venue.address}{venue.city ? `, ${venue.city}` : ""}
            </InfoCard>
          )}
          {venue.phone && (
            <InfoCard icon={<Phone size={16} className="text-gray-400" />} label="Telefón">
              <a href={`tel:${venue.phone}`} className="text-blue-600">{venue.phone}</a>
            </InfoCard>
          )}
          {avgRating !== null && (
            <InfoCard icon={<Star size={16} className="text-amber-400" fill="currentColor" />} label="Hodnotenie">
              {avgRating.toFixed(1)} / 5 ({reviewCount} hodnotení)
            </InfoCard>
          )}
        </div>
      )}

      {/* Fixed bottom bar — 3 sections: order mode | cart | placeholder */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-3 pb-6" style={{ backgroundColor: brand }}>
        <div className="max-w-lg mx-auto flex items-stretch gap-2">

          {/* Left: order mode indicator */}
          <button
            onClick={() => setCartOpen(true)}
            className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0"
          >
            {orderMode === "delivery"
              ? <Truck size={20} className="text-white" />
              : orderMode === "takeaway"
                ? <Package size={20} className="text-white" />
                : <UtensilsCrossed size={20} className="text-white/50" />
            }
            <span className="text-[9px] text-white/70 font-medium leading-none">
              {orderMode === "delivery" ? "Donáška" : orderMode === "takeaway" ? "Takeaway" : "Typ"}
            </span>
          </button>

          {/* Center: cart */}
          <button
            onClick={() => cartCount > 0 && setCartOpen(true)}
            disabled={cartCount === 0}
            className="flex-1 flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white active:scale-[0.98] transition-all disabled:opacity-70"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
                style={{ backgroundColor: cartCount > 0 ? brand : "#9ca3af" }}
              >
                {cartCount}
              </div>
              <span className={`font-semibold text-sm ${cartCount > 0 ? "text-gray-900" : "text-gray-400"}`}>
                {cartCount === 0 ? "Košík je prázdny" : "Zobraziť košík"}
              </span>
            </div>
            <span className="font-black text-sm" style={{ color: cartCount > 0 ? brand : "#9ca3af" }}>
              {formatCurrency(cartTotal, venue.currency)}
            </span>
          </button>

          {/* Right: QR / scan hint */}
          <button
            onClick={() => window.location.href = "/restaurants"}
            className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0"
          >
            <QrCode size={20} className="text-white/60" />
            <span className="text-[9px] text-white/60 font-medium leading-none">Na stole</span>
          </button>

        </div>
      </div>

      {/* Picker sheet */}
      {pickerItem && (
        <ModifierPickerSheet
          item={pickerItem}
          groups={itemGroupsFor(pickerItem.id)}
          modifiers={modifiers}
          brandColor={brand}
          currency={venue.currency}
          onConfirm={(mods, qty) => addWithModifiers(pickerItem, mods, qty)}
          onClose={() => setPickerItem(null)}
        />
      )}

      {/* Detail sheet */}
      {detailItem && (
        <ItemDetailSheet
          item={detailItem}
          brandColor={brand}
          currency={venue.currency}
          qty={cartQtyFor(detailItem.id)}
          onAdd={() => addSimple(detailItem)}
          onRemove={() => changeQty(detailItem.id, -1)}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Cart / order sheet */}
      {cartOpen && (
        <DeliveryCartSheet
          cart={cart}
          brandColor={brand}
          currency={venue.currency}
          total={cartTotal}
          venueId={venue.id}
          orderMode={orderMode}
          onOrderModeChange={setOrderMode}
          onChangeQty={changeQty}
          onClose={() => setCartOpen(false)}
          onSuccess={() => {
            setCart([])
            setCartOpen(false)
          }}
        />
      )}
    </div>
  )
}

function InfoCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800">{children}</p>
      </div>
    </div>
  )
}

function DeliveryCartSheet({ cart, brandColor, currency, total, venueId, orderMode: initialOrderMode, onOrderModeChange, onChangeQty, onClose, onSuccess }: {
  cart: CartItem[]; brandColor: string; currency: string; total: number
  venueId: string; orderMode: "delivery" | "takeaway" | null
  onOrderModeChange: (mode: "delivery" | "takeaway") => void
  onChangeQty: (cartId: string, delta: number) => void
  onClose: () => void; onSuccess: () => void
}) {
  const [orderMode, setOrderMode] = useState<"delivery" | "takeaway" | null>(initialOrderMode)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function selectMode(mode: "delivery" | "takeaway") {
    setOrderMode(mode)
    onOrderModeChange(mode)
  }

  function handleOrder() {
    if (!orderMode) { setError("Vyberte spôsob objednávky."); return }
    if (!name.trim() || !phone.trim()) { setError("Vyplňte meno a telefón."); return }
    if (orderMode === "delivery" && !address.trim()) { setError("Vyplňte adresu doručenia."); return }
    setError(null)
    startTransition(async () => {
      const info: DeliveryInfo = { type: orderMode as "delivery" | "takeaway", customerName: name.trim(), phone: phone.trim(), address: address.trim() || undefined, notes: notes.trim() || undefined }
      const orderItems = cart.map(c => ({ menuItemId: c.menuItemId, name: c.name, quantity: c.quantity, unitPrice: c.basePrice, station: c.station, modifiers: c.modifiers }))
      const { error: err } = await placeDeliveryOrder(venueId, info, orderItems)
      if (err) setError(err)
      else setSuccess(true)
    })
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
        <div className="bg-white w-full max-w-md rounded-t-3xl p-8 text-center">
          <CheckCircle2 size={52} className="text-green-500 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 text-xl mb-1">Objednávka prijatá!</h3>
          <p className="text-gray-500 text-sm mb-6">
            {orderMode === "delivery" ? "Vaša objednávka bola odoslaná. Čoskoro vás budeme kontaktovať." : "Vaša objednávka je pripravená. Príďte si ju vyzdvihnúť."}
          </p>
          <button onClick={onSuccess} className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: brandColor }}>
            Zatvoriť
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{orderMode === "delivery" ? "Donáška" : "Takeaway"}</h2>
            <p className="text-xs text-gray-400">{cart.length} položiek · {formatCurrency(total, currency)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Cart items */}
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.cartId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-gray-400">{item.modifiers.map(m => m.name).join(", ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onChangeQty(item.cartId, -1)}
                    className="w-7 h-7 rounded-full border flex items-center justify-center"
                    style={{ borderColor: brandColor, color: brandColor }}>
                    <Minus size={13} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => onChangeQty(item.cartId, 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: brandColor }}>
                    <Plus size={13} />
                  </button>
                </div>
                <span className="text-sm font-semibold text-gray-900 w-16 text-right shrink-0">
                  {formatCurrency((item.basePrice + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity, currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Order mode selector */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-2">Spôsob objednávky *</p>
            <div className="grid grid-cols-2 gap-2">
              {(["delivery", "takeaway"] as const).map(mode => (
                <button key={mode} type="button" onClick={() => selectMode(mode)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors"
                  style={orderMode === mode ? { borderColor: brandColor, color: brandColor, backgroundColor: `${brandColor}10` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {mode === "delivery" ? <><Truck size={15} />Donáška</> : <><Package size={15} />Takeaway</>}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery info form */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-1">Kontaktné údaje</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Meno a priezvisko *"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefónne číslo *" type="tel"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
            {orderMode === "delivery" && (
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresa doručenia *"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Poznámka (voliteľné)…" rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
          </div>
        </div>

        <div className="px-5 pb-8 pt-3 border-t border-gray-100 space-y-3">
          {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Spolu</span>
            <span className="font-black text-xl" style={{ color: brandColor }}>{formatCurrency(total, currency)}</span>
          </div>
          <button
            onClick={handleOrder}
            disabled={isPending || cart.length === 0}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-base disabled:opacity-60"
            style={{ backgroundColor: brandColor }}>
            {isPending ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Objednať"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemDetailSheet({ item, brandColor, currency, qty, onAdd, onRemove, onClose }: {
  item: MenuItem; brandColor: string; currency: string; qty: number
  onAdd: () => void; onRemove: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-52 object-cover" />}
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-bold text-gray-900 text-xl leading-tight">{item.name}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          {item.description && <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.description}</p>}
          {item.allergens?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-xs text-amber-700 font-medium">Alergény:</span>
              {item.allergens.map(a => (
                <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{a}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-4">
            <span className="font-black text-2xl" style={{ color: brandColor }}>{formatCurrency(item.base_price, currency)}</span>
            {qty === 0 ? (
              <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: brandColor }}>
                <Plus size={16} />Pridať
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={onRemove} className="w-9 h-9 rounded-full border-2 flex items-center justify-center" style={{ borderColor: brandColor, color: brandColor }}>
                  <Minus size={16} />
                </button>
                <span className="text-lg font-bold text-gray-900 w-6 text-center">{qty}</span>
                <button onClick={onAdd} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}>
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModifierPickerSheet({ item, groups, modifiers, brandColor, currency, onConfirm, onClose }: {
  item: MenuItem; groups: ModifierGroupRow[]; modifiers: ModifierRow[]
  brandColor: string; currency: string
  onConfirm: (mods: CartModifier[], qty: number) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)

  function groupModifiers(groupId: string) {
    return modifiers.filter(m => m.group_id === groupId).sort((a, b) => a.sort_order - b.sort_order)
  }
  function toggleMod(group: ModifierGroupRow, modId: string) {
    setSelected(prev => {
      const current = prev[group.id] ?? []
      if (current.includes(modId)) return { ...prev, [group.id]: current.filter(id => id !== modId) }
      if (group.max_select === 1) return { ...prev, [group.id]: [modId] }
      if (current.length >= group.max_select && group.max_select > 0) return prev
      return { ...prev, [group.id]: [...current, modId] }
    })
  }
  const isValid = groups.every(g => (selected[g.id]?.length ?? 0) >= g.min_select)
  const selectedMods: CartModifier[] = []
  for (const g of groups) {
    for (const modId of selected[g.id] ?? []) {
      const mod = modifiers.find(m => m.id === modId)
      if (mod) selectedMods.push({ modifierId: mod.id, name: mod.name, price: mod.price })
    }
  }
  const unitTotal = item.base_price + selectedMods.reduce((s, m) => s + m.price, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="relative shrink-0">
          {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-44 object-cover rounded-t-3xl" />}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            <X size={16} className="text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
          <h3 className="font-bold text-gray-900 text-xl mb-1">{item.name}</h3>
          {item.description && <p className="text-gray-500 text-sm mb-4">{item.description}</p>}
          {groups.map(group => (
            <div key={group.id} className="mb-5">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-semibold text-gray-900 text-sm">{group.name}</span>
                {group.min_select > 0 && <span className="text-[10px] text-red-500 font-medium">povinné</span>}
                {group.max_select > 1 && <span className="text-[10px] text-gray-400">max {group.max_select}</span>}
              </div>
              <div className="space-y-1.5">
                {groupModifiers(group.id).map(mod => {
                  const isSelected = (selected[group.id] ?? []).includes(mod.id)
                  return (
                    <button key={mod.id} onClick={() => toggleMod(group, mod.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors"
                      style={{ borderColor: isSelected ? brandColor : "#e5e7eb", backgroundColor: isSelected ? `${brandColor}10` : "white" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded flex items-center justify-center border-2 shrink-0"
                          style={{ borderColor: isSelected ? brandColor : "#d1d5db", backgroundColor: isSelected ? brandColor : "transparent" }}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm text-gray-900">{mod.name}</span>
                      </div>
                      {mod.price > 0 && <span className="text-sm text-gray-500">+{formatCurrency(mod.price, currency)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="shrink-0 px-5 pb-8 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 text-sm font-medium">Množstvo</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: brandColor, color: brandColor }}>
                <Minus size={14} />
              </button>
              <span className="text-base font-bold w-5 text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(20, q + 1))} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <button
            onClick={() => isValid && onConfirm(selectedMods, qty)}
            disabled={!isValid}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-base disabled:opacity-40"
            style={{ backgroundColor: brandColor }}>
            Pridať do košíka · {formatCurrency(unitTotal * qty, currency)}
          </button>
          {!isValid && <p className="text-center text-xs text-red-500 mt-2">Vyplňte všetky povinné možnosti</p>}
        </div>
      </div>
    </div>
  )
}
