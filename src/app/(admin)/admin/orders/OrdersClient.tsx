"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, Filter } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
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

interface VenueOption {
  id: string
  name: string
  type: VenueType
  is_active: boolean
}

interface Props {
  orders: Order[]
  venues: VenueOption[]
}

export default function OrdersClient({ orders, venues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all")
  const [venueFilter, setVenueFilter] = useState<string>("all")

  const venueNameMap = Object.fromEntries(venues.map((v) => [v.id, v.name]))

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false
    if (venueFilter !== "all" && o.venue_id !== venueFilter) return false
    return true
  })

  function refresh() {
    router.refresh()
  }

  const handleStatusChange = (id: string, status: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(id, status)
      refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objednávky</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} objednávok (dnes)</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="all">Všetky stavy</option>
              {(Object.keys(statusLabels) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>
          {venues.length > 1 && (
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
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
          Žiadne objednávky zodpovedajú filtru
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Číslo</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prevádzka</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stôl</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stav</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suma</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Čas</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((order) => {
                const next = nextStatusOptions[order.status]
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">#{order.order_number}</p>
                      <p className="text-xs text-gray-400">Kolo {order.round_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{venueNameMap[order.venue_id] ?? "–"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700 font-mono">{order.table_id.slice(-8)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(Number(order.total_amount))}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {next.length > 0 && (
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              disabled={isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              Zmeniť
                              <ChevronDown size={12} />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              sideOffset={4}
                              align="end"
                              className="bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]"
                            >
                              {next.map((s) => (
                                <DropdownMenu.Item
                                  key={s}
                                  onSelect={() => handleStatusChange(order.id, s)}
                                  className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-2 outline-none"
                                >
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
