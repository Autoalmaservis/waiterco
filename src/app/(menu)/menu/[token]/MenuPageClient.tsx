"use client"

import { useState, useTransition, useRef, useEffect, useCallback } from "react"
import {
  Bell, ShoppingCart, X, Plus, Minus, ChevronRight, Star,
  AlertTriangle, Tag, Coffee, CheckCircle2, Check, ChevronDown,
  ArrowLeft, Receipt, Share2, Globe, Clock, Loader2, User, MessageSquare,
  UtensilsCrossed, Euro, Banknote, CreditCard, Info, MapPin,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { getCategoryEmoji } from "@/lib/category-emoji"
import {
  placeCustomerOrder, callWaiter, getSessionOrders, requestBill, submitReview,
  sendWaiterMessage, getVenueReviews, type TrackingOrder, type ReviewItem,
} from "./actions"

// ─── Types ───────────────────────────────────────────────────────────────────
type CartModifier = { modifierId: string; name: string; price: number }
type CartItem = {
  cartId: string; menuItemId: string; name: string; basePrice: number
  quantity: number; modifiers: CartModifier[]; station: string
}
type ModifierGroupRow = { id: string; item_id: string; name: string; min_select: number; max_select: number; sort_order: number }
type ModifierRow = { id: string; group_id: string; name: string; price: number; is_available: boolean; sort_order: number }
type MenuItem = {
  id: string; category_id: string; name: string; description: string | null
  image_url: string | null; base_price: number; is_available: boolean
  allergens: string[]; tags: string[]; station: string
}
type Category = { id: string; name: string; description: string | null; sort_order: number }
type TableInfo = { id: string; name: string }
type VenueInfo = {
  id: string; name: string; slug: string; logo_url: string | null
  cover_image_url: string | null; address: string | null; city: string | null
  description: string | null; is_open: boolean; closed_reason: string | null
  currency: string; primary_color: string | null
  avg_rating: number | null; review_count: number
}
type Props = {
  table: TableInfo; venue: VenueInfo; categories: Category[]
  items: MenuItem[]; modifierGroups: ModifierGroupRow[]; modifiers: ModifierRow[]
  initialSessionId: string | null; initialShareToken: string | null
  initialOrders: TrackingOrder[]; initialSessionStatus: string
}

// ─── Translations ─────────────────────────────────────────────────────────────
type Lang = "sk" | "en"
const T = {
  sk: {
    menu: "Menu", myOrder: "Objednávka", waiter: "Čašník", waiterComing: "Prichádza!",
    error: "Chyba", table: "Stôl", addToCart: "Pridať do košíka", choose: "Vybrať",
    unavailable: "Nedostupné", viewCart: "Zobraziť košík", cart: "Košík",
    orderNotes: "Poznámka (alergie, špeciálne požiadavky…)", total: "Spolu",
    placeOrder: "Objednať", sending: "Odosielam…", options: "Možnosti výberu",
    quantity: "Množstvo", required: "povinné", fillRequired: "Vyplňte všetky povinné možnosti",
    allergens: "Alergény:", yourOrder: "Vaša objednávka", requestBill: "Požiadať o účet",
    callWaiter: "Zavolať čašníka", splitBill: "Rozdeliť účet",
    rateUs: "Ohodnoťte nás!", overallRating: "Celkové hodnotenie",
    food: "Jedlo", service: "Obsluha", commentPlaceholder: "Komentár (voliteľné)…",
    submitRating: "Odoslať", skipRating: "Preskočiť",
    orderNumber: "Objednávka č.", noOrders: "Zatiaľ žiadne objednávky",
    noOrdersHint: "Objednajte z menu a tu uvidíte stav.", sessionClosed: "Relácia ukončená",
    orderMore: "Objednať ďalej", billRequested: "Účet bol vyžiadaný ✓",
    people: "ľudí", perPerson: "na osobu", thankYou: "Ďakujeme za návštevu!",
    statusPending: "Prijaté", statusConfirmed: "Potvrdené", statusPreparing: "Pripravuje sa",
    statusReady: "Pripravené", statusDelivered: "Doručené", statusCancelled: "Zrušené",
    shareOrder: "Zdieľať objednávku", copied: "Skopírované!",
    ratePrompt: "Bola vám objednávka doručená? Ohodnoťte nás.",
    paymentMethod: "Spôsob platby", cash: "Hotovosť", card: "Karta",
    confirmPayment: "Potvrdiť platbu", payment: "Platba",
  },
  en: {
    menu: "Menu", myOrder: "My Order", waiter: "Waiter", waiterComing: "Coming!",
    error: "Error", table: "Table", addToCart: "Add to cart", choose: "Choose",
    unavailable: "Unavailable", viewCart: "View cart", cart: "Cart",
    orderNotes: "Note (allergies, special requests…)", total: "Total",
    placeOrder: "Order", sending: "Sending…", options: "Customise",
    quantity: "Quantity", required: "required", fillRequired: "Please complete all required options",
    allergens: "Allergens:", yourOrder: "Your Order", requestBill: "Request bill",
    callWaiter: "Call waiter", splitBill: "Split bill",
    rateUs: "Rate us!", overallRating: "Overall rating",
    food: "Food", service: "Service", commentPlaceholder: "Comment (optional)…",
    submitRating: "Submit", skipRating: "Skip",
    orderNumber: "Order #", noOrders: "No orders yet",
    noOrdersHint: "Order from the menu and track status here.", sessionClosed: "Session ended",
    orderMore: "Add more", billRequested: "Bill requested ✓",
    people: "people", perPerson: "per person", thankYou: "Thank you for your visit!",
    statusPending: "Received", statusConfirmed: "Confirmed", statusPreparing: "Preparing",
    statusReady: "Ready", statusDelivered: "Delivered", statusCancelled: "Cancelled",
    shareOrder: "Share order", copied: "Copied!",
    ratePrompt: "Did you receive your order? Please rate us.",
    paymentMethod: "Payment method", cash: "Cash", card: "Card",
    confirmPayment: "Confirm payment", payment: "Payment",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function itemStatusColor(status: string) {
  const c: Record<string, string> = {
    pending: "#9ca3af", confirmed: "#3b82f6", preparing: "#f97316",
    ready: "#22c55e", delivered: "#16a34a", cancelled: "#ef4444",
  }
  return c[status] ?? "#9ca3af"
}

function statusLabel(status: string, t: typeof T.sk) {
  const map: Record<string, string> = {
    pending: t.statusPending, confirmed: t.statusConfirmed,
    preparing: t.statusPreparing, ready: t.statusReady,
    delivered: t.statusDelivered, cancelled: t.statusCancelled,
  }
  return map[status] ?? status
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MenuPageClient({
  table, venue, categories, items, modifierGroups, modifiers,
  initialSessionId, initialShareToken, initialOrders, initialSessionStatus,
}: Props) {
  const brandColor = venue.primary_color ?? "#E85B1A"

  // UI state
  const [lang, setLang] = useState<Lang>("sk")
  const [view, setView] = useState<"categories" | "items" | "orders">("categories")
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "")
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null)
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState("")
  const [orderError, setOrderError] = useState<string | null>(null)
  const [waiterCallState, setWaiterCallState] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [isPending, startTransition] = useTransition()
  const [flashItemId, setFlashItemId] = useState<string | null>(null)

  // Cart state (loaded from localStorage)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)

  // Session + order tracking
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId)
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken)
  const [trackingOrders, setTrackingOrders] = useState<TrackingOrder[]>(initialOrders)
  const [sessionStatus, setSessionStatus] = useState(initialSessionStatus)
  const [grandTotal, setGrandTotal] = useState(initialOrders.reduce((s, o) => s + o.total_amount, 0))
  const [ratingOpen, setRatingOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [pressId, setPressId] = useState<string | null>(null)
  const [flyParticle, setFlyParticle] = useState<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null)
  const [waiterSheetOpen, setWaiterSheetOpen] = useState(false)
  const [waiterSheetMsgOpen, setWaiterSheetMsgOpen] = useState(false)
  const [waiterMessage, setWaiterMessage] = useState("")
  const [billState, setBillState] = useState<"idle" | "pending" | "done">("idle")
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [manualRatingOpen, setManualRatingOpen] = useState(false)
  const [venueInfoOpen, setVenueInfoOpen] = useState(false)
  const cartBtnRef = useRef<HTMLButtonElement>(null)
  const [ratingDone, setRatingDone] = useState(false)
  const prevSessionStatus = useRef(initialSessionStatus)

  // Scroll spy refs
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const navRef = useRef<HTMLDivElement | null>(null)
  const manualScroll = useRef(false)
  const manualScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const storedLang = localStorage.getItem("ew-lang") as Lang | null
    if (storedLang) setLang(storedLang)

    const storedCart = localStorage.getItem(`ew-cart-${table.id}`)
    if (storedCart) {
      try { setCart(JSON.parse(storedCart)) } catch { /* ignore */ }
    }
    setCartLoaded(true)

    const storedSession = localStorage.getItem(`ew-session-${table.id}`)
    if (storedSession && !initialSessionId) {
      setSessionId(storedSession)
    }

    const storedRatingDone = localStorage.getItem(`ew-rated-${table.id}`)
    if (storedRatingDone) setRatingDone(true)
  }, []) // eslint-disable-line

  // Save lang to localStorage
  useEffect(() => {
    if (cartLoaded) localStorage.setItem("ew-lang", lang)
  }, [lang, cartLoaded])

  // Save cart to localStorage
  useEffect(() => {
    if (cartLoaded) localStorage.setItem(`ew-cart-${table.id}`, JSON.stringify(cart))
  }, [cart, cartLoaded, table.id])

  // Save sessionId to localStorage
  useEffect(() => {
    if (!cartLoaded) return
    if (sessionId) {
      localStorage.setItem(`ew-session-${table.id}`, sessionId)
    } else {
      localStorage.removeItem(`ew-session-${table.id}`)
    }
  }, [sessionId, cartLoaded, table.id])

  // Poll orders every 10s when sessionId exists
  const pollOrders = useCallback(async () => {
    if (!sessionId) return
    const result = await getSessionOrders(sessionId)
    setTrackingOrders(result.orders)
    setSessionStatus(result.sessionStatus)
    setShareToken(result.shareToken)
    setGrandTotal(result.grandTotal)

    if (prevSessionStatus.current !== "closed" && result.sessionStatus === "closed") {
      if (!ratingDone) setRatingOpen(true)
    }
    prevSessionStatus.current = result.sessionStatus
  }, [sessionId, ratingDone])

  useEffect(() => {
    if (!sessionId) return
    pollOrders()
    const interval = setInterval(pollOrders, 10000)
    return () => clearInterval(interval)
  }, [sessionId, pollOrders])

  // Scroll spy
  useEffect(() => {
    let raf: number | null = null
    function handleScroll() {
      if (manualScroll.current || view !== "items") return
      if (!Object.values(categoryRefs.current).some(Boolean)) return
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        let activeId = categories[0]?.id ?? ""
        for (const cat of categories) {
          const el = categoryRefs.current[cat.id]
          if (!el) continue
          if (el.getBoundingClientRect().top <= 120) activeId = cat.id
        }
        setActiveCategoryId(prev => prev === activeId ? prev : activeId)
      })
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => { window.removeEventListener("scroll", handleScroll); if (raf) cancelAnimationFrame(raf) }
  }, [categories, view])

  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-cat="${activeCategoryId}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [activeCategoryId])

  function scrollToCategory(catId: string) {
    manualScroll.current = true
    setActiveCategoryId(catId)
    categoryRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" })
    if (manualScrollTimer.current) clearTimeout(manualScrollTimer.current)
    manualScrollTimer.current = setTimeout(() => { manualScroll.current = false }, 1000)
  }

  // Cart helpers
  function hasModifiers(itemId: string) { return modifierGroups.some(g => g.item_id === itemId) }
  function itemGroupsFor(itemId: string) {
    return modifierGroups.filter(g => g.item_id === itemId).sort((a, b) => a.sort_order - b.sort_order)
  }
  function handleItemClick(item: MenuItem) {
    if (!item.is_available) return
    if (hasModifiers(item.id)) setPickerItem(item)
    else setDetailItem(item)
  }
  function triggerFly(srcX: number, srcY: number) {
    const cartRect = cartBtnRef.current?.getBoundingClientRect()
    if (!cartRect) return
    setFlyParticle({ fromX: srcX, fromY: srcY, toX: cartRect.left + cartRect.width / 2, toY: cartRect.top + cartRect.height / 2 })
    setTimeout(() => setFlyParticle(null), 560)
  }
  function addSimple(item: MenuItem, e?: React.MouseEvent) {
    setCart(prev => {
      const existing = prev.find(c => c.cartId === item.id)
      if (existing) return prev.map(c => c.cartId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { cartId: item.id, menuItemId: item.id, name: item.name, basePrice: item.base_price, quantity: 1, modifiers: [], station: item.station }]
    })
    setFlashItemId(item.id)
    setTimeout(() => setFlashItemId(null), 700)
    if (e) triggerFly(e.clientX, e.clientY)
  }
  function addWithModifiers(item: MenuItem, selectedModifiers: CartModifier[], qty: number, srcY?: number) {
    setCart(prev => [...prev, {
      cartId: crypto.randomUUID(), menuItemId: item.id, name: item.name,
      basePrice: item.base_price, quantity: qty, modifiers: selectedModifiers, station: item.station,
    }])
    setFlashItemId(item.id)
    setTimeout(() => setFlashItemId(null), 700)
    setPickerItem(null)
    const cartRect = cartBtnRef.current?.getBoundingClientRect()
    if (cartRect) {
      const fromX = window.innerWidth / 2
      const fromY = srcY ?? window.innerHeight * 0.75
      triggerFly(fromX, fromY)
    }
  }
  function changeQty(cartId: string, delta: number) {
    setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0))
  }
  function cartQty(itemId: string) {
    return cart.filter(c => c.menuItemId === itemId && c.modifiers.length === 0).reduce((s, c) => s + c.quantity, 0)
  }
  const cartTotal = cart.reduce((s, c) => s + (c.basePrice + c.modifiers.reduce((ms, m) => ms + m.price, 0)) * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  function handlePlaceOrder() {
    setOrderError(null)
    startTransition(async () => {
      const orderItems = cart.map(c => ({
        menuItemId: c.menuItemId, name: c.name, quantity: c.quantity,
        unitPrice: c.basePrice, station: c.station, modifiers: c.modifiers,
      }))
      const { error, sessionId: newSessionId, shareToken: newShareToken } = await placeCustomerOrder(table.id, venue.id, orderItems, orderNotes.trim())
      if (error) {
        setOrderError(error)
      } else {
        setCart([])
        setOrderNotes("")
        setCartOpen(false)
        if (newSessionId) {
          setSessionId(newSessionId)
          setShareToken(newShareToken)
          await pollOrders()
        }
        setView("orders")
        setActiveCategoryId(categories[0]?.id ?? "")
      }
    })
  }

  async function handleCallWaiter() {
    if (waiterCallState === "pending") return
    setWaiterCallState("pending")
    const { error } = await callWaiter(table.id, venue.id)
    setWaiterCallState(error ? "error" : "done")
    setTimeout(() => setWaiterCallState("idle"), 3000)
  }

  async function handleBillRequest() {
    setBillState("pending")
    await requestBill(table.id, venue.id, sessionId)
    setBillState("done")
    setWaiterSheetOpen(false)
    if (!ratingDone) setTimeout(() => setRatingOpen(true), 700)
  }

  async function handlePaymentRequest(selectedIds: string[], method: "cash" | "card") {
    setBillState("pending")
    const methodLabel = method === "cash" ? t.cash : t.card
    const allItems = trackingOrders.flatMap(o => o.items.filter(i => i.status !== "cancelled"))
    const isAll = selectedIds.length >= allItems.length
    const selectedItems = allItems.filter(i => selectedIds.includes(i.id))
    const itemsNote = isAll ? "" : selectedItems.map(i => `${i.name}×${i.quantity}`).join(", ")
    const note = itemsNote ? `${methodLabel} · ${itemsNote}` : methodLabel
    await requestBill(table.id, venue.id, sessionId, note)
    setBillState("done")
    setPaymentSheetOpen(false)
    if (!ratingDone) setTimeout(() => setRatingOpen(true), 700)
  }

  const t = T[lang]

  if (!venue.is_open) return <ClosedScreen venueName={venue.name} reason={venue.closed_reason} brandColor={brandColor} />

  const activeCategory = categories.find(c => c.id === activeCategoryId)
  const categoryItems = items.filter(i => i.category_id === activeCategoryId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 shadow-sm" style={{ backgroundColor: brandColor }}>
        <div className="max-w-md mx-auto px-3 h-14 flex items-center gap-2">

          {/* Back button */}
          <button
            onClick={() => {
              if (view === "items" || view === "orders") setView("categories")
              else if (typeof window !== "undefined") window.history.back()
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Center: category name (items view) or tappable venue name */}
          {view === "items" ? (
            <div className="flex-1 min-w-0 px-1">
              <p className="font-bold text-white text-sm leading-tight truncate">{activeCategory?.name}</p>
            </div>
          ) : (
            <button
              onClick={() => setVenueInfoOpen(true)}
              className="flex-1 flex items-center gap-1.5 min-w-0 py-1 px-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors"
            >
              {venue.logo_url
                ? <img src={venue.logo_url} alt={venue.name} className="w-6 h-6 rounded-lg object-cover shrink-0" />
                : <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-white/15">
                    <Coffee size={12} className="text-white" />
                  </div>
              }
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-white text-sm leading-tight truncate">{venue.name}</span>
                  <Info size={11} className="text-white/50 shrink-0" />
                </div>
                <p className="text-white/70 text-[10px] font-medium leading-none mt-0.5">{t.table}: {table.name}</p>
              </div>
            </button>
          )}

          {/* User / profile */}
          <button
            onClick={() => setUserMenuOpen(true)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors shrink-0"
          >
            <User size={20} />
            {sessionId && trackingOrders.length > 0 && sessionStatus !== "closed" && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: "#e11d48" }}
              >
                {trackingOrders.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Category tiles view */}
      {view === "categories" && (
        <div className="max-w-md mx-auto px-4 pt-5 pb-28">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3 px-1">{t.menu}</p>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => {
              const catItemCount = items.filter(i => i.category_id === cat.id).length
              if (catItemCount === 0) return null
              const catItems = items.filter(i => i.category_id === cat.id)
              const firstImage = catItems.find(i => i.image_url)?.image_url ?? null
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setPressId(cat.id)
                    setTimeout(() => setPressId(null), 320)
                    setActiveCategoryId(cat.id)
                    setView("items")
                  }}
                  className={`relative rounded-2xl overflow-hidden aspect-square flex flex-col justify-end text-left shadow-sm ${pressId === cat.id ? "animate-item-press" : ""}`}
                >
                  {/* Background */}
                  {firstImage ? (
                    <img src={firstImage} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${brandColor}18` }}>
                      <span className="animate-cat-float text-5xl select-none">{getCategoryEmoji(cat.name)}</span>
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  {/* Text */}
                  <div className="relative p-3">
                    <p className="text-white font-bold text-base leading-tight">{cat.name}</p>
                    <p className="text-white/70 text-xs mt-0.5">{catItemCount} {catItemCount === 1 ? "položka" : catItemCount < 5 ? "položky" : "položiek"}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Items view — single category */}
      {view === "items" && (
        <div className="max-w-md mx-auto pb-28">
          {activeCategory?.description && (
            <div className="px-4 pt-4 pb-1">
              <p className="text-gray-500 text-sm">{activeCategory.description}</p>
            </div>
          )}
          <div className="space-y-2 px-4 pt-4">
            {categoryItems.map((item) => {
              const qty = cartQty(item.id)
              const withMods = hasModifiers(item.id)
              return (
                <div key={item.id}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${!item.is_available ? "opacity-60" : ""}`}
                  style={{ borderColor: flashItemId === item.id ? "#22c55e" : "#f3f4f6", boxShadow: flashItemId === item.id ? "0 0 0 2px #22c55e33" : undefined }}
                >
                  <button className="w-full text-left" onClick={() => handleItemClick(item)} disabled={!item.is_available}>
                    <div className="flex gap-3 p-3">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
                        {item.description && (
                          <p className="text-gray-500 text-xs mt-0.5 line-clamp-2 leading-snug">{item.description}</p>
                        )}
                        {item.allergens?.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                            <span className="text-amber-600 text-[10px]">{item.allergens.join(", ")}</span>
                          </div>
                        )}
                        {item.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                <Tag size={8} />{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {withMods && (
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">
                            <ChevronDown size={10} />{t.options}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center justify-between px-3 pb-3">
                    <span className="font-bold text-sm" style={{ color: brandColor }}>
                      {formatCurrency(item.base_price, venue.currency)}
                    </span>
                    {!item.is_available ? (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{t.unavailable}</span>
                    ) : withMods ? (
                      <button onClick={() => setPickerItem(item)}
                        className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
                        style={{ backgroundColor: brandColor }}>
                        {t.choose}
                      </button>
                    ) : qty === 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); setPressId(item.id); setTimeout(() => setPressId(null), 320); addSimple(item, e) }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors duration-300 ${pressId === item.id ? "animate-item-press" : ""}`}
                        style={{ backgroundColor: flashItemId === item.id ? "#22c55e" : brandColor }}>
                        {flashItemId === item.id ? <Check size={16} /> : <Plus size={16} />}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); changeQty(item.id, -1) }}
                          className="w-7 h-7 rounded-full border flex items-center justify-center"
                          style={{ borderColor: brandColor, color: brandColor }}>
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold w-4 text-center text-gray-900">{qty}</span>
                        <button onClick={(e) => { e.stopPropagation(); addSimple(item, e) }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: brandColor }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Orders view */}
      {view === "orders" && (
        <OrdersView
          orders={trackingOrders}
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          grandTotal={grandTotal}
          shareToken={shareToken}
          tableId={table.id}
          venueId={venue.id}
          brandColor={brandColor}
          currency={venue.currency}
          t={t}
          lang={lang}
          onOrderMore={() => setView("categories")}
        />
      )}

      {/* Fixed bottom bar — 4 sections: order status | € payment | cart | call waiter */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-3 pb-6" style={{ backgroundColor: brandColor }}>
        <div className="max-w-md mx-auto flex items-stretch gap-2">

          {/* Slot 1: order progress / back-to-menu */}
          {view === "orders" ? (
            <button
              onClick={() => setView("categories")}
              className="w-10 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0"
            >
              <UtensilsCrossed size={18} className="text-white" />
              <span className="text-[9px] text-white/80 font-medium leading-none">Menu</span>
            </button>
          ) : (() => {
            const allItems = trackingOrders.flatMap(o => o.items).filter(i => i.status !== "delivered" && i.status !== "cancelled")
            const hasReady = allItems.some(i => i.status === "ready")
            const hasPreparing = allItems.some(i => i.status === "preparing" || i.status === "confirmed")
            return (
              <button
                onClick={() => sessionId && setView("orders")}
                className="w-10 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0"
              >
                {!sessionId || trackingOrders.length === 0
                  ? <Receipt size={20} className="text-white/50" />
                  : hasReady
                    ? <CheckCircle2 size={20} className="text-green-300" />
                    : hasPreparing
                      ? <Loader2 size={20} className="text-white animate-spin" />
                      : <Clock size={20} className="text-white/80" />
                }
                <span className="text-[9px] text-white/70 font-medium leading-none">Stav</span>
              </button>
            )
          })()}

          {/* Slot 2: € payment */}
          <button
            onClick={() => {
              if (!sessionId || grandTotal === 0 || sessionStatus === "closed") return
              setPaymentSheetOpen(true)
            }}
            disabled={!sessionId || grandTotal === 0 || sessionStatus === "closed"}
            className="w-10 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0 disabled:opacity-40"
          >
            <Euro size={16} className="text-white" />
            <span className="text-[8px] text-white/70 font-medium leading-none">{t.payment}</span>
          </button>

          {/* Slot 3: cart (always) */}
          <button
            onClick={() => cartCount > 0 && setCartOpen(true)}
            disabled={cartCount === 0}
            className="flex-1 flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white active:scale-[0.98] transition-all disabled:opacity-70"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white transition-transform duration-200 ${flashItemId ? "scale-125" : ""}`}
                style={{ backgroundColor: cartCount > 0 ? brandColor : "#9ca3af" }}
              >
                {cartCount}
              </div>
              <span className={`font-semibold text-sm ${cartCount > 0 ? "text-gray-900" : "text-gray-400"}`}>
                {cartCount === 0 ? "Košík je prázdny" : t.viewCart}
              </span>
            </div>
            <span className="font-black text-sm" style={{ color: cartCount > 0 ? brandColor : "#9ca3af" }}>
              {formatCurrency(cartTotal, venue.currency)}
            </span>
          </button>

          {/* Slot 4: star rating / reviews */}
          <button
            onClick={() => setReviewsOpen(true)}
            className="w-10 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0"
          >
            {venue.avg_rating !== null && venue.review_count > 0 ? (
              <>
                <Star size={16} fill="white" className="text-white" />
                <span className="text-[9px] text-white font-bold leading-none">{venue.avg_rating.toFixed(1)}</span>
              </>
            ) : (
              <>
                <Star size={16} className="text-white/60" />
                <span className="text-[8px] text-white/60 font-medium leading-none">Hod.</span>
              </>
            )}
          </button>

          {/* Slot 5: waiter actions */}
          <button
            onClick={() => { setWaiterSheetOpen(true); setWaiterSheetMsgOpen(false); setWaiterMessage("") }}
            className="w-10 rounded-2xl flex flex-col items-center justify-center gap-1 bg-black/20 hover:bg-black/30 active:bg-black/35 transition-colors shrink-0"
          >
            <Bell
              size={16}
              className={`${waiterCallState === "done" ? "text-green-300" : "text-white"} ${waiterCallState === "pending" ? "animate-pulse" : ""}`}
            />
            <span className="text-[8px] text-white/70 font-medium leading-none">
              {waiterCallState === "done" ? "Ide!" : "Čašník"}
            </span>
          </button>

        </div>
      </div>

      {/* Item detail sheet */}
      {detailItem && (
        <ItemDetailSheet
          item={detailItem} brandColor={brandColor} currency={venue.currency}
          qty={cartQty(detailItem.id)} t={t}
          onAdd={() => addSimple(detailItem)}
          onRemove={() => changeQty(detailItem.id, -1)}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Modifier picker sheet */}
      {pickerItem && (
        <ModifierPickerSheet
          item={pickerItem}
          groups={itemGroupsFor(pickerItem.id)}
          modifiers={modifiers}
          brandColor={brandColor}
          currency={venue.currency}
          t={t}
          onConfirm={(mods, qty) => addWithModifiers(pickerItem, mods, qty)}
          onClose={() => setPickerItem(null)}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart} brandColor={brandColor} currency={venue.currency}
          total={cartTotal} notes={orderNotes} t={t}
          onNotesChange={setOrderNotes}
          onChangeQty={changeQty}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          isPending={isPending}
          error={orderError}
        />
      )}

      {/* User menu sheet */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setUserMenuOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-5 space-y-2">
              {/* Venue info */}
              {(venue.description || venue.address || venue.city) && (
                <div className="px-4 py-3.5 rounded-2xl bg-gray-50">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5">O prevádzke</p>
                  {venue.description && <p className="text-sm text-gray-600 leading-relaxed">{venue.description}</p>}
                  {(venue.address || venue.city) && (
                    <p className="text-xs text-gray-400 mt-1.5">{[venue.address, venue.city].filter(Boolean).join(", ")}</p>
                  )}
                </div>
              )}

              {/* Language toggle */}
              <button
                onClick={() => { setLang(l => l === "sk" ? "en" : "sk") }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center">
                    <Globe size={18} className="text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">Jazyk / Language</span>
                </div>
                <span className="text-sm font-bold px-3 py-1 rounded-lg text-white" style={{ backgroundColor: brandColor }}>
                  {lang.toUpperCase()}
                </span>
              </button>

              {/* My orders */}
              {sessionId && (
                <button
                  onClick={() => { setView("orders"); setUserMenuOpen(false) }}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center">
                      <Receipt size={18} className="text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{t.myOrder}</span>
                  </div>
                  {trackingOrders.length > 0 && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: sessionStatus === "closed" ? "#16a34a" : "#e11d48" }}
                    >
                      {trackingOrders.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiter action sheet */}
      {waiterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => { setWaiterSheetOpen(false); setWaiterSheetMsgOpen(false); setWaiterMessage("") }}>
          <div className="bg-white w-full max-w-md rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-5 space-y-2">
              <p className="text-center text-sm font-semibold text-gray-400 mb-3">Čo potrebujete?</p>

              {/* Call waiter */}
              <button
                onClick={async () => { await handleCallWaiter(); setWaiterSheetOpen(false) }}
                disabled={waiterCallState === "pending"}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}18` }}>
                  <Bell size={20} style={{ color: brandColor }} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">{t.callWaiter}</p>
                  <p className="text-xs text-gray-400">Čašník príde k vášmu stolu</p>
                </div>
                {waiterCallState === "done" && <CheckCircle2 size={18} className="text-green-500 ml-auto shrink-0" />}
              </button>

              {/* Request bill */}
              <button
                onClick={handleBillRequest}
                disabled={billState === "pending"}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-green-50">
                  <Receipt size={20} className="text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">{t.requestBill}</p>
                  <p className="text-xs text-gray-400">Priniesť účet k stolu</p>
                </div>
                {billState === "pending" && <Loader2 size={16} className="animate-spin text-gray-400 ml-auto shrink-0" />}
                {billState === "done" && <CheckCircle2 size={18} className="text-green-500 ml-auto shrink-0" />}
              </button>

              {/* Write message */}
              {!waiterSheetMsgOpen ? (
                <button
                  onClick={() => setWaiterSheetMsgOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
                    <MessageSquare size={20} className="text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 text-sm">Napísať správu</p>
                    <p className="text-xs text-gray-400">Špeciálna požiadavka pre obsluhu</p>
                  </div>
                </button>
              ) : (
                <div className="rounded-2xl bg-gray-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Správa pre obsluhu</p>
                  <textarea
                    value={waiterMessage}
                    onChange={e => setWaiterMessage(e.target.value)}
                    placeholder="Napr. Potrebujem detskú stoličku…"
                    rows={3}
                    autoFocus
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                  />
                  <button
                    onClick={async () => {
                      if (!waiterMessage.trim()) return
                      await sendWaiterMessage(table.id, venue.id, waiterMessage.trim())
                      setWaiterMessage("")
                      setWaiterSheetMsgOpen(false)
                      setWaiterSheetOpen(false)
                    }}
                    disabled={!waiterMessage.trim()}
                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
                    style={{ backgroundColor: brandColor }}
                  >
                    Odoslať správu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment sheet */}
      {paymentSheetOpen && (
        <PaymentSheet
          orders={trackingOrders}
          grandTotal={grandTotal}
          brandColor={brandColor}
          currency={venue.currency}
          t={t}
          isPending={billState === "pending"}
          onConfirm={handlePaymentRequest}
          onClose={() => setPaymentSheetOpen(false)}
        />
      )}

      {/* Venue info sheet */}
      {venueInfoOpen && (
        <VenueInfoSheet
          venue={venue}
          brandColor={brandColor}
          onClose={() => setVenueInfoOpen(false)}
        />
      )}

      {/* Reviews sheet */}
      {reviewsOpen && (
        <ReviewsSheet
          venueId={venue.id}
          brandColor={brandColor}
          t={t}
          onClose={() => setReviewsOpen(false)}
          onAddReview={() => { setReviewsOpen(false); setManualRatingOpen(true) }}
        />
      )}

      {/* Rating modal */}
      {(ratingOpen && !ratingDone || manualRatingOpen) && (
        <RatingModal
          venueName={venue.name}
          venueId={venue.id}
          sessionId={sessionId}
          brandColor={brandColor}
          t={t}
          onClose={() => { setRatingOpen(false); setManualRatingOpen(false) }}
          onDone={() => {
            setRatingDone(true)
            setRatingOpen(false)
            setManualRatingOpen(false)
            localStorage.setItem(`ew-rated-${table.id}`, "1")
          }}
        />
      )}
      {/* Fly-to-cart particle */}
      {flyParticle && (
        <div
          className="fixed z-[200] pointer-events-none animate-fly-to-cart"
          style={{
            "--fly-dx": `${flyParticle.toX - flyParticle.fromX}px`,
            "--fly-dy": `${flyParticle.toY - flyParticle.fromY}px`,
            left: `${flyParticle.fromX - 14}px`,
            top: `${flyParticle.fromY - 14}px`,
          } as React.CSSProperties}
        >
          <div className="w-7 h-7 rounded-full shadow-lg flex items-center justify-center" style={{ backgroundColor: brandColor }}>
            <ShoppingCart size={13} className="text-white" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Orders view ──────────────────────────────────────────────────────────────
function OrdersView({ orders, sessionId, sessionStatus, grandTotal, shareToken, tableId, venueId, brandColor, currency, t, lang, onOrderMore }: {
  orders: TrackingOrder[]; sessionId: string | null; sessionStatus: string
  grandTotal: number; shareToken: string | null
  tableId: string; venueId: string; brandColor: string; currency: string
  t: typeof T.sk; lang: Lang; onOrderMore: () => void
}) {
  const [splitPeople, setSplitPeople] = useState(2)
  const [copied, setCopied] = useState(false)

  function handleShare() {
    if (!shareToken) return
    const url = `${window.location.origin}/order/${shareToken}`
    if (navigator.share) {
      navigator.share({ title: t.shareOrder, url })
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const activeItems = orders.flatMap(o => o.items).filter(i => i.status !== "delivered" && i.status !== "cancelled")
  const preparingCount = activeItems.filter(i => i.status === "preparing").length
  const readyCount = activeItems.filter(i => i.status === "ready").length

  return (
    <div className="max-w-md mx-auto pb-28 pt-4 px-4 space-y-3">

      {/* Status summary */}
      {sessionStatus === "closed" ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-green-800 text-sm font-semibold">{t.sessionClosed}</p>
            <p className="text-green-600 text-xs">{t.thankYou}</p>
          </div>
        </div>
      ) : (preparingCount > 0 || readyCount > 0) && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}40`, border: "1px solid" }}>
          <Loader2 size={18} style={{ color: brandColor }} className="animate-spin shrink-0" />
          <p className="text-sm font-medium" style={{ color: brandColor }}>
            {preparingCount > 0 && `${preparingCount}× ${t.statusPreparing.toLowerCase()}`}
            {preparingCount > 0 && readyCount > 0 && " · "}
            {readyCount > 0 && `${readyCount}× ${t.statusReady.toLowerCase()}`}
          </p>
        </div>
      )}

      {/* Share button */}
      {shareToken && (
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium bg-white"
        >
          <Share2 size={14} />
          {copied ? t.copied : t.shareOrder}
        </button>
      )}

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Receipt size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">{t.noOrders}</p>
          <p className="text-xs text-gray-400 mt-1">{t.noOrdersHint}</p>
        </div>
      ) : (
        orders.map(order => (
          <OrderCard key={order.id} order={order} brandColor={brandColor} currency={currency} t={t} lang={lang} />
        ))
      )}

      {/* Split bill */}
      {sessionStatus === "active" && grandTotal > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <span>{t.splitBill}</span>
            <span className="font-normal text-gray-400 text-xs">· {formatCurrency(grandTotal, currency)} {t.total.toLowerCase()}</span>
          </h3>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => setSplitPeople(p => Math.max(2, p - 1))}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600">
              <Minus size={14} />
            </button>
            <span className="flex-1 text-center text-base font-bold text-gray-900">{splitPeople} {t.people}</span>
            <button onClick={() => setSplitPeople(p => Math.min(20, p + 1))}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600">
              <Plus size={14} />
            </button>
          </div>
          <p className="text-center text-sm text-gray-500">
            <span className="font-bold text-gray-900">{formatCurrency(grandTotal / splitPeople, currency)}</span> {t.perPerson}
          </p>
        </div>
      )}

      {/* Order more */}
      {sessionStatus === "active" && (
        <button
          onClick={onOrderMore}
          className="w-full py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: brandColor }}
        >
          <Plus size={16} />
          {t.orderMore}
        </button>
      )}
    </div>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({ order, brandColor, currency, t, lang }: {
  order: TrackingOrder; brandColor: string; currency: string; t: typeof T.sk; lang: Lang
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
        <div>
          <span className="font-bold text-gray-900 text-sm">{t.orderNumber} {order.order_number}</span>
          <span className="text-xs text-gray-400 ml-2">
            {new Date(order.created_at).toLocaleTimeString(lang === "sk" ? "sk-SK" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ color: itemStatusColor(order.status), backgroundColor: `${itemStatusColor(order.status)}18` }}
        >
          {statusLabel(order.status, t)}
        </span>
      </div>
      <div className="px-4 py-2.5 space-y-2">
        {order.items.map(item => (
          <div key={item.id} className="flex items-start gap-2">
            <div
              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.status === "preparing" ? "animate-pulse" : ""}`}
              style={{ backgroundColor: itemStatusColor(item.status) }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 leading-snug">{item.name} ×{item.quantity}</p>
              {item.modifiers.length > 0 && (
                <p className="text-xs text-gray-400 leading-snug">{item.modifiers.map(m => m.name).join(", ")}</p>
              )}
            </div>
            <span className="text-xs shrink-0 mt-0.5" style={{ color: itemStatusColor(item.status) }}>
              {statusLabel(item.status, t)}
            </span>
          </div>
        ))}
      </div>
      {order.notes && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 italic">"{order.notes}"</p>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          <Clock size={10} className="inline mr-1" />
          {new Date(order.created_at).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB")}
        </span>
        <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount, currency)}</span>
      </div>
    </div>
  )
}

// ─── Rating modal ─────────────────────────────────────────────────────────────
function RatingModal({ venueName, venueId, sessionId, brandColor, t, onClose, onDone }: {
  venueName: string; venueId: string; sessionId: string | null
  brandColor: string; t: typeof T.sk; onClose: () => void; onDone: () => void
}) {
  const [overall, setOverall] = useState(0)
  const [food, setFood] = useState(0)
  const [service, setService] = useState(0)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (overall === 0) return
    startTransition(async () => {
      await submitReview(venueId, sessionId, overall, food || null, service || null, comment)
      setSubmitted(true)
      setTimeout(onDone, 1800)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-3xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-6 pb-6">
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 size={52} className="text-green-500 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-xl">Ďakujeme! 🎉</h3>
              <p className="text-gray-500 text-sm mt-1">{venueName}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{t.rateUs}</h3>
                  <p className="text-gray-400 text-sm">{venueName}</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
              <StarRow label={t.overallRating} value={overall} onChange={setOverall} required brandColor={brandColor} />
              <StarRow label={t.food} value={food} onChange={setFood} brandColor={brandColor} />
              <StarRow label={t.service} value={service} onChange={setService} brandColor={brandColor} />
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={t.commentPlaceholder}
                rows={3}
                className="w-full mt-4 text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
              />
              <div className="flex gap-2 mt-4">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium">
                  {t.skipRating}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={overall === 0 || isPending}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                  style={{ backgroundColor: brandColor }}
                >
                  {isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : t.submitRating}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StarRow({ label, value, onChange, required, brandColor }: {
  label: string; value: number; onChange: (v: number) => void; required?: boolean; brandColor: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-400 ml-0.5 text-xs">*</span>}
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => onChange(star)} className="p-0.5">
            <Star size={22} fill={star <= value ? brandColor : "none"} stroke={star <= value ? brandColor : "#d1d5db"} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Item detail sheet ────────────────────────────────────────────────────────
function ItemDetailSheet({ item, brandColor, currency, qty, t, onAdd, onRemove, onClose }: {
  item: MenuItem; brandColor: string; currency: string; qty: number
  t: typeof T.sk; onAdd: () => void; onRemove: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[75vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-44 object-cover rounded-t-3xl" />}
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-bold text-gray-900 text-xl leading-tight">{item.name}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          {item.description && <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.description}</p>}
          {item.allergens?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-xs text-amber-700 font-medium">{t.allergens}</span>
              {item.allergens.map(a => (
                <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{a}</span>
              ))}
            </div>
          )}
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {item.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-4">
            <span className="font-black text-2xl" style={{ color: brandColor }}>{formatCurrency(item.base_price, currency)}</span>
            {qty === 0 ? (
              <button onClick={onAdd}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-white font-semibold text-sm"
                style={{ backgroundColor: brandColor }}>
                <Plus size={16} />{t.addToCart}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={onRemove} className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: brandColor, color: brandColor }}>
                  <Minus size={16} />
                </button>
                <span className="text-lg font-bold text-gray-900 w-6 text-center">{qty}</span>
                <button onClick={onAdd} className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: brandColor }}>
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

// ─── Modifier picker sheet ────────────────────────────────────────────────────
function ModifierPickerSheet({ item, groups, modifiers, brandColor, currency, t, onConfirm, onClose }: {
  item: MenuItem; groups: ModifierGroupRow[]; modifiers: ModifierRow[]
  brandColor: string; currency: string; t: typeof T.sk
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
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            <X size={16} className="text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
          <h3 className="font-bold text-gray-900 text-xl leading-tight mb-0.5">{item.name}</h3>
          {item.description && <p className="text-gray-500 text-sm leading-relaxed mb-4">{item.description}</p>}
          {groups.map(group => {
            const groupMods = groupModifiers(group.id)
            const selectedInGroup = selected[group.id] ?? []
            return (
              <div key={group.id} className="mb-5">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-semibold text-gray-900 text-sm">{group.name}</span>
                  {group.min_select > 0 && <span className="text-[10px] text-red-500 font-medium">{t.required}</span>}
                  {group.max_select > 1 && <span className="text-[10px] text-gray-400">max {group.max_select}</span>}
                </div>
                <div className="space-y-1.5">
                  {groupMods.map(mod => {
                    const isSelected = selectedInGroup.includes(mod.id)
                    return (
                      <button key={mod.id} onClick={() => toggleMod(group, mod.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors"
                        style={{ borderColor: isSelected ? brandColor : "#e5e7eb", backgroundColor: isSelected ? `${brandColor}10` : "white" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors"
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
            )
          })}
        </div>
        <div className="shrink-0 px-5 pb-8 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 text-sm font-medium">{t.quantity}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: brandColor, color: brandColor }}>
                <Minus size={14} />
              </button>
              <span className="text-base font-bold text-gray-900 w-5 text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(20, q + 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: brandColor }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <button
            onClick={() => isValid && onConfirm(selectedMods, qty)}
            disabled={!isValid}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-base transition-opacity disabled:opacity-40"
            style={{ backgroundColor: brandColor }}>
            {t.addToCart} · {formatCurrency(unitTotal * qty, currency)}
          </button>
          {!isValid && <p className="text-center text-xs text-red-500 mt-2">{t.fillRequired}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Cart drawer ──────────────────────────────────────────────────────────────
function CartDrawer({ cart, brandColor, currency, total, notes, t, onNotesChange, onChangeQty, onClose, onPlaceOrder, isPending, error }: {
  cart: CartItem[]; brandColor: string; currency: string; total: number
  notes: string; t: typeof T.sk; onNotesChange: (v: string) => void
  onChangeQty: (cartId: string, delta: number) => void
  onClose: () => void; onPlaceOrder: () => void; isPending: boolean; error: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[82vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{t.cart}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {cart.map(item => {
            const itemTotal = (item.basePrice + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity
            return (
              <div key={item.cartId} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{item.modifiers.map(m => m.name).join(", ")}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatCurrency(item.basePrice + item.modifiers.reduce((s, m) => s + m.price, 0), currency)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onChangeQty(item.cartId, -1)}
                    className="w-7 h-7 rounded-full border flex items-center justify-center"
                    style={{ borderColor: brandColor, color: brandColor }}>
                    <Minus size={13} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                  <button onClick={() => onChangeQty(item.cartId, 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: brandColor }}>
                    <Plus size={13} />
                  </button>
                </div>
                <span className="text-sm font-semibold text-gray-900 w-16 text-right shrink-0">
                  {formatCurrency(itemTotal, currency)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="px-5 pb-8 pt-3 border-t border-gray-100 space-y-3">
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder={t.orderNotes}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
          />
          {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">{t.total}</span>
            <span className="font-black text-xl" style={{ color: brandColor }}>{formatCurrency(total, currency)}</span>
          </div>
          <button
            onClick={onPlaceOrder}
            disabled={isPending || cart.length === 0}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-base transition-opacity disabled:opacity-60 active:scale-[0.98]"
            style={{ backgroundColor: brandColor }}
          >
            {isPending ? <Loader2 size={18} className="animate-spin mx-auto" /> : t.placeOrder}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment sheet ────────────────────────────────────────────────────────────
function PaymentSheet({ orders, grandTotal, brandColor, currency, t, isPending, onConfirm, onClose }: {
  orders: TrackingOrder[]; grandTotal: number
  brandColor: string; currency: string; t: typeof T.sk
  isPending: boolean
  onConfirm: (selectedIds: string[], method: "cash" | "card") => void
  onClose: () => void
}) {
  const allItems = orders.flatMap(o =>
    o.items.filter(i => i.status !== "cancelled").map(i => ({ ...i, orderNum: o.order_number, orderTime: o.created_at }))
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(() => allItems.map(i => i.id))
  const [method, setMethod] = useState<"cash" | "card">("card")

  const allSelected = selectedIds.length === allItems.length
  function toggleItem(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleAll() {
    setSelectedIds(allSelected ? [] : allItems.map(i => i.id))
  }

  const selectedTotal = allItems
    .filter(i => selectedIds.includes(i.id))
    .reduce((s, i) => s + i.unit_price * i.quantity, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-gray-900 text-lg">{t.payment}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* Select all toggle */}
          <button
            onClick={toggleAll}
            className="w-full flex items-center justify-between py-2 text-sm"
          >
            <span className="font-semibold text-gray-700">
              {allSelected ? "Zrušiť výber" : "Vybrať všetko"}
            </span>
            <div
              className="w-5 h-5 rounded flex items-center justify-center border-2 transition-colors"
              style={{ borderColor: allSelected ? brandColor : "#d1d5db", backgroundColor: allSelected ? brandColor : "transparent" }}
            >
              {allSelected && <Check size={12} className="text-white" />}
            </div>
          </button>

          {orders.map(order => {
            const orderItems = order.items.filter(i => i.status !== "cancelled")
            if (orderItems.length === 0) return null
            return (
              <div key={order.id}>
                <p className="text-xs text-gray-400 font-medium mb-1.5">
                  {t.orderNumber} {order.order_number} · {new Date(order.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <div className="space-y-1">
                  {orderItems.map(item => {
                    const isSelected = selectedIds.includes(item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors"
                        style={{ backgroundColor: isSelected ? `${brandColor}0d` : "#f9fafb" }}
                      >
                        <div
                          className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                          style={{ borderColor: isSelected ? brandColor : "#d1d5db", backgroundColor: isSelected ? brandColor : "transparent" }}
                        >
                          {isSelected && <Check size={11} className="text-white" />}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm text-gray-900 leading-snug truncate">{item.name} ×{item.quantity}</p>
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-gray-400 truncate">{item.modifiers.map(m => m.name).join(", ")}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold shrink-0" style={{ color: isSelected ? brandColor : "#9ca3af" }}>
                          {formatCurrency(item.unit_price * item.quantity, currency)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 space-y-3">
          {/* Payment method */}
          <div className="grid grid-cols-2 gap-2">
            {(["card", "cash"] as const).map(m => {
              const isActive = method === m
              const Icon = m === "card" ? CreditCard : Banknote
              const label = m === "card" ? t.card : t.cash
              return (
                <button key={m} onClick={() => setMethod(m)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-colors"
                  style={{ borderColor: isActive ? brandColor : "#e5e7eb", backgroundColor: isActive ? `${brandColor}0f` : "white" }}
                >
                  <Icon size={18} style={{ color: isActive ? brandColor : "#9ca3af" }} />
                  <span className="font-semibold text-sm" style={{ color: isActive ? brandColor : "#6b7280" }}>{label}</span>
                </button>
              )
            })}
          </div>
          {/* Total + confirm */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500">{t.total}</span>
            <span className="font-black text-lg" style={{ color: brandColor }}>{formatCurrency(selectedTotal, currency)}</span>
          </div>
          <button
            onClick={() => onConfirm(selectedIds, method)}
            disabled={isPending || selectedIds.length === 0}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
            style={{ backgroundColor: brandColor }}
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <><Euro size={18} />{t.confirmPayment}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Venue info sheet ─────────────────────────────────────────────────────────
function VenueInfoSheet({ venue, brandColor, onClose }: {
  venue: VenueInfo; brandColor: string; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-5 space-y-4">
          <div className="flex items-center gap-3">
            {venue.logo_url ? (
              <img src={venue.logo_url} alt={venue.name} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}20` }}>
                <Coffee size={24} style={{ color: brandColor }} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-lg leading-tight">{venue.name}</h3>
              {(venue.address || venue.city) && (
                <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                  <MapPin size={10} className="shrink-0" />
                  {[venue.address, venue.city].filter(Boolean).join(", ")}
                </p>
              )}
              {venue.avg_rating !== null && venue.review_count > 0 && (
                <p className="text-xs text-amber-500 flex items-center gap-0.5 mt-0.5">
                  <Star size={10} fill="currentColor" />
                  {venue.avg_rating.toFixed(1)} ({venue.review_count} hodnotení)
                </p>
              )}
            </div>
          </div>
          {venue.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{venue.description}</p>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium"
          >
            Zatvoriť
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reviews sheet ───────────────────────────────────────────────────────────
function ReviewsSheet({ venueId, brandColor, t, onClose, onAddReview }: {
  venueId: string; brandColor: string; t: typeof T.sk; onClose: () => void; onAddReview: () => void
}) {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVenueReviews(venueId).then(r => { setReviews(r); setLoading(false) })
  }, [venueId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[82vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Hodnotenia</h3>
            {!loading && reviews.length > 0 && (
              <p className="text-xs text-gray-400">{reviews.length} hodnotení</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star size={36} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Zatiaľ žiadne hodnotenia</p>
              <p className="text-gray-300 text-xs mt-1">Buďte prvý, kto ohodnotí túto reštauráciu</p>
            </div>
          ) : (
            reviews.map(r => (
              <div key={r.id} className="bg-gray-50 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={14} fill={s <= r.overall_rating ? brandColor : "none"} stroke={s <= r.overall_rating ? brandColor : "#d1d5db"} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("sk-SK")}</span>
                </div>
                {(r.food_rating || r.service_rating) && (
                  <div className="flex gap-3">
                    {r.food_rating && <span className="text-[11px] text-gray-500">{t.food}: {r.food_rating}/5</span>}
                    {r.service_rating && <span className="text-[11px] text-gray-500">{t.service}: {r.service_rating}/5</span>}
                  </div>
                )}
                {r.comment && <p className="text-sm text-gray-700 leading-snug">"{r.comment}"</p>}
              </div>
            ))
          )}
        </div>
        <div className="px-5 pb-8 pt-3 border-t border-gray-100 shrink-0">
          <button
            onClick={onAddReview}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: brandColor }}
          >
            <Star size={16} fill="white" />
            Pridať hodnotenie
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Closed screen ────────────────────────────────────────────────────────────
function ClosedScreen({ venueName, reason, brandColor }: { venueName: string; reason: string | null; brandColor: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
        <Coffee size={28} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{venueName}</h1>
      <p className="text-gray-500 text-sm mb-4">Prevádzka je momentálne zatvorená.</p>
      {reason && <p className="text-gray-400 text-xs max-w-xs">{reason}</p>}
    </div>
  )
}
