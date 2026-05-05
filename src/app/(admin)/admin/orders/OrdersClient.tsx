"use client"

import { useState, useTransition, Fragment } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, ChevronRight, Filter, Info, Truck, Package } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { Order, OrderStatus, VenueType } from "@/types/database"
import { updateOrderStatus } from "./actions"

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700",
  ready: "bg-teal-100 text-teal-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
}

const statusLabels: Record<OrderStatus, string> = {
  pending: "Čaká",
  confirmed: "Potvrdená",
  preparing: "Pripravuje sa",
  ready: "Pripravená",
  delivered: "Doručená",
  cancelled: "Zrušená",
}

const nextStatusOptions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered"],
  delivered: [],
  cancelled: [],
}

type Period = "today" | "week" | "month"
type OrderTypeFilter = "all" | "dine_in" | "delivery" | "takeaway"

interface VenueOption { id: string; name: string; type: VenueType; is_active: boolean }
interface OrderItemRow { id: string; order_id: string; name: string; quantity: number; unit_price: number; total_price: number; status: string }
interface Props {
  orders: Order[]
  venues: VenueOption[]
  tableMap: Record<string, string>
  orderItems: OrderItemRow[]
  paymentMap: Record<string, string>
}

function periodStart(period: Period): Date {
  const d = new Date()
  if (period === "today") { d.setHours(0, 0, 0, 0); return d }
  if (period === "week") { d.setDate(d.getDate() - 7); return d }
  d.setDate(d.getDate() - 30)
  return d
}

function orderTypeLabel(order: any) {
  if (order.order_type === "delivery") return <span className="inline-flex items-center gap-1 text-orange-600 text-xs font-medium"><Truck size={11} />Donáška</span>
  if (order.order_type === "takeaway") return <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium"><Package size={11} />Takeaway</span>
  return null
}

export default function OrdersClient({ orders, venues, tableMap, orderItems, paymentMap }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all")
  const [venueFilter, setVenueFilter] = useState<string>("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>("all")
  const [period, setPeriod] = useState<Period>("month")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const itemsByOrderId = orderItems.reduce<Record<string, OrderItemRow[]>>((acc, i) => {
    if (!acc[i.order_id]) acc[i.order_id] = []
    acc[i.order_id].push(i)
    return acc
  }, {})

  const venueNameMap = Object.fromEntries(venues.map((v) => [v.id, v.name]))
  const cutoff = periodStart(period)

  const filtered = orders.filter((o) => {
    if (new Date(o.created_at) < cutoff) return false
    if (statusFilter !== "all" && o.status !== statusFilter) return false
    if (venueFilter !== "all" && o.venue_id !== venueFilter) return false
    if (orderTypeFilter !== "all" && (o as any).order_type !== orderTypeFilter) return false
    return true
  })

  const totalRevenue = filtered
    .filter(o => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total_amount), 0)

  const handleStatusChange = (id: string, status: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(id, status)
      router.refresh()
    })
  }

  const periodLabels: Record<Period, string> = { today: "Dnes", week: "7 dní", month: "30 dní" }

  return (
    <div>
      {/* Archive notice */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>História objednávok je dostupná za posledných <strong>30 dní</strong>. Staršie záznamy sú automaticky archivované a nie sú zobrazené.</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">História objednávok</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} objednávok · tržba {formatCurrency(totalRevenue)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Period tabs */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(["today", "week", "month"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Order type filter */}
          <select value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value as OrderTypeFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="all">Všetky typy</option>
            <option value="dine_in">QR / Stôl</option>
            <option value="delivery">Donáška</option>
            <option value="takeaway">Takeaway</option>
          </select>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-gray-400" />
            <select value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="all">Všetky stavy</option>
              {(Object.keys(statusLabels) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>

          {/* Venue filter */}
          {venues.length > 1 && (
            <select value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="all">Všetky prevádzky</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Žiadne objednávky za zvolené obdobie
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Č.</th>
                {venues.length > 1 && (
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prevádzka</th>
                )}
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stôl / Typ</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stav</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suma</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dátum a čas</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((order) => {
                const next = nextStatusOptions[order.status]
                const tableName = tableMap[(order as any).table_id] ?? "–"
                const typeTag = orderTypeLabel(order)
                const isExpanded = expandedId === order.id
                const items = itemsByOrderId[order.id] ?? []
                const colSpan = venues.length > 1 ? 7 : 6
                return (
                  <Fragment key={order.id}>
                    <tr
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                            : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                          <div>
                            <p className="text-sm font-semibold text-gray-900">#{order.order_number}</p>
                            <p className="text-xs text-gray-400">Kolo {order.round_number}</p>
                          </div>
                        </div>
                      </td>
                      {venues.length > 1 && (
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-gray-700">{venueNameMap[order.venue_id] ?? "–"}</p>
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-700">{tableName}</p>
                        {typeTag && <div className="mt-0.5">{typeTag}</div>}
                        {(order as any).customer_name && (
                          <p className="text-xs text-gray-400 mt-0.5">{(order as any).customer_name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(order.total_amount))}</p>
                        {paymentMap[order.session_id] && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${paymentMap[order.session_id] === "card" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {paymentMap[order.session_id] === "card" ? "💳 Karta" : "💵 Hotovosť"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-gray-700">
                          {new Date(order.created_at).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Bratislava" })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bratislava" })}
                        </p>
                      </td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        {next.length > 0 && (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50">
                                Zmeniť <ChevronDown size={12} />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content sideOffset={4} align="end"
                                className="bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]">
                                {next.map((s) => (
                                  <DropdownMenu.Item key={s}
                                    onSelect={() => handleStatusChange(order.id, s)}
                                    className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-2 outline-none">
                                    <span className={`w-2 h-2 rounded-full ${statusColors[s].split(" ")[0]}`} />
                                    {statusLabels[s]}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${order.id}-items`} className="bg-gray-50">
                        <td colSpan={colSpan} className="px-5 py-3 border-b border-gray-100">
                          {items.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Žiadne položky</p>
                          ) : (
                            <div className="max-w-lg space-y-1">
                              {items.map(item => (
                                <div key={item.id} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-bold text-gray-500 shrink-0">{item.quantity}×</span>
                                    <span className="text-sm text-gray-800 truncate">{item.name}</span>
                                  </div>
                                  <span className="text-sm text-gray-600 shrink-0">{formatCurrency(item.total_price)}</span>
                                </div>
                              ))}
                              {(order as any).notes && (
                                <p className="text-xs text-amber-600 italic mt-1.5 border-t border-gray-200 pt-1.5">
                                  Poznámka: {(order as any).notes}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
