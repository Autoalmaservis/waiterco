"use client"

import { useEffect, useRef, useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Bell, Users, ShoppingBag, ChefHat, Clock, AlertCircle, Lock,
  X, CheckCircle2, UtensilsCrossed, Plus, Minus, Search, Trash2, Pencil,
  CreditCard, Banknote, Eye, GlassWater, Truck, Package, Phone,
  Receipt, MessageSquare,
} from "lucide-react"
import {
  acknowledgeWaiterCall, resolveWaiterCall, updateOrderStatus,
  markItemDelivered, markWaiterItemReady, createWaiterOrder, updateWaiterOrder,
  payItemQuantities, voidLastPayment,
} from "./actions"
import type { WaiterCallReason, WaiterCallStatus, OrderStatus, OrderItemStatus, SessionStatus } from "@/types/database"
import { formatCurrency } from "@/lib/utils"

type WaiterCallRow = {
  id: string; table_id: string; session_id: string; reason: WaiterCallReason
  custom_message: string | null; status: WaiterCallStatus; created_at: string; acknowledged_at: string | null
}
type SessionRow = {
  id: string; table_id: string; status: SessionStatus; customer_count: number | null; opened_at: string
}
type OrderRow = {
  id: string; session_id: string; table_id: string; order_number: string; round_number: number
  status: OrderStatus; total_amount: number; notes: string | null; created_at: string
  order_type?: string; customer_name?: string; customer_phone?: string; delivery_address?: string
}
type OrderItemRow = {
  id: string; order_id: string; item_id: string | null; name: string; quantity: number
  unit_price: number; total_price: number; status: OrderItemStatus; notes: string | null; station: string
}
type TableWithPos = {
  id: string; name: string; x_pos: number; y_pos: number; shape: string; capacity: number | null
}
type ZoneRow = {
  id: string; name: string; x_pos: number; y_pos: number; w: number; h: number; color: string
}
type MenuCategoryRow = { id: string; name: string; sort_order: number }
type MenuItemRow = { id: string; category_id: string; name: string; base_price: number; station: string }
type CartModifier = { modifierId: string; name: string; price: number }
type CartItem = { cartId: string; menuItemId: string; name: string; quantity: number; unitPrice: number; notes: string; station: string; modifiers: CartModifier[] }
type TabKey = "calls" | "tables" | "orders" | "kds"
type ModifierGroupRow = { id: string; item_id: string; name: string; min_select: number; max_select: number; sort_order: number }
type ModifierRow = { id: string; group_id: string; name: string; price: number; is_available: boolean; sort_order: number }
type OrderItemModifierRow = { id: string; order_item_id: string; modifier_id: string; name: string; price: number }
type RecentPaymentRow = { id: string; session_id: string; amount: number; payment_method: string; created_at: string }
type ClosedSessionRow = { id: string; table_id: string; customer_count: number | null; opened_at: string; closed_at: string }

type Props = {
  venueId: string
  permissions: string[]
  initialCalls: WaiterCallRow[]
  initialSessions: SessionRow[]
  initialClosedSessions: ClosedSessionRow[]
  initialOrders: OrderRow[]
  initialItems: OrderItemRow[]
  initialOrderItemModifiers: OrderItemModifierRow[]
  initialRecentPayments: RecentPaymentRow[]
  initialTables: TableWithPos[]
  initialZones: ZoneRow[]
  tableMap: Record<string, string>
  menuCategories: MenuCategoryRow[]
  menuItems: MenuItemRow[]
  modifierGroups: ModifierGroupRow[]
  modifiers: ModifierRow[]
}

const REASON_LABELS: Record<WaiterCallReason, string> = { help: "Pomoc", water: "Voda", bill: "Ucet", other: "Ine" }
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Caka", confirmed: "Potvrdena", preparing: "Pripravuje sa",
  ready: "Hotova", delivered: "Dorucena", cancelled: "Zrusena",
}
const ALL_TABS: { key: TabKey; icon: React.ElementType; label: string; perm: string }[] = [
  { key: "calls",  icon: Bell,           label: "Volania",    perm: "waiter_calls" },
  { key: "tables", icon: Users,          label: "Stoly",      perm: "tables" },
  { key: "orders", icon: ShoppingBag,    label: "Objednavky", perm: "orders" },
  { key: "kds",    icon: UtensilsCrossed, label: "Stav KDS",  perm: "" },
]

const FLOOR_SCALE = 0.72
const tableDim = (shape: string): [number, number] => shape === "rect" ? [90, 55] : [60, 60]

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  return `${Math.floor(diff / 3600)} hod`
}

function waiterNextStatus(s: OrderStatus, hasKitchenBarPending: boolean, hasWaiterPending: boolean): OrderStatus | null {
  if (s === "pending") return "confirmed"
  if (s === "ready" && !hasWaiterPending) return "delivered"
  if ((s === "confirmed" || s === "preparing") && !hasKitchenBarPending && !hasWaiterPending) return "delivered"
  return null
}
function waiterNextLabel(s: OrderStatus, hasKitchenBarPending: boolean, hasWaiterPending: boolean): string {
  if (s === "pending") return "Potvrdiť"
  if (s === "ready" && !hasWaiterPending) return "Doručiť"
  if ((s === "confirmed" || s === "preparing") && !hasKitchenBarPending && !hasWaiterPending) return "Doručiť"
  return ""
}

export default function WaiterClient({
  venueId, permissions, initialCalls, initialSessions, initialClosedSessions, initialOrders,
  initialItems, initialOrderItemModifiers, initialRecentPayments, initialTables, initialZones,
  tableMap, menuCategories, menuItems, modifierGroups, modifiers,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const visibleTabs = permissions.length === 0
    ? ALL_TABS
    : ALL_TABS.filter(t => !t.perm || permissions.includes(t.perm))
  const hasKds = permissions.includes("kitchen") || permissions.includes("bar")

  const [activeTab, setActiveTab] = useState<TabKey>(() => visibleTabs[0]?.key ?? "calls")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [orderTableId, setOrderTableId] = useState<string | null>(null)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [payViewTableId, setPayViewTableId] = useState<string | null>(null)
  const [checkTableId, setCheckTableId] = useState<string | null>(null)
  const [tableFilter, setTableFilter] = useState<string>("all")
  const [optimisticPaid, setOptimisticPaid] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const channel = supabase.channel("staff-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `venue_id=eq.${venueId}` }, () => { if (mounted) router.refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `venue_id=eq.${venueId}` }, () => { if (mounted) router.refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter: `venue_id=eq.${venueId}` }, () => { if (mounted) router.refresh() })
      .subscribe()
    // Polling fallback every 15 s in case the websocket drops (common on mobile)
    const poll = setInterval(() => { if (mounted) router.refresh() }, 15000)
    return () => { mounted = false; supabase.removeChannel(channel); clearInterval(poll) }
  }, [venueId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAcknowledge(id: string) {
    startTransition(async () => { await acknowledgeWaiterCall(id); router.refresh() })
  }
  function handleResolve(id: string) {
    startTransition(async () => { await resolveWaiterCall(id); router.refresh() })
  }
  function handleOrderStatus(orderId: string, next: OrderStatus) {
    startTransition(async () => { await updateOrderStatus(orderId, next); router.refresh() })
  }
  function handleMarkPaid(itemId: string) {
    setOptimisticPaid(prev => new Set([...prev, itemId]))
    startTransition(async () => { await markItemDelivered(itemId); router.refresh() })
  }
  function handleMarkWaiterItemReady(itemId: string) {
    startTransition(async () => { await markWaiterItemReady(itemId); router.refresh() })
  }
  function isItemPaid(item: OrderItemRow) {
    return item.status === "delivered" || optimisticPaid.has(item.id)
  }

  // Floor plan
  const hasFloorPlan = initialTables.length > 0 && initialTables.some(t => t.x_pos > 10 || t.y_pos > 10)
  const fpW = hasFloorPlan ? (Math.max(
    ...initialZones.map(z => z.x_pos + z.w),
    ...initialTables.map(t => t.x_pos + tableDim(t.shape)[0]),
    200
  ) * FLOOR_SCALE + 24) : 0
  const fpH = hasFloorPlan ? (Math.max(
    ...initialZones.map(z => z.y_pos + z.h),
    ...initialTables.map(t => t.y_pos + tableDim(t.shape)[1]),
    200
  ) * FLOOR_SCALE + 24) : 0

  function tableStyle(tableId: string) {
    const hasPendingCall = initialCalls.some(c => c.table_id === tableId && c.status === "pending")
    const hasActiveOrders = initialOrders.some(o => o.table_id === tableId && o.status !== "delivered")
    const hasSession = initialSessions.some(s => s.table_id === tableId)
    const hasRecentlyClosed = initialClosedSessions.some(s => s.table_id === tableId)
    if (hasPendingCall) return { bg: "#7f1d1d", text: "#fca5a5", border: "#ef4444" }
    if (hasActiveOrders) return { bg: "#78350f", text: "#fde68a", border: "#d97706" }
    if (hasSession) return { bg: "#14532d", text: "#bbf7d0", border: "#166534" }
    if (hasRecentlyClosed) return { bg: "#1e3a5f", text: "#93c5fd", border: "#3b82f6" }
    return { bg: "#1f2937", text: "#6b7280", border: "#374151" }
  }

  // Orders filter
  const activeTableIds = new Set([
    ...initialSessions.map(s => s.table_id),
    ...initialOrders.map(o => o.table_id),
  ])
  const filterableTables = initialTables.filter(t => activeTableIds.has(t.id))
  const orderPriority = (order: OrderRow): number => {
    if (order.status === "delivered" || order.status === "cancelled") return 3
    const its = initialItems.filter(i => i.order_id === order.id)
    const hasKBPending = its.some(i =>
      (i.station === "kitchen" || i.station === "bar") &&
      i.status !== "ready" && i.status !== "delivered" && i.status !== "cancelled"
    )
    const hasWaiterPending = its.some(i =>
      i.station === "waiter" &&
      i.status !== "ready" && i.status !== "delivered" && i.status !== "cancelled"
    )
    if (waiterNextStatus(order.status, hasKBPending, hasWaiterPending) !== null) return 1
    return 2
  }
  const filteredOrders = (tableFilter === "all"
    ? initialOrders
    : initialOrders.filter(o => o.table_id === tableFilter)
  ).slice().sort((a, b) => {
    const pa = orderPriority(a)
    const pb = orderPriority(b)
    if (pa !== pb) return pa - pb
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const modifiersByOrderItemId = useMemo(() => {
    const map: Record<string, OrderItemModifierRow[]> = {}
    for (const m of initialOrderItemModifiers) {
      if (!map[m.order_item_id]) map[m.order_item_id] = []
      map[m.order_item_id].push(m)
    }
    return map
  }, [initialOrderItemModifiers])

  const pendingCallCount = initialCalls.filter(c => c.status === "pending").length
  const readyOrderCount = initialOrders.filter(o => o.status === "ready").length
  const pendingOrderCount = initialOrders.filter(o => o.status === "pending").length

  const delivTakeTableIds = new Set(
    initialOrders
      .filter(o => o.order_type === "delivery" || o.order_type === "takeaway")
      .map(o => o.table_id)
  )
  const delivTakeOrders = initialOrders.filter(
    o => o.order_type === "delivery" || o.order_type === "takeaway"
  )

  // KDS status tab — orders with kitchen/bar items in progress
  const kdsItemsByOrderId = useMemo(() => {
    const map: Record<string, { kitchen: OrderItemRow[]; bar: OrderItemRow[] }> = {}
    for (const item of initialItems) {
      if (item.status === "cancelled") continue
      if (item.station !== "kitchen" && item.station !== "bar") continue
      if (!map[item.order_id]) map[item.order_id] = { kitchen: [], bar: [] }
      if (item.station === "kitchen") map[item.order_id].kitchen.push(item)
      else map[item.order_id].bar.push(item)
    }
    return map
  }, [initialItems])
  const kdsOrders = initialOrders
    .filter(o => (o.status === "confirmed" || o.status === "preparing" || o.status === "ready") && kdsItemsByOrderId[o.id])
    .slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const kdsReadyCount = kdsOrders.filter(o => {
    const its = kdsItemsByOrderId[o.id]
    const all = [...(its?.kitchen ?? []), ...(its?.bar ?? [])]
    return all.length > 0 && all.every(i => i.status === "ready" || i.status === "delivered")
  }).length
  const kdsPrepCount = kdsOrders.length - kdsReadyCount

  const prevReadyCountRef = useRef(readyOrderCount)
  useEffect(() => {
    if (readyOrderCount > prevReadyCountRef.current && visibleTabs.some(t => t.key === "orders")) {
      setActiveTab("orders")
    }
    prevReadyCountRef.current = readyOrderCount
  }, [readyOrderCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const orderTable = orderTableId ? initialTables.find(t => t.id === orderTableId) ?? null : null
  const orderSession = orderTableId ? initialSessions.find(s => s.table_id === orderTableId) ?? null : null
  const payViewOrders = payViewTableId ? initialOrders.filter(o => o.table_id === payViewTableId) : []
  const payViewItems = payViewTableId ? initialItems.filter(i => payViewOrders.some(o => o.id === i.order_id)) : []
  const payViewSession = payViewTableId ? initialSessions.find(s => s.table_id === payViewTableId) ?? null : null
  const checkOrders = checkTableId ? initialOrders.filter(o => o.table_id === checkTableId) : []
  const checkItems = checkTableId ? initialItems.filter(i => checkOrders.some(o => o.id === i.order_id)) : []
  const checkSession = checkTableId ? initialSessions.find(s => s.table_id === checkTableId) ?? null : null
  const editOrder = editOrderId ? initialOrders.find(o => o.id === editOrderId) ?? null : null
  const editOrderItems = editOrderId ? initialItems.filter(i => i.order_id === editOrderId) : []
  const editOrderTable = editOrder ? initialTables.find(t => t.id === editOrder.table_id) ?? null : null
  const editOrderSession = editOrder ? initialSessions.find(s => s.table_id === editOrder.table_id) ?? null : null

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 gap-3">
        <Lock size={36} className="opacity-30" />
        <p className="text-sm">Vasa pozicia nema priradene ziadne opravnenia.</p>
        <p className="text-xs text-gray-600">Kontaktujte spravcu prevadzky.</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl">
          {visibleTabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors relative"
              style={activeTab === key ? { backgroundColor: "var(--brand-orange)", color: "#fff" } : { color: "#9ca3af" }}
            >
              <Icon size={15} />
              {label}
              {key === "calls" && pendingCallCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {pendingCallCount}
                </span>
              )}
              {key === "orders" && (pendingOrderCount > 0 || readyOrderCount > 0) && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold animate-pulse ${pendingOrderCount > 0 ? "bg-red-500" : "bg-green-500"}`}>
                  {pendingOrderCount > 0 ? pendingOrderCount : readyOrderCount}
                </span>
              )}
              {key === "kds" && kdsOrders.length > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold ${kdsReadyCount > 0 ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}>
                  {kdsOrders.length}
                </span>
              )}
            </button>
          ))}
          {hasKds && (
            <a
              href="/staff/kds"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "#9ca3af" }}
            >
              <UtensilsCrossed size={15} />
              KDS
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* VOLANIA */}
        {activeTab === "calls" && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 pb-4 space-y-3">
              {initialCalls.length === 0 ? (
                <EmptyState icon={Bell} text="Ziadne aktivne volania" />
              ) : initialCalls.map(call => {
                const isBill = call.reason === "bill"
                const isMsg = !!call.custom_message
                const isPending_ = call.status === "pending"

                const colors = isBill
                  ? { border: "#16a34a", badge: "#052e16", badgeText: "#4ade80", icon: "#22c55e" }
                  : isMsg
                    ? { border: "#2563eb", badge: "#172554", badgeText: "#93c5fd", icon: "#60a5fa" }
                    : isPending_
                      ? { border: "#ef4444", badge: "#7f1d1d", badgeText: "#fca5a5", icon: "#ef4444" }
                      : { border: "#f59e0b", badge: "#78350f", badgeText: "#fde68a", icon: "#f59e0b" }

                const Icon = isBill ? Receipt : isMsg ? MessageSquare : Bell
                const typeLabel = isBill ? "Žiada o účet" : isMsg ? "Správa" : "Volá čašníka"

                return (
                  <div key={call.id} className="bg-gray-900 rounded-xl p-4 border"
                    style={{ borderColor: colors.border }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon size={16} style={{ color: colors.icon }} />
                          <span className="font-bold text-white text-sm">{tableMap[call.table_id] ?? "Stôl"}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: colors.badge, color: colors.badgeText }}>
                            {typeLabel}
                          </span>
                        </div>
                        {call.custom_message && (
                          <div className="bg-gray-800 rounded-lg px-3 py-2 mb-1.5">
                            <p className="text-white text-sm leading-snug">{call.custom_message}</p>
                          </div>
                        )}
                        <p className="text-gray-500 text-xs" suppressHydrationWarning>{timeAgo(call.created_at)}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {!isBill && !isMsg && isPending_ && (
                          <button onClick={() => handleAcknowledge(call.id)} disabled={isPending}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium text-yellow-300 border border-yellow-700 hover:bg-yellow-900 disabled:opacity-50 whitespace-nowrap">
                            Idem
                          </button>
                        )}
                        <button onClick={() => handleResolve(call.id)} disabled={isPending}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-green-300 border border-green-700 hover:bg-green-900 disabled:opacity-50 whitespace-nowrap">
                          Vyriešené
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* STOLY — split layout */}
        {activeTab === "tables" && (
          <div className="h-full flex overflow-hidden">
            {/* Left: table list */}
            <div className="w-52 shrink-0 border-r border-gray-800 overflow-y-auto flex flex-col">
              {initialTables.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <EmptyState icon={Users} text="Ziadne stoly" />
                </div>
              ) : initialTables.map(table => {
                const s = tableStyle(table.id)
                const session = initialSessions.find(ss => ss.table_id === table.id)
                const tableOrders = initialOrders.filter(o => o.table_id === table.id)
                return (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTableId(table.id)}
                    className="w-full border-b border-gray-800 px-3 py-3 hover:bg-gray-900 active:bg-gray-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.border }} />
                      <span className="text-white text-sm font-semibold truncate flex-1">{table.name}</span>
                      {tableOrders.length > 0 && (
                        <span className="text-orange-400 text-xs font-bold shrink-0">{tableOrders.length} obj.</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 pl-[18px]" suppressHydrationWarning>
                      {session
                        ? (session.customer_count ? `${session.customer_count} hosti · ${timeAgo(session.opened_at)}` : timeAgo(session.opened_at))
                        : "Volny stol"}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Right: floor plan */}
            <div className="flex-1 overflow-auto p-3">
              {!hasFloorPlan ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-700 text-sm gap-2">
                  <Users size={32} className="opacity-20" />
                  <p>Mapa prevadzky nie je nastavena</p>
                </div>
              ) : (
                <>
                  <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-3">
                    <div style={{ position: "relative", width: fpW, height: fpH, minWidth: "100%" }}>
                      {initialZones.map(zone => (
                        <div key={zone.id} style={{
                          position: "absolute",
                          left: zone.x_pos * FLOOR_SCALE,
                          top: zone.y_pos * FLOOR_SCALE,
                          width: zone.w * FLOOR_SCALE,
                          height: zone.h * FLOOR_SCALE,
                          backgroundColor: zone.color + "22",
                          border: `1px solid ${zone.color}44`,
                          borderRadius: 8,
                        }}>
                          <span className="text-[10px] px-1.5 pt-1 block opacity-60" style={{ color: zone.color }}>
                            {zone.name}
                          </span>
                        </div>
                      ))}
                      {initialTables.filter(t => !delivTakeTableIds.has(t.id)).map(table => {
                        const [tw, th] = tableDim(table.shape).map(d => Math.round(d * FLOOR_SCALE))
                        const s = tableStyle(table.id)
                        const session = initialSessions.find(ss => ss.table_id === table.id)
                        return (
                          <button key={table.id}
                            onClick={() => setSelectedTableId(table.id)}
                            style={{
                              position: "absolute",
                              left: Math.round(table.x_pos * FLOOR_SCALE),
                              top: Math.round(table.y_pos * FLOOR_SCALE),
                              width: tw, height: th,
                              backgroundColor: s.bg,
                              border: `1.5px solid ${s.border}`,
                              borderRadius: table.shape === "round" ? "50%" : 6,
                              display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: 1,
                            }}>
                            <span className="text-[10px] font-bold leading-none" style={{ color: s.text }}>
                              {table.name}
                            </span>
                            {session && (
                              <span className="text-[9px] opacity-70" style={{ color: s.text }}>
                                {session.customer_count ? `${session.customer_count}×` : "●"}
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {/* Delivery/takeaway orders — top-right panel, stacked */}
                      {delivTakeOrders.length > 0 && (
                        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
                          {delivTakeOrders.map(order => {
                            const isDeliv = order.order_type === "delivery"
                            return (
                              <button
                                key={order.id}
                                onClick={() => setSelectedTableId(order.table_id)}
                                style={{
                                  backgroundColor: isDeliv ? "rgba(124, 45, 18, 0.92)" : "rgba(23, 37, 84, 0.92)",
                                  border: `1.5px solid ${isDeliv ? "#ea580c" : "#2563eb"}`,
                                  borderRadius: 8,
                                  padding: "7px 10px",
                                  display: "flex", alignItems: "center", gap: 8,
                                  minWidth: 152, textAlign: "left",
                                  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                                }}
                              >
                                {isDeliv
                                  ? <Truck size={13} style={{ color: "#fb923c", flexShrink: 0 }} />
                                  : <Package size={13} style={{ color: "#93c5fd", flexShrink: 0 }} />
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ color: "white", fontSize: 11, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
                                    #{order.order_number}
                                  </p>
                                  {order.customer_name && (
                                    <p style={{ color: isDeliv ? "#fb923c" : "#93c5fd", fontSize: 10, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 108, margin: 0 }}>
                                      {order.customer_name}
                                    </p>
                                  )}
                                </div>
                                <span style={{ fontSize: 9, color: "#6b7280", flexShrink: 0 }} suppressHydrationWarning>
                                  {timeAgo(order.created_at)}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 px-1">
                    {[
                      { color: "#ef4444", label: "Volanie" },
                      { color: "#d97706", label: "Objednavky" },
                      { color: "#166534", label: "Sedenie" },
                      { color: "#374151", label: "Volny" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* OBJEDNAVKY */}
        {activeTab === "orders" && (
          <div className="h-full overflow-y-auto">
            <div className="px-4 pb-4">
              {filterableTables.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
                  <FilterChip active={tableFilter === "all"} onClick={() => setTableFilter("all")}>Vsetky</FilterChip>
                  {filterableTables.map(t => (
                    <FilterChip key={t.id} active={tableFilter === t.id} onClick={() => setTableFilter(t.id)}>
                      {t.name}
                    </FilterChip>
                  ))}
                </div>
              )}

              {filteredOrders.length === 0 ? (
                <EmptyState icon={ShoppingBag} text="Ziadne aktivne objednavky" />
              ) : tableFilter !== "all" ? (
                <div className="space-y-3">
                  {filteredOrders.map(order => {
                    const items = initialItems.filter(i => i.order_id === order.id)
                    const isOrderDelivered = order.status === "delivered"
                    const waiterItems = isOrderDelivered ? [] : items.filter(i => i.station === "waiter")
                    const kitchenItems = isOrderDelivered ? [] : items.filter(i => i.station === "kitchen")
                    const barItems = isOrderDelivered ? [] : items.filter(i => i.station === "bar")
                    const unpaidTotal = items.filter(i => !isItemPaid(i)).reduce((s, i) => s + i.total_price, 0)
                    const allPaid = items.length > 0 && items.every(i => isItemPaid(i))
                    const kitchenDone = kitchenItems.length > 0 && kitchenItems.every(i => i.status === "ready" || i.status === "delivered")
                    const barDone = barItems.length > 0 && barItems.every(i => i.status === "ready" || i.status === "delivered")
                    const isDelivOrder = order.order_type === "delivery"
                    const isTakeOrder = order.order_type === "takeaway"
                    const borderColor = isOrderDelivered ? "border-teal-800" : isDelivOrder ? "border-orange-600" : isTakeOrder ? "border-blue-600" : "border-gray-800"
                    const bgColor = isOrderDelivered ? "bg-teal-950/40" : isDelivOrder ? "bg-orange-950/40" : isTakeOrder ? "bg-blue-950/40" : "bg-gray-900"
                    return (
                      <div key={order.id} className={`rounded-xl border overflow-hidden ${bgColor} ${borderColor}`}>
                        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${borderColor}`}>
                          <div className="flex items-center gap-2">
                            <ChefHat size={14} className="text-orange-400" />
                            <span className="font-bold text-white text-sm">#{order.order_number}</span>
                            <span className="text-gray-500 text-xs">Kolo {order.round_number}</span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs" suppressHydrationWarning>{timeAgo(order.created_at)}</span>
                            {!isOrderDelivered && (
                              <button
                                onClick={e => { e.stopPropagation(); setEditOrderId(order.id) }}
                                className="p-1 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-white"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Customer info row for delivery/takeaway */}
                        {(isDelivOrder || isTakeOrder) && order.customer_name && (
                          <div className={`flex items-center gap-2 px-4 py-2 border-b text-xs ${isDelivOrder ? "bg-orange-950/30 border-orange-800/50 text-orange-300" : "bg-blue-950/30 border-blue-800/50 text-blue-300"}`}>
                            <Phone size={11} className="shrink-0" />
                            <span className="font-medium shrink-0">{order.customer_name}</span>
                            {order.customer_phone && <span className="opacity-70 shrink-0">· {order.customer_phone}</span>}
                            {isDelivOrder && order.delivery_address && <span className="opacity-60 truncate">· {order.delivery_address}</span>}
                          </div>
                        )}

                        {/* Delivered order: show all items as readonly (awaiting payment) */}
                        {isOrderDelivered && (
                          <div className="divide-y divide-teal-900/60">
                            {items.map(item => {
                              const paid = isItemPaid(item)
                              return (
                                <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 ${paid ? "opacity-40" : ""}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${paid ? "line-through text-gray-500" : "text-white"}`}>
                                      {item.quantity > 1 && <span className="text-teal-400 mr-1">{item.quantity}×</span>}
                                      {item.name}
                                    </p>
                                    {(modifiersByOrderItemId[item.id] ?? []).length > 0 && (
                                      <p className="text-gray-500 text-xs truncate">
                                        {(modifiersByOrderItemId[item.id] ?? []).map(m => m.name).join(", ")}
                                      </p>
                                    )}
                                    {item.notes && <p className="text-yellow-400 text-xs italic">{item.notes}</p>}
                                  </div>
                                  <span className={`text-sm font-semibold shrink-0 ${paid ? "text-gray-600 line-through" : "text-gray-300"}`}>
                                    {formatCurrency(item.total_price)}
                                  </span>
                                  {paid && <CheckCircle2 size={16} className="text-teal-500 shrink-0" />}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Active order: kitchen/bar summary + waiter items */}
                        {!isOrderDelivered && (
                          <>
                            {(kitchenItems.length > 0 || barItems.length > 0) && (
                              <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/50 border-b border-gray-800 text-xs">
                                {kitchenItems.length > 0 && (
                                  <span className={`flex items-center gap-1.5 font-medium ${kitchenDone ? "text-green-400" : "text-yellow-500"}`}>
                                    <ChefHat size={11} />
                                    {kitchenItems.reduce((s, i) => s + i.quantity, 0)} v kuchyni
                                    {kitchenDone ? " · Hotové ✓" : " · Čaká sa..."}
                                  </span>
                                )}
                                {barItems.length > 0 && (
                                  <span className={`flex items-center gap-1.5 font-medium ${barDone ? "text-green-400" : "text-blue-400"}`}>
                                    <GlassWater size={11} />
                                    {barItems.reduce((s, i) => s + i.quantity, 0)} v bare
                                    {barDone ? " · Hotové ✓" : " · Čaká sa..."}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="divide-y divide-gray-800">
                              {waiterItems.length === 0 && (kitchenItems.length > 0 || barItems.length > 0) && (
                                <div className="px-4 py-3 text-gray-600 text-xs italic">Žiadne položky pre čašníka</div>
                              )}
                              {waiterItems.map(item => {
                                const paid = isItemPaid(item)
                                return (
                                  <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 transition-opacity ${paid ? "opacity-40" : ""}`}>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium truncate ${paid ? "line-through text-gray-500" : "text-white"}`}>
                                        {item.quantity > 1 && <span className="text-orange-400 mr-1">{item.quantity}×</span>}
                                        {item.name}
                                      </p>
                                      {(modifiersByOrderItemId[item.id] ?? []).length > 0 && (
                                        <p className="text-gray-500 text-xs truncate">
                                          {(modifiersByOrderItemId[item.id] ?? []).map(m => m.name).join(", ")}
                                        </p>
                                      )}
                                      {item.notes && <p className="text-yellow-400 text-xs italic">{item.notes}</p>}
                                    </div>
                                    <span className="text-gray-300 text-sm font-semibold shrink-0">{formatCurrency(item.total_price)}</span>
                                    {paid ? (
                                      <CheckCircle2 size={18} className="text-teal-500 shrink-0" />
                                    ) : (
                                      <button onClick={e => { e.stopPropagation(); handleMarkPaid(item.id) }} disabled={isPending}
                                        className="text-xs px-2.5 py-1 rounded-lg font-medium text-white shrink-0 disabled:opacity-50"
                                        style={{ backgroundColor: "var(--brand-teal)" }}>
                                        Vydať
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/40 border-t border-gray-800">
                          <div>
                            <span className="text-gray-400 text-xs">Zostatok</span>
                            <span className="text-white font-bold text-sm ml-2">{formatCurrency(unpaidTotal)}</span>
                          </div>
                          {!allPaid && (
                            <button
                              onClick={e => { e.stopPropagation(); setPayViewTableId(order.table_id) }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ backgroundColor: "var(--brand-teal)" }}
                            >
                              <CreditCard size={13} />
                              Zaplatit
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredOrders.map(order => {
                    const orderItems = initialItems.filter(i => i.order_id === order.id)
                    const hasKitchenBarPending = orderItems.some(
                      i => (i.station === "kitchen" || i.station === "bar") && i.status !== "ready" && i.status !== "delivered"
                    )
                    const hasWaiterPending = orderItems.some(
                      i => i.station === "waiter" && i.status !== "ready" && i.status !== "delivered"
                    )
                    const next = waiterNextStatus(order.status, hasKitchenBarPending, hasWaiterPending)
                    const nextLabel = waiterNextLabel(order.status, hasKitchenBarPending, hasWaiterPending)
                    const isReady = order.status === "ready"
                    const isDelivered = order.status === "delivered"
                    const isWaiting = !isReady && !isDelivered && hasKitchenBarPending && (order.status === "confirmed" || order.status === "preparing")
                    const isReadyWaiterPending = isReady && hasWaiterPending
                    const waiterItems = orderItems.filter(i => i.station === "waiter" && i.status !== "cancelled")
                    const kitchenBarItems = orderItems.filter(i => (i.station === "kitchen" || i.station === "bar") && i.status !== "cancelled")
                    const isDelivOrder = order.order_type === "delivery"
                    const isTakeOrder = order.order_type === "takeaway"
                    const borderColor = isDelivOrder ? "border-orange-600" : isTakeOrder ? "border-blue-600" : isReadyWaiterPending ? "border-orange-800" : isReady ? "border-green-700" : isDelivered ? "border-teal-800" : "border-gray-800"
                    const bgColor = isDelivered ? "bg-teal-950/50" : isReady && !isReadyWaiterPending ? "bg-green-950/60" : isDelivOrder ? "bg-orange-950/40" : isTakeOrder ? "bg-blue-950/40" : "bg-gray-900"
                    return (
                      <div key={order.id} className={`rounded-xl border overflow-hidden ${bgColor} ${borderColor}`}>
                        {/* Header */}
                        <div className="relative flex items-center px-4 py-2.5 border-b border-gray-800/70">
                          {/* Left: order number */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isReadyWaiterPending && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                            {isReady && !isReadyWaiterPending && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                            {isDelivered && <span className="w-2 h-2 rounded-full bg-teal-400" />}
                            {isWaiting && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                            <span className="font-bold text-white text-sm">#{order.order_number}</span>
                          </div>
                          {/* Center: table / delivery type + status + time */}
                          <div className="flex-1 flex items-center justify-center gap-2">
                            {isDelivOrder ? (
                              <span className="flex items-center gap-1 font-black text-orange-400 text-base"><Truck size={13} />Donáška</span>
                            ) : isTakeOrder ? (
                              <span className="flex items-center gap-1 font-black text-blue-400 text-base"><Package size={13} />Takeaway</span>
                            ) : (
                              <span className="font-black text-white text-base">{tableMap[order.table_id] ?? "Stôl"}</span>
                            )}
                            <OrderStatusBadge status={order.status} />
                            <span className="text-gray-600 text-xs" suppressHydrationWarning>{timeAgo(order.created_at)}</span>
                          </div>
                          {/* Right: edit button */}
                          {!isDelivered && (
                            <button onClick={() => setEditOrderId(order.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-600 hover:text-white">
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>

                        {/* Customer info for delivery/takeaway */}
                        {(isDelivOrder || isTakeOrder) && order.customer_name && (
                          <div className={`flex items-center gap-2 px-3 py-1.5 border-b text-xs truncate ${isDelivOrder ? "bg-orange-950/30 border-orange-800/50 text-orange-300" : "bg-blue-950/30 border-blue-800/50 text-blue-300"}`}>
                            <Phone size={11} className="shrink-0" />
                            <span className="font-medium truncate">{order.customer_name}</span>
                            {order.customer_phone && <span className="opacity-70 shrink-0">· {order.customer_phone}</span>}
                            {isDelivOrder && order.delivery_address && <span className="opacity-60 truncate">· {order.delivery_address}</span>}
                          </div>
                        )}

                        {/* Two-column items */}
                        <div className="grid grid-cols-2 divide-x divide-gray-800/70">
                          {/* Čašník */}
                          <div>
                            <div className="px-3 py-1.5 flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Čašník</span>
                              {waiterItems.length > 0 && (
                                <span className="text-[10px] text-gray-700">
                                  {waiterItems.filter(i => i.status === "ready" || i.status === "delivered").length}/{waiterItems.length}
                                </span>
                              )}
                            </div>
                            {waiterItems.length === 0
                              ? <div className="px-3 pb-2.5 text-gray-700 text-xs">—</div>
                              : waiterItems.map(item => {
                                const done = item.status === "ready" || item.status === "delivered"
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => !done && handleMarkWaiterItemReady(item.id)}
                                    disabled={done || isPending}
                                    className={`w-full flex items-start gap-2 px-3 py-2 border-t border-gray-800/50 text-left ${done ? "cursor-default" : "hover:bg-gray-800/50 active:bg-gray-800"}`}
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      {item.status === "delivered"
                                        ? <CheckCircle2 size={13} className="text-teal-500" />
                                        : item.status === "ready"
                                          ? <CheckCircle2 size={13} className="text-green-400" />
                                          : <span className="block w-3.5 h-3.5 rounded border-2 border-gray-500" />
                                      }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-xs block truncate ${done ? "line-through text-gray-500" : "text-white"}`}>
                                        {item.quantity > 1 && <span className="font-bold">{item.quantity}× </span>}
                                        {item.name}
                                      </span>
                                      {(modifiersByOrderItemId[item.id] ?? []).length > 0 && (
                                        <span className="text-[10px] text-gray-600 block truncate">
                                          {(modifiersByOrderItemId[item.id] ?? []).map(m => m.name).join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                )
                              })
                            }
                          </div>

                          {/* Kuchyňa / Bar */}
                          <div>
                            <div className="px-3 py-1.5 flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Kuchyňa/Bar</span>
                              {kitchenBarItems.length > 0 && (
                                <span className="text-[10px] text-gray-700">
                                  {kitchenBarItems.filter(i => i.status === "ready" || i.status === "delivered").length}/{kitchenBarItems.length}
                                </span>
                              )}
                            </div>
                            {kitchenBarItems.length === 0
                              ? <div className="px-3 pb-2.5 text-gray-700 text-xs">—</div>
                              : kitchenBarItems.map(item => {
                                const done = item.status === "ready" || item.status === "delivered"
                                return (
                                  <div key={item.id} className="flex items-start gap-2 px-3 py-2 border-t border-gray-800/50">
                                    <div className="mt-0.5 shrink-0">
                                      {item.status === "delivered"
                                        ? <CheckCircle2 size={13} className="text-teal-500" />
                                        : item.status === "ready"
                                          ? <CheckCircle2 size={13} className="text-green-400" />
                                          : item.status === "preparing"
                                            ? <span className="block w-3.5 h-3.5 rounded-full border-2 border-yellow-500 animate-pulse" />
                                            : <span className="block w-3.5 h-3.5 rounded-full border-2 border-gray-600" />
                                      }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-xs block truncate ${done ? "line-through text-gray-500" : "text-white"}`}>
                                        {item.quantity > 1 && <span className="font-bold">{item.quantity}× </span>}
                                        {item.name}
                                      </span>
                                      {(modifiersByOrderItemId[item.id] ?? []).length > 0 && (
                                        <span className="text-[10px] text-gray-600 block truncate">
                                          {(modifiersByOrderItemId[item.id] ?? []).map(m => m.name).join(", ")}
                                        </span>
                                      )}
                                    </div>
                                    {item.station === "bar" && <span className="text-[10px] text-gray-700 shrink-0 mt-0.5">Bar</span>}
                                  </div>
                                )
                              })
                            }
                          </div>
                        </div>

                        {order.notes && (
                          <div className="px-4 py-2 border-t border-gray-800/70">
                            <p className="text-yellow-400 text-xs italic">{order.notes}</p>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-800/70">
                          <span className="text-gray-300 text-sm font-semibold">{formatCurrency(order.total_amount)}</span>
                          <div className="flex items-center gap-2">
                            {next && (
                              <button onClick={() => handleOrderStatus(order.id, next)} disabled={isPending}
                                className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                                style={{ backgroundColor: isReady && !isReadyWaiterPending ? "var(--brand-teal)" : "var(--brand-orange)" }}>
                                {nextLabel}
                              </button>
                            )}
                            <button
                              onClick={() => setPayViewTableId(order.table_id)}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                              style={{ backgroundColor: "var(--brand-teal)" }}
                            >
                              <CreditCard size={12} />
                              Zaplatiť
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAV KDS */}
        {activeTab === "kds" && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 pb-4">
              {/* Summary pills */}
              {kdsOrders.length > 0 && (
                <div className="flex gap-2 pt-4 pb-3 flex-wrap">
                  {kdsPrepCount > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-900/50 border border-yellow-700/50 text-yellow-300 text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      {kdsPrepCount} v príprave
                    </span>
                  )}
                  {kdsReadyCount > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-900/50 border border-green-700/50 text-green-300 text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      {kdsReadyCount} hotové
                    </span>
                  )}
                </div>
              )}

              {kdsOrders.length === 0 ? (
                <EmptyState icon={UtensilsCrossed} text="Kuchyňa a bar sú voľné" />
              ) : (
                <div className="space-y-3 pt-2">
                  {kdsOrders.map(order => {
                    const its = kdsItemsByOrderId[order.id]
                    const kitchenItems = its?.kitchen ?? []
                    const barItems = its?.bar ?? []
                    const allDone = [...kitchenItems, ...barItems].every(i => i.status === "ready" || i.status === "delivered")
                    const isDelivOrder = order.order_type === "delivery"
                    const isTakeOrder = order.order_type === "takeaway"
                    const borderCol = allDone ? "#166534" : "#374151"
                    return (
                      <div key={order.id} className="bg-gray-900 rounded-xl overflow-hidden border" style={{ borderColor: borderCol }}>
                        {/* Order header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                          <div className="flex items-center gap-2">
                            {allDone
                              ? <span className="w-2 h-2 rounded-full bg-green-400" />
                              : <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                            }
                            <span className="font-bold text-white text-sm">#{order.order_number}</span>
                            <span className="text-gray-500 text-xs">Kolo {order.round_number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isDelivOrder
                              ? <span className="flex items-center gap-1 text-orange-400 text-xs font-medium"><Truck size={10} />Donáška</span>
                              : isTakeOrder
                                ? <span className="flex items-center gap-1 text-blue-400 text-xs font-medium"><Package size={10} />Takeaway</span>
                                : <span className="text-gray-400 text-xs">{tableMap[order.table_id] ?? "–"}</span>
                            }
                            <span className="text-gray-600 text-xs" suppressHydrationWarning>{timeAgo(order.created_at)}</span>
                          </div>
                        </div>

                        {/* Kitchen / Bar columns */}
                        <div className={`grid divide-x divide-gray-800 ${kitchenItems.length > 0 && barItems.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                          {kitchenItems.length > 0 && (
                            <div className="p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <ChefHat size={11} className="text-orange-400" />
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Kuchyňa</span>
                                <span className="text-[10px] text-gray-700">
                                  {kitchenItems.filter(i => i.status === "ready" || i.status === "delivered").length}/{kitchenItems.length}
                                </span>
                              </div>
                              {kitchenItems.map(item => {
                                const done = item.status === "ready" || item.status === "delivered"
                                return (
                                  <div key={item.id} className="flex items-center gap-2 py-1">
                                    {item.status === "delivered"
                                      ? <CheckCircle2 size={13} className="text-teal-500 shrink-0" />
                                      : item.status === "ready"
                                        ? <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                                        : item.status === "preparing"
                                          ? <span className="w-3 h-3 rounded-full border-2 border-yellow-500 animate-pulse shrink-0" />
                                          : <span className="w-3 h-3 rounded-full border-2 border-gray-600 shrink-0" />
                                    }
                                    <span className={`text-xs truncate ${done ? "line-through text-gray-600" : "text-white"}`}>
                                      {item.quantity > 1 && <span className="font-bold">{item.quantity}× </span>}
                                      {item.name}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {barItems.length > 0 && (
                            <div className="p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <GlassWater size={11} className="text-blue-400" />
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bar</span>
                                <span className="text-[10px] text-gray-700">
                                  {barItems.filter(i => i.status === "ready" || i.status === "delivered").length}/{barItems.length}
                                </span>
                              </div>
                              {barItems.map(item => {
                                const done = item.status === "ready" || item.status === "delivered"
                                return (
                                  <div key={item.id} className="flex items-center gap-2 py-1">
                                    {item.status === "delivered"
                                      ? <CheckCircle2 size={13} className="text-teal-500 shrink-0" />
                                      : item.status === "ready"
                                        ? <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                                        : item.status === "preparing"
                                          ? <span className="w-3 h-3 rounded-full border-2 border-yellow-500 animate-pulse shrink-0" />
                                          : <span className="w-3 h-3 rounded-full border-2 border-gray-600 shrink-0" />
                                    }
                                    <span className={`text-xs truncate ${done ? "line-through text-gray-600" : "text-white"}`}>
                                      {item.quantity > 1 && <span className="font-bold">{item.quantity}× </span>}
                                      {item.name}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TABLE ACTION SHEET */}
      {selectedTableId && (
        <TableActionSheet
          tableName={tableMap[selectedTableId] ?? "Stol"}
          session={initialSessions.find(s => s.table_id === selectedTableId) ?? null}
          orders={initialOrders.filter(o => o.table_id === selectedTableId)}
          items={initialItems.filter(i => initialOrders.some(o => o.table_id === selectedTableId && o.id === i.order_id))}
          onClose={() => setSelectedTableId(null)}
          onOrder={() => { setOrderTableId(selectedTableId); setSelectedTableId(null) }}
          onPay={() => { setPayViewTableId(selectedTableId); setSelectedTableId(null) }}
          onCheck={() => { setCheckTableId(selectedTableId); setSelectedTableId(null) }}
        />
      )}

      {/* TABLE CHECK SHEET */}
      {checkTableId && (
        <TableCheckSheet
          tableName={tableMap[checkTableId] ?? "Stol"}
          session={checkSession}
          orders={checkOrders}
          items={checkItems}
          onClose={() => setCheckTableId(null)}
          onOrder={() => { setOrderTableId(checkTableId); setCheckTableId(null) }}
        />
      )}

      {/* TABLE PAY SHEET */}
      {payViewTableId && (
        <TablePaySheet
          tableName={tableMap[payViewTableId] ?? "Stol"}
          orders={payViewOrders}
          items={payViewItems}
          session={payViewSession}
          venueId={venueId}
          lastPayment={initialRecentPayments.find(p => p.session_id === payViewSession?.id) ?? null}
          onClose={() => setPayViewTableId(null)}
          onSuccess={() => { setPayViewTableId(null); router.refresh() }}
        />
      )}

      {/* ORDER CREATE SHEET */}
      {orderTable && (
        <OrderCreateSheet
          table={orderTable}
          session={orderSession}
          venueId={venueId}
          menuCategories={menuCategories}
          menuItems={menuItems}
          modifierGroups={modifierGroups}
          modifiers={modifiers}
          onClose={() => setOrderTableId(null)}
          onSuccess={() => { setOrderTableId(null); router.refresh() }}
        />
      )}

      {/* ORDER EDIT SHEET */}
      {editOrder && editOrderTable && (
        <OrderCreateSheet
          table={editOrderTable}
          session={editOrderSession}
          venueId={venueId}
          menuCategories={menuCategories}
          menuItems={menuItems}
          modifierGroups={modifierGroups}
          modifiers={modifiers}
          editOrderId={editOrder.id}
          editOrderNumber={editOrder.order_number}
          initialCart={editOrderItems
            .filter(i => i.item_id)
            .map(i => ({
              cartId: i.id,
              menuItemId: i.item_id!,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unit_price,
              notes: i.notes ?? "",
              station: (i as any).station ?? "kitchen",
              modifiers: initialOrderItemModifiers
                .filter(m => m.order_item_id === i.id)
                .map(m => ({ modifierId: m.modifier_id, name: m.name, price: m.price })),
            }))}
          onClose={() => setEditOrderId(null)}
          onSuccess={() => { setEditOrderId(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function TableActionSheet({ tableName, session, orders, items, onClose, onOrder, onPay, onCheck }: {
  tableName: string
  session: SessionRow | null
  orders: OrderRow[]
  items: OrderItemRow[]
  onClose: () => void
  onOrder: () => void
  onPay: () => void
  onCheck: () => void
}) {
  const unpaidTotal = items
    .filter(i => i.status !== "delivered" && i.status !== "cancelled")
    .reduce((s, i) => s + i.total_price, 0)
  const hasOrders = orders.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end p-3 bg-black/60" onClick={onClose}>
      <div className="w-full bg-gray-900 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-xl">{tableName}</h2>
            {session ? (
              <p className="text-gray-400 text-sm mt-0.5" suppressHydrationWarning>
                {session.customer_count ? `${session.customer_count} hosti · ` : ""}
                {timeAgo(session.opened_at)}
                {orders.length > 0 ? ` · ${orders.length} objednávk${orders.length === 1 ? "a" : orders.length < 5 ? "y" : ""}` : ""}
              </p>
            ) : (
              <p className="text-gray-500 text-sm mt-0.5">Volný stôl</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="p-4 space-y-3">
          <button
            onClick={onOrder}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold text-lg active:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            <ShoppingBag size={24} />
            Objednať
          </button>

          <button
            onClick={onPay}
            disabled={unpaidTotal === 0}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold text-lg disabled:opacity-30 active:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--brand-teal)" }}
          >
            <CreditCard size={24} />
            Zaplatit
            {unpaidTotal > 0 && (
              <span className="text-base font-semibold opacity-80 ml-1">{formatCurrency(unpaidTotal)}</span>
            )}
          </button>

          <button
            onClick={onCheck}
            disabled={!hasOrders}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-base border-2 transition-opacity active:opacity-70 disabled:opacity-25"
            style={{ borderColor: "#374151", color: "#d1d5db" }}
          >
            <Eye size={20} />
            Skontrolovať objednávku
          </button>
        </div>
      </div>
    </div>
  )
}

function TablePaySheet({ tableName, orders, items, session, venueId, lastPayment, onClose, onSuccess }: {
  tableName: string
  orders: OrderRow[]
  items: OrderItemRow[]
  session: SessionRow | null
  venueId: string
  lastPayment: RecentPaymentRow | null
  onClose: () => void
  onSuccess: () => void
}) {
  const unpaidItems = items.filter(i => i.status !== "delivered" && i.status !== "cancelled")
  const paidItems = items.filter(i => i.status === "delivered")
  const [mode, setMode] = useState<"all" | "split">("all")
  const [splitQty, setSplitQty] = useState<Map<string, number>>(new Map())
  const [step, setStep] = useState<"select" | "confirm">("select")
  const [voidConfirm, setVoidConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleVoid() {
    if (!session) return
    startTransition(async () => {
      const res = await voidLastPayment(session.id, venueId)
      if (res?.error) { setError(res.error); setVoidConfirm(false); return }
      onSuccess()
    })
  }

  function switchMode(m: "all" | "split") {
    setMode(m)
    if (m === "split") setSplitQty(new Map(unpaidItems.map(i => [i.id, 0])))
  }

  function setQty(itemId: string, qty: number, max: number) {
    setSplitQty(prev => { const n = new Map(prev); n.set(itemId, Math.min(max, Math.max(0, qty))); return n })
  }

  const allTotal = unpaidItems.reduce((s, i) => s + i.total_price, 0)
  const splitTotal = unpaidItems.reduce((s, i) => s + i.unit_price * (splitQty.get(i.id) ?? 0), 0)
  const selectedTotal = mode === "all" ? allTotal : splitTotal
  const canPay = mode === "all" ? unpaidItems.length > 0 : unpaidItems.some(i => (splitQty.get(i.id) ?? 0) > 0)

  const variableSymbol = session
    ? String(parseInt(session.id.replace(/-/g, "").substring(0, 9), 16) % 100000000).padStart(8, "0")
    : "00000000"

  function handleConfirmCash() {
    if (!session || !canPay) return
    const toPayItems = mode === "all"
      ? unpaidItems.map(i => ({ itemId: i.id, quantity: i.quantity }))
      : unpaidItems.filter(i => (splitQty.get(i.id) ?? 0) > 0).map(i => ({ itemId: i.id, quantity: splitQty.get(i.id)! }))
    setError(null)
    startTransition(async () => {
      const res = await payItemQuantities(toPayItems, session.id, venueId, selectedTotal, "cash")
      if (res?.error) { setError(res.error); return }
      onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end p-3 bg-black/60" onClick={step === "select" ? onClose : undefined}>
      <div
        className="w-full bg-gray-900 rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100dvh - 5rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {step === "select" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800 shrink-0">
              <div>
                <h2 className="text-white font-bold text-base">{tableName} · Platba</h2>
                {unpaidItems.length > 0 && (
                  <p className="text-gray-400 text-xs mt-0.5">{unpaidItems.length} položiek na zaplatenie</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => switchMode("all")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${mode === "all" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                    style={mode === "all" ? { backgroundColor: "var(--brand-teal)" } : {}}
                  >
                    Spolu
                  </button>
                  <button
                    onClick={() => switchMode("split")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${mode === "split" ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    Rozdeliť
                  </button>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
                  Žiadne položky na stole
                </div>
              ) : orders.map(order => {
                const orderUnpaid = unpaidItems.filter(i => i.order_id === order.id)
                const orderPaid = paidItems.filter(i => i.order_id === order.id)
                if (orderUnpaid.length === 0 && orderPaid.length === 0) return null
                return (
                  <div key={order.id}>
                    <div className="px-4 py-2 bg-gray-800/40 border-b border-gray-800 flex items-center gap-2">
                      <span className="text-gray-400 text-xs font-semibold">
                        #{order.order_number} · Kolo {order.round_number}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    {orderUnpaid.map(item => {
                      const qty = splitQty.get(item.id) ?? 0
                      const isSelected = mode === "split" ? qty > 0 : true
                      const displayPrice = mode === "split" ? item.unit_price * qty : item.total_price

                      return (
                        <div
                          key={item.id}
                          onClick={mode === "split" && item.quantity === 1 ? () => setQty(item.id, qty === 0 ? 1 : 0, 1) : undefined}
                          className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 transition-all ${mode === "split" && !isSelected ? "opacity-50" : ""} ${mode === "split" ? "cursor-pointer hover:bg-gray-800/50" : ""} ${mode === "split" && isSelected ? "bg-teal-950/30" : ""}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {mode === "all" && item.quantity > 1 && (
                                <span className="text-orange-400 mr-1">{item.quantity}×</span>
                              )}
                              {item.name}
                            </p>
                            {item.notes && <p className="text-yellow-400 text-xs italic">{item.notes}</p>}
                            {mode === "split" && (
                              <p className="text-gray-500 text-xs mt-0.5">{formatCurrency(item.unit_price)} / ks</p>
                            )}
                          </div>

                          {mode === "split" ? (
                            item.quantity === 1 ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-gray-600"}`}>
                                  {formatCurrency(item.unit_price)}
                                </span>
                                <button
                                  onClick={() => setQty(item.id, qty === 0 ? 1 : 0, 1)}
                                  className="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors"
                                  style={isSelected
                                    ? { backgroundColor: "var(--brand-teal)", borderColor: "var(--brand-teal)" }
                                    : { backgroundColor: "transparent", borderColor: "#4b5563" }}
                                >
                                  {isSelected && <CheckCircle2 size={13} className="text-white" />}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-semibold w-16 text-right ${qty > 0 ? "text-white" : "text-gray-600"}`}>
                                  {qty > 0 ? formatCurrency(displayPrice) : formatCurrency(item.total_price)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setQty(item.id, qty - 1, item.quantity)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors"
                                    style={{ backgroundColor: qty > 0 ? "#374151" : "#1f2937" }}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="text-white text-xs font-bold w-10 text-center tabular-nums">
                                    {qty} / {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => setQty(item.id, qty + 1, item.quantity)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors"
                                    style={{ backgroundColor: qty < item.quantity ? "#374151" : "#1f2937" }}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            <span className="text-gray-300 text-sm font-semibold shrink-0">
                              {formatCurrency(item.total_price)}
                            </span>
                          )}
                        </div>
                      )
                    })}

                    {orderPaid.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 opacity-35">
                        <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center">
                          <CheckCircle2 size={14} className="text-teal-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 text-sm line-through truncate">
                            {item.quantity > 1 && <span className="mr-1">{item.quantity}×</span>}
                            {item.name}
                          </p>
                        </div>
                        <span className="text-gray-600 text-sm line-through shrink-0">{formatCurrency(item.total_price)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-800 bg-gray-900 p-4 shrink-0 space-y-2">
              {canPay ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">
                      {mode === "split"
                        ? `${unpaidItems.filter(i => (splitQty.get(i.id) ?? 0) > 0).length} položiek`
                        : `${unpaidItems.length} položiek`}
                    </span>
                    <span className="text-white font-bold text-2xl">{formatCurrency(selectedTotal)}</span>
                  </div>
                  <button
                    onClick={() => setStep("confirm")}
                    disabled={!session}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-50 transition-opacity active:opacity-90"
                    style={{ backgroundColor: "var(--brand-teal)" }}
                  >
                    <CreditCard size={20} />
                    Pokračovať k platbe
                  </button>
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-2">
                  {mode === "split" ? "Zadajte počet položiek na zaplatenie" : "Žiadne položky na zaplatenie"}
                </p>
              )}
              {lastPayment && !voidConfirm && (
                <button
                  onClick={() => setVoidConfirm(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-medium text-red-400 border border-red-900/50 hover:bg-red-950/30 transition-colors"
                >
                  Stornovať poslednú platbu · {formatCurrency(lastPayment.amount)} ({lastPayment.payment_method === "cash" ? "hotovosť" : "karta"})
                </button>
              )}
              {lastPayment && voidConfirm && (
                <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 space-y-2">
                  <p className="text-red-300 text-xs text-center">Naozaj stornovať platbu {formatCurrency(lastPayment.amount)}?</p>
                  {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setVoidConfirm(false); setError(null) }}
                      className="flex-1 py-2 rounded-lg text-xs text-gray-400 bg-gray-800 hover:bg-gray-700"
                    >
                      Zrušiť
                    </button>
                    <button
                      onClick={handleVoid}
                      disabled={isPending}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-50"
                    >
                      {isPending ? "Stornovávam..." : "Áno, stornovať"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Confirm header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800 shrink-0">
              <button
                onClick={() => { setStep("select"); setError(null) }}
                className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
              >
                ← Späť
              </button>
              <h2 className="text-white font-bold text-base">Platba</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Amount + variable symbol */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 gap-6">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">{tableName}</p>
                <p className="text-white font-bold leading-none" style={{ fontSize: "3.5rem" }}>
                  {formatCurrency(selectedTotal)}
                </p>
              </div>
              <div className="bg-gray-800 rounded-2xl px-6 py-4 text-center w-full max-w-xs">
                <p className="text-gray-500 text-xs mb-1.5 uppercase tracking-wider">Variabilný symbol</p>
                <p className="text-white font-mono font-bold text-2xl tracking-[0.25em]">
                  {variableSymbol}
                </p>
              </div>
            </div>

            {/* Confirm footer */}
            <div className="border-t border-gray-800 bg-gray-900 p-4 shrink-0 space-y-3">
              {error && <p className="text-red-400 text-xs px-1">{error}</p>}
              <button
                onClick={handleConfirmCash}
                disabled={isPending || !session}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-50 transition-opacity active:opacity-90"
                style={{ backgroundColor: "#166534" }}
              >
                <Banknote size={20} />
                {isPending ? "Spracovávam..." : "Potvrdiť platbu — Hotovosť"}
              </button>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-gray-500 font-medium text-sm border border-gray-800 opacity-40 cursor-not-allowed"
              >
                <CreditCard size={16} />
                Terminál · čoskoro
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TableCheckSheet({ tableName, session, orders, items, onClose, onOrder }: {
  tableName: string
  session: SessionRow | null
  orders: OrderRow[]
  items: OrderItemRow[]
  onClose: () => void
  onOrder: () => void
}) {
  const unpaidTotal = items
    .filter(i => i.status !== "delivered" && i.status !== "cancelled")
    .reduce((s, i) => s + i.total_price, 0)
  const total = items
    .filter(i => i.status !== "cancelled")
    .reduce((s, i) => s + i.total_price, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end p-3 bg-black/60" onClick={onClose}>
      <div
        className="w-full bg-gray-900 rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100dvh - 5rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">{tableName} · Prehľad</h2>
            {session && (
              <p className="text-gray-400 text-xs mt-0.5" suppressHydrationWarning>
                {session.customer_count ? `${session.customer_count} hosti · ` : ""}
                Otvorené {timeAgo(session.opened_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--brand-orange)" }}
            >
              <Plus size={13} />
              Objednať
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Orders + items */}
        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
              <ShoppingBag size={32} className="opacity-20" />
              <p className="text-sm">Žiadne objednávky</p>
            </div>
          ) : (
            orders.map(order => {
              const orderItems = items.filter(i => i.order_id === order.id)
              return (
                <div key={order.id}>
                  <div className="px-4 py-2.5 bg-gray-800/40 border-b border-gray-800 flex items-center gap-2">
                    <ChefHat size={13} className="text-orange-400 shrink-0" />
                    <span className="text-white text-xs font-bold">#{order.order_number}</span>
                    <span className="text-gray-500 text-xs">Kolo {order.round_number}</span>
                    <OrderStatusBadge status={order.status} />
                    <span className="text-gray-500 text-xs ml-auto" suppressHydrationWarning>{timeAgo(order.created_at)}</span>
                  </div>
                  {orderItems.map(item => {
                    const paid = item.status === "delivered"
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 ${paid ? "opacity-40" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${paid ? "line-through text-gray-500" : "text-white"}`}>
                            {item.quantity > 1 && (
                              <span className={`mr-1 ${paid ? "text-gray-500" : "text-orange-400"}`}>{item.quantity}×</span>
                            )}
                            {item.name}
                          </p>
                          {item.notes && <p className="text-yellow-400 text-xs italic">{item.notes}</p>}
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${paid ? "text-gray-600 line-through" : "text-gray-300"}`}>
                          {formatCurrency(item.total_price)}
                        </span>
                        {paid && <CheckCircle2 size={15} className="text-teal-500 shrink-0" />}
                      </div>
                    )
                  })}
                  {order.notes && (
                    <div className="px-4 py-2 border-b border-gray-800/60">
                      <p className="text-yellow-400 text-xs italic">Poznámka: {order.notes}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer summary */}
        {orders.length > 0 && (
          <div className="border-t border-gray-800 px-4 py-3.5 shrink-0 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs">Zostatok na zaplatenie</p>
              {unpaidTotal < total && (
                <p className="text-gray-600 text-xs line-through">{formatCurrency(total)}</p>
              )}
            </div>
            <span className="text-white font-bold text-2xl">{formatCurrency(unpaidTotal)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderCreateSheet({
  table, session, venueId, menuCategories, menuItems,
  modifierGroups, modifiers,
  editOrderId, editOrderNumber, initialCart,
  onClose, onSuccess,
}: {
  table: TableWithPos
  session: SessionRow | null
  venueId: string
  menuCategories: MenuCategoryRow[]
  menuItems: MenuItemRow[]
  modifierGroups: ModifierGroupRow[]
  modifiers: ModifierRow[]
  editOrderId?: string
  editOrderNumber?: string
  initialCart?: CartItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!editOrderId
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>(initialCart ?? [])
  const [orderNotes, setOrderNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [pickerItem, setPickerItem] = useState<MenuItemRow | null>(null)
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

  const filteredItems = useMemo(() => {
    let items = menuItems
    if (activeCategory !== "all") items = items.filter(i => i.category_id === activeCategory)
    if (search.trim()) {
      const q = norm(search)
      items = items.filter(i => norm(i.name).includes(q))
    }
    return items
  }, [menuItems, activeCategory, search])

  function itemGroups(menuItemId: string) {
    return modifierGroups.filter(g => g.item_id === menuItemId)
  }

  function groupModifiers(groupId: string) {
    return modifiers.filter(m => m.group_id === groupId)
  }

  function openPicker(item: MenuItemRow) {
    setPickerItem(item)
    setPickerSelected(new Set())
  }

  function confirmAddToCart() {
    if (!pickerItem) return
    const selectedMods = modifiers
      .filter(m => pickerSelected.has(m.id))
      .map(m => ({ modifierId: m.id, name: m.name, price: m.price }))
    const totalPrice = pickerItem.base_price + selectedMods.reduce((s, m) => s + m.price, 0)
    setCart(prev => [...prev, {
      cartId: crypto.randomUUID(),
      menuItemId: pickerItem.id,
      name: pickerItem.name,
      quantity: 1,
      unitPrice: totalPrice,
      notes: "",
      station: pickerItem.station ?? "kitchen",
      modifiers: selectedMods,
    }])
    setPickerItem(null)
  }

  function addToCart(item: MenuItemRow) {
    const groups = itemGroups(item.id)
    if (groups.length > 0) {
      openPicker(item)
      return
    }
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id && c.modifiers.length === 0)
      if (existing) return prev.map(c => c.cartId === existing.cartId ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { cartId: crypto.randomUUID(), menuItemId: item.id, name: item.name, quantity: 1, unitPrice: item.base_price, notes: "", station: item.station ?? "kitchen", modifiers: [] }]
    })
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(c => c.cartId !== cartId))
  }

  function changeQty(cartId: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.cartId !== cartId) return c
      const q = c.quantity + delta
      return q <= 0 ? c : { ...c, quantity: q }
    }).filter(c => c.quantity > 0))
  }

  function cartItemQty(menuItemId: string): number {
    return cart.filter(c => c.menuItemId === menuItemId).reduce((s, c) => s + c.quantity, 0)
  }

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  function handleSubmit() {
    if (cart.length === 0) return
    setError(null)
    startTransition(async () => {
      const res = isEdit
        ? await updateWaiterOrder(editOrderId!, cart)
        : await createWaiterOrder(table.id, venueId, session?.id ?? null, cart, orderNotes || undefined)
      if (res?.error) { setError(res.error); return }
      onSuccess()
    })
  }

  const pickerGroups = pickerItem ? itemGroups(pickerItem.id) : []
  const pickerExtraPrice = modifiers
    .filter(m => pickerSelected.has(m.id))
    .reduce((s, m) => s + m.price, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end p-3 bg-black/60" onClick={onClose}>
      <div className="flex flex-col w-full bg-gray-950 rounded-2xl overflow-hidden" style={{ maxHeight: "calc(100dvh - 5rem)" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative px-4 py-4 border-b border-gray-800 shrink-0 text-center"
          style={{ backgroundColor: "var(--brand-navy)" }}>
          <p className="text-blue-300 text-xs font-medium mb-0.5">
            {isEdit ? `Upraviť objednávku #${editOrderNumber}` : "Nová objednávka"}
          </p>
          <h2 className="text-white font-black text-2xl tracking-tight">{table.name}</h2>
          {session?.customer_count ? (
            <p className="text-blue-300 text-xs mt-0.5">{session.customer_count} hostí</p>
          ) : null}
          <button onClick={onClose} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-800">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Cart (selected items) — shown above search when non-empty */}
        {cart.length > 0 && (
          <div className="shrink-0 border-b border-gray-800 bg-gray-900">
            <div className="px-4 pt-2.5 pb-1 max-h-40 overflow-y-auto divide-y divide-gray-800">
              {cart.map(item => (
                <div key={item.cartId} className="py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.cartId, -1)} className="text-gray-500 hover:text-white shrink-0">
                      <Minus size={13} />
                    </button>
                    <span className="text-orange-400 text-xs font-bold w-5 text-center shrink-0">{item.quantity}</span>
                    <button onClick={() => changeQty(item.cartId, 1)} className="text-gray-500 hover:text-white shrink-0">
                      <Plus size={13} />
                    </button>
                    <span className="text-white text-sm flex-1 truncate">{item.name}</span>
                    <span className="text-gray-300 text-xs shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-gray-600 hover:text-red-400 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {item.modifiers.length > 0 && (
                    <p className="text-gray-500 text-[11px] ml-14 truncate">
                      {item.modifiers.map(m => m.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 pb-2.5">
              <input
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Poznamka k objednavke..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
              />
            </div>
            {error && <p className="px-4 pb-2 text-red-400 text-xs">{error}</p>}
          </div>
        )}

        {/* Search + category filter */}
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-gray-800">
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hladat polozku..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
          </div>
          {menuCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              <FilterChip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>Vsetky</FilterChip>
              {menuCategories.map(cat => (
                <FilterChip key={cat.id} active={activeCategory === cat.id} onClick={() => setActiveCategory(cat.id)}>
                  {cat.name}
                </FilterChip>
              ))}
            </div>
          )}
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
              Ziadne polozky
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {filteredItems.map(item => {
                const qty = cartItemQty(item.id)
                const hasGroups = itemGroups(item.id).length > 0
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-900 transition-colors text-left active:bg-gray-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <p className="text-gray-400 text-xs">
                        {formatCurrency(item.base_price)}
                        {hasGroups && <span className="ml-1.5 text-gray-600">· upraviteľné</span>}
                      </p>
                    </div>
                    {qty > 0 && (
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: "var(--brand-orange)" }}
                      >
                        {qty}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Submit footer */}
        <div className="border-t border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center justify-between px-4 py-4 gap-3">
            <span className="text-white font-bold text-lg">
              {cart.length > 0 ? formatCurrency(cartTotal) : ""}
            </span>
            <button
              onClick={handleSubmit}
              disabled={isPending || cart.length === 0}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-30"
              style={{ backgroundColor: "var(--brand-orange)" }}
            >
              {isPending ? "Ukladam..." : isEdit ? "Ulozit zmeny" : "Odoslat objednavku"}
            </button>
          </div>
        </div>
      </div>

      {/* Modifier picker overlay */}
      {pickerItem && (
        <div className="fixed inset-0 z-[60] flex items-end p-3 bg-black/70" onClick={() => setPickerItem(null)}>
          <div className="w-full bg-gray-950 rounded-2xl overflow-hidden border border-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800" style={{ backgroundColor: "var(--brand-navy)" }}>
              <div>
                <p className="text-white font-bold text-sm">{pickerItem.name}</p>
                <p className="text-blue-300 text-xs">
                  {formatCurrency(pickerItem.base_price)}
                  {pickerExtraPrice > 0 && <span className="ml-1">+ {formatCurrency(pickerExtraPrice)}</span>}
                </p>
              </div>
              <button onClick={() => setPickerItem(null)} className="p-1.5 rounded-lg hover:bg-gray-800">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {pickerGroups.map(group => (
                <div key={group.id}>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{group.name}</p>
                    {group.max_select === 1 && <p className="text-gray-600 text-xs">Vyber 1</p>}
                    {group.max_select > 1 && <p className="text-gray-600 text-xs">Vyber až {group.max_select}</p>}
                  </div>
                  <div className="divide-y divide-gray-800/50">
                    {groupModifiers(group.id).map(mod => {
                      const selected = pickerSelected.has(mod.id)
                      return (
                        <button
                          key={mod.id}
                          onClick={() => {
                            setPickerSelected(prev => {
                              const next = new Set(prev)
                              if (selected) {
                                next.delete(mod.id)
                              } else {
                                if (group.max_select === 1) {
                                  groupModifiers(group.id).forEach(m => next.delete(m.id))
                                }
                                next.add(mod.id)
                              }
                              return next
                            })
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected ? "bg-orange-950/40" : "hover:bg-gray-900"}`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 ${selected ? "border-orange-500 bg-orange-500" : "border-gray-600"}`}>
                            {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <span className={`text-sm flex-1 ${selected ? "text-white" : "text-gray-300"}`}>{mod.name}</span>
                          {mod.price !== 0 && (
                            <span className={`text-xs shrink-0 ${mod.price > 0 ? "text-orange-400" : "text-green-400"}`}>
                              {mod.price > 0 ? "+" : ""}{formatCurrency(mod.price)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 bg-gray-900 px-4 py-3">
              <button
                onClick={confirmAddToCart}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--brand-orange)" }}
              >
                Pridat do kosika · {formatCurrency(pickerItem.base_price + pickerExtraPrice)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0"
      style={active ? { backgroundColor: "var(--brand-orange)", color: "#fff" } : { backgroundColor: "#1f2937", color: "#9ca3af" }}>
      {children}
    </button>
  )
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, { bg: string; text: string }> = {
    pending:   { bg: "#374151", text: "#d1d5db" },
    confirmed: { bg: "#1e3a5f", text: "#93c5fd" },
    preparing: { bg: "#78350f", text: "#fde68a" },
    ready:     { bg: "#14532d", text: "#86efac" },
    delivered: { bg: "#1f2937", text: "#6b7280" },
    cancelled: { bg: "#450a0a", text: "#fca5a5" },
  }
  const { bg, text } = colors[status]
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: bg, color: text }}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
      <Icon size={36} className="mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
