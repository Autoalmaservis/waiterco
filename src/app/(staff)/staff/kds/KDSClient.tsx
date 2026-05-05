"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChefHat, GlassWater, ArrowRight, ArrowLeft, CheckCircle2, Circle } from "lucide-react"
import { updateOrderStatus, markKitchenItemReady, markAllKitchenItemsReady, revertOrderStatus } from "../actions"
import type { OrderStatus } from "@/types/database"

type OrderRow = {
  id: string
  table_id: string
  order_number: string
  round_number: number
  status: OrderStatus
  notes: string | null
  created_at: string
}

type OrderItemRow = {
  id: string
  order_id: string
  name: string
  quantity: number
  status: string
  station: string
}

type OrderItemModifierRow = {
  id: string
  order_item_id: string
  modifier_id: string
  name: string
  price: number
}

type Props = {
  venueId: string
  staffRole: "cook" | "barman" | "manager" | "waiter"
  initialOrders: OrderRow[]
  initialItems: OrderItemRow[]
  initialOrderItemModifiers: OrderItemModifierRow[]
  tableMap: Record<string, string>
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  return `${Math.floor(diff / 3600)} hod`
}

type Column = {
  key: string
  label: string
  statuses: OrderStatus[]
  nextStatus: OrderStatus | null
  nextLabel: string
  headerBg: string
  headerText: string
  cardBorder: string
  badgeBg: string
  badgeText: string
  buttonBg: string
}

const COOK_COLUMNS: Column[] = [
  {
    key: "new",
    label: "Nové",
    statuses: ["confirmed"],
    nextStatus: "preparing",
    nextLabel: "Začať prípravu",
    headerBg: "#7c2d12",
    headerText: "#fed7aa",
    cardBorder: "#9a3412",
    badgeBg: "#431407",
    badgeText: "#fb923c",
    buttonBg: "var(--brand-orange)",
  },
  {
    key: "preparing",
    label: "V príprave",
    statuses: ["preparing"],
    nextStatus: "ready",
    nextLabel: "Hotové",
    headerBg: "#713f12",
    headerText: "#fef08a",
    cardBorder: "#854d0e",
    badgeBg: "#422006",
    badgeText: "#fbbf24",
    buttonBg: "#d97706",
  },
  {
    key: "ready",
    label: "Hotové",
    statuses: ["ready"],
    nextStatus: null,
    nextLabel: "",
    headerBg: "#14532d",
    headerText: "#bbf7d0",
    cardBorder: "#166534",
    badgeBg: "#052e16",
    badgeText: "#4ade80",
    buttonBg: "var(--brand-teal)",
  },
]

const BARMAN_COLUMNS: Column[] = [
  {
    key: "new",
    label: "Nové",
    statuses: ["confirmed"],
    nextStatus: "preparing",
    nextLabel: "Začať prípravu",
    headerBg: "#1e3a5f",
    headerText: "#bfdbfe",
    cardBorder: "#1d4ed8",
    badgeBg: "#172554",
    badgeText: "#93c5fd",
    buttonBg: "#2563eb",
  },
  {
    key: "preparing",
    label: "Pripravuje sa",
    statuses: ["preparing"],
    nextStatus: "ready",
    nextLabel: "Hotové",
    headerBg: "#1e3a8a",
    headerText: "#ddd6fe",
    cardBorder: "#3730a3",
    badgeBg: "#1e1b4b",
    badgeText: "#c4b5fd",
    buttonBg: "#7c3aed",
  },
  {
    key: "ready",
    label: "Hotové",
    statuses: ["ready"],
    nextStatus: null,
    nextLabel: "",
    headerBg: "#14532d",
    headerText: "#bbf7d0",
    cardBorder: "#166534",
    badgeBg: "#052e16",
    badgeText: "#4ade80",
    buttonBg: "var(--brand-teal)",
  },
]

export default function KDSClient({ venueId, staffRole, initialOrders, initialItems, initialOrderItemModifiers, tableMap }: Props) {
  const isBarman = staffRole === "barman"
  const myStation = isBarman ? "bar" : "kitchen"
  const router = useRouter()

  const modifiersByOrderItemId = initialOrderItemModifiers.reduce<Record<string, OrderItemModifierRow[]>>((acc, m) => {
    if (!acc[m.order_item_id]) acc[m.order_item_id] = []
    acc[m.order_item_id].push(m)
    return acc
  }, {})
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const channel = supabase
      .channel("kds-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `venue_id=eq.${venueId}` },
        () => { if (mounted) router.refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" },
        () => { if (mounted) router.refresh() })
      .subscribe()
    // Polling fallback — refreshes every 8 s if WebSocket drops (common on mobile/unstable WiFi)
    const poll = setInterval(() => { if (mounted) router.refresh() }, 8000)
    return () => { mounted = false; supabase.removeChannel(channel); clearInterval(poll) }
  }, [venueId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdvance(orderId: string, next: OrderStatus, currentKey: string) {
    startTransition(async () => {
      if (currentKey === "preparing" && next === "ready") {
        // Auto-check all items then advance
        await markAllKitchenItemsReady(orderId, myStation)
      } else {
        await updateOrderStatus(orderId, next)
      }
      router.refresh()
    })
  }

  function handleRevert(orderId: string, currentStatus: OrderStatus) {
    startTransition(async () => {
      await revertOrderStatus(orderId, currentStatus)
      router.refresh()
    })
  }

  function handleItemReady(itemId: string, orderId: string) {
    startTransition(async () => {
      await markKitchenItemReady(itemId, orderId)
      router.refresh()
    })
  }

  // Items for this station only (waiter items are not shown on KDS)
  const myItems = initialItems.filter(i => i.station === myStation)

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gray-950 overflow-hidden">
      {/* KDS header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          {isBarman
            ? <GlassWater size={18} className="text-blue-400" />
            : <ChefHat size={18} className="text-orange-400" />
          }
          <span className="text-white font-bold text-base">
            {isBarman ? "Barový displej" : "Kuchynský displej"}
          </span>
        </div>
        <a href="/staff" className="text-xs text-gray-400 hover:text-white transition-colors">
          ← Čašník
        </a>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 overflow-hidden">
        {(isBarman ? BARMAN_COLUMNS : COOK_COLUMNS).map((col) => {
          // Only show orders that have at least one item for my station
          const colOrders = initialOrders.filter(o =>
            col.statuses.includes(o.status) &&
            myItems.some(i => i.order_id === o.id)
          )
          return (
            <div key={col.key} className="flex flex-col min-h-0">
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-t-xl mb-2"
                style={{ backgroundColor: col.headerBg }}
              >
                <span className="font-semibold text-sm" style={{ color: col.headerText }}>
                  {col.label}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: col.badgeBg, color: col.badgeText }}
                >
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {colOrders.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-gray-700 text-sm">
                    Prázdne
                  </div>
                )}
                {colOrders.map((order) => {
                  const items = myItems.filter(i => i.order_id === order.id)
                  return (
                    <div
                      key={order.id}
                      className="bg-gray-900 rounded-xl p-3 border"
                      style={{ borderColor: col.cardBorder }}
                    >
                      {/* Order number + table + time */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-black text-lg leading-none">
                          #{order.order_number}
                        </span>
                        <span className="text-gray-400 text-xs tabular-nums" suppressHydrationWarning>
                          {timeAgo(order.created_at)}
                        </span>
                      </div>

                      <p className="text-gray-400 text-xs mb-2">
                        {tableMap[order.table_id] ?? "Stôl"} · Kolo {order.round_number}
                      </p>

                      {order.notes && (
                        <p className="text-yellow-400 text-xs italic mb-2 leading-snug bg-yellow-950/40 px-2 py-1 rounded-lg">
                          {order.notes}
                        </p>
                      )}

                      {/* Items list */}
                      <div className="space-y-1 mb-3">
                        {items.map(item => {
                          const done = item.status === "ready" || item.status === "delivered"
                          const itemMods = modifiersByOrderItemId[item.id] ?? []
                          // In "new" column: read-only list, no checkboxes
                          if (col.key === "new") {
                            return (
                              <div key={item.id} className="flex items-start gap-2 px-2 py-1.5">
                                <span
                                  className="text-xs font-black w-5 text-right shrink-0 mt-0.5"
                                  style={{ color: col.badgeText }}
                                >
                                  {item.quantity}×
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-white">{item.name}</span>
                                  {itemMods.length > 0 && (
                                    <p className="text-gray-500 text-xs truncate">{itemMods.map(m => m.name).join(", ")}</p>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          // In "preparing" and "ready" columns: tappable checkboxes
                          return (
                            <button
                              key={item.id}
                              onClick={() => !done && handleItemReady(item.id, order.id)}
                              disabled={isPending || done}
                              className={`w-full flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-all active:scale-[0.98] ${done ? "opacity-50 cursor-default" : "bg-gray-800 hover:bg-gray-700 cursor-pointer"}`}
                            >
                              <div className="mt-0.5 shrink-0">
                                {done
                                  ? <CheckCircle2 size={16} className="text-green-400" />
                                  : <Circle size={16} className="text-gray-500" />
                                }
                              </div>
                              <span
                                className="text-xs font-black w-5 text-right shrink-0 mt-0.5"
                                style={{ color: done ? "#4ade80" : col.badgeText }}
                              >
                                {item.quantity}×
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium ${done ? "line-through text-gray-500" : "text-white"}`}>
                                  {item.name}
                                </span>
                                {itemMods.length > 0 && (
                                  <p className="text-gray-500 text-xs truncate">{itemMods.map(m => m.name).join(", ")}</p>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex gap-2">
                        {/* Back button — available in preparing and ready columns */}
                        {(col.key === "preparing" || col.key === "ready") && (
                          <button
                            onClick={() => handleRevert(order.id, order.status)}
                            disabled={isPending}
                            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
                            title="Vrátiť späť"
                          >
                            <ArrowLeft size={13} />
                          </button>
                        )}

                        {/* Advance button */}
                        {col.nextStatus && (() => {
                          const allItemsDone = items.length > 0 && items.every(i => i.status === "ready" || i.status === "delivered")
                          if (col.key === "preparing" && allItemsDone) return null
                          return (
                            <button
                              onClick={() => handleAdvance(order.id, col.nextStatus!, col.key)}
                              disabled={isPending}
                              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: col.buttonBg }}
                            >
                              {col.nextLabel}
                              <ArrowRight size={12} />
                            </button>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
