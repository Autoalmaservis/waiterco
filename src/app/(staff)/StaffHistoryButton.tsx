"use client"

import { useState, useTransition } from "react"
import { History, X, ChevronDown, ChevronRight, RotateCcw } from "lucide-react"
import { fetchOrderHistory, reopenSession } from "./staff/actions"
import { formatCurrency } from "@/lib/utils"

type HistorySession = { id: string; table_id: string; customer_count: number | null; opened_at: string; closed_at: string }
type HistoryOrder = { id: string; session_id: string; order_number: string; total_amount: number }
type HistoryItem = { id: string; order_id: string; name: string; quantity: number; total_price: number }
type HistoryData = { sessions: HistorySession[]; orders: HistoryOrder[]; items: HistoryItem[]; tableMap: Record<string, string> }

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Dnes"
  if (d.toDateString() === yesterday.toDateString()) return "Včera"
  return d.toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" })
}

function canReopen(closedAt: string): boolean {
  return Date.now() - new Date(closedAt).getTime() < 30 * 60 * 1000
}

export default function StaffHistoryButton({ venueId }: { venueId: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<HistoryData | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [tableFilter, setTableFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [reopeningId, setReopeningId] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  function handleOpen() {
    setOpen(true)
    if (!data) {
      startTransition(async () => {
        const result = await fetchOrderHistory(venueId)
        setData(result as HistoryData)
      })
    }
  }

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleReopen(sessionId: string) {
    setReopeningId(sessionId)
    startTransition(async () => {
      await reopenSession(sessionId, venueId)
      setData(prev => prev ? { ...prev, sessions: prev.sessions.filter(s => s.id !== sessionId) } : prev)
      setReopeningId(null)
    })
  }

  const allTableIds = data
    ? [...new Set(data.sessions.map(s => s.table_id))]
    : []

  const filteredSessions = data ? data.sessions.filter(s => {
    if (tableFilter !== "all" && s.table_id !== tableFilter) return false
    if (dateFrom) {
      const sessionDate = s.closed_at.slice(0, 10)
      if (sessionDate < dateFrom) return false
    }
    if (dateTo) {
      const sessionDate = s.closed_at.slice(0, 10)
      if (sessionDate > dateTo) return false
    }
    return true
  }) : []

  const sessionsByDay = (() => {
    const groups: { label: string; sessions: HistorySession[] }[] = []
    const index: Record<string, number> = {}
    for (const s of filteredSessions) {
      const label = dayLabel(s.closed_at)
      if (index[label] === undefined) { index[label] = groups.length; groups.push({ label, sessions: [] }) }
      groups[index[label]].sessions.push(s)
    }
    return groups
  })()

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
        style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
      >
        <History size={14} />
        História
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#030712" }}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0"
            style={{ backgroundColor: "var(--brand-navy)" }}
          >
            <div className="flex items-center gap-2.5">
              <History size={18} className="text-blue-400" />
              <span className="text-white font-bold text-base">História objednávok</span>
              <span className="text-gray-500 text-xs">posledných 7 dní</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-700">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Filters */}
          {data && (
            <div className="border-b border-gray-800 shrink-0 px-3 py-2.5 space-y-2">
              {/* Date range */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs shrink-0">Od</span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || today}
                  onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ colorScheme: "dark" }}
                />
                <span className="text-gray-500 text-xs shrink-0">Do</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  max={today}
                  onChange={e => setDateTo(e.target.value)}
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ colorScheme: "dark" }}
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo("") }}
                    className="shrink-0 text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {/* Table filter */}
              {allTableIds.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {["all", ...allTableIds].map(tid => (
                    <button
                      key={tid}
                      onClick={() => setTableFilter(tid)}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      style={tableFilter === tid
                        ? { backgroundColor: "var(--brand-teal)", color: "#fff" }
                        : { backgroundColor: "#1f2937", color: "#9ca3af" }
                      }
                    >
                      {tid === "all" ? "Všetky stoly" : (data.tableMap[tid] ?? tid)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isPending && !data ? (
              <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Načítavam...</div>
            ) : !data || filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Žiadne záznamy</div>
            ) : (
              <div className="pb-10">
                {sessionsByDay.map(({ label, sessions }) => (
                  <div key={label}>
                    <div className="px-4 pt-5 pb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="space-y-2 px-3">
                      {sessions.map(session => {
                        const sessionOrders = data!.orders.filter(o => o.session_id === session.id)
                        const total = sessionOrders.reduce((s, o) => s + o.total_amount, 0)
                        const expanded = expandedIds.has(session.id)
                        const openedTime = new Date(session.opened_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })
                        const closedTime = new Date(session.closed_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })
                        const reopenable = canReopen(session.closed_at)

                        return (
                          <div key={session.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-3">
                              <button
                                className="flex-1 flex items-center gap-3 text-left"
                                onClick={() => toggle(session.id)}
                              >
                                {expanded
                                  ? <ChevronDown size={15} className="text-gray-500 shrink-0" />
                                  : <ChevronRight size={15} className="text-gray-500 shrink-0" />
                                }
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-white font-semibold text-sm">{data!.tableMap[session.table_id] ?? "Stôl"}</span>
                                    <span className="text-white font-bold text-sm shrink-0">{formatCurrency(total)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-gray-500 text-xs">{openedTime} – {closedTime}</span>
                                    {session.customer_count ? <span className="text-gray-600 text-xs">· {session.customer_count} hostia</span> : null}
                                    {sessionOrders.length > 0 && (
                                      <span className="text-gray-600 text-xs">
                                        · {sessionOrders.length} objednávk{sessionOrders.length === 1 ? "a" : sessionOrders.length < 5 ? "y" : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                              {reopenable && (
                                <button
                                  onClick={() => handleReopen(session.id)}
                                  disabled={reopeningId === session.id}
                                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-opacity"
                                  style={{ backgroundColor: "#1d4ed8", color: "#fff" }}
                                >
                                  <RotateCcw size={12} />
                                  {reopeningId === session.id ? "..." : "Otvoriť"}
                                </button>
                              )}
                            </div>

                            {expanded && (
                              <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                                {sessionOrders.map(order => {
                                  const orderItems = data!.items.filter(i => i.order_id === order.id)
                                  return (
                                    <div key={order.id} className="px-4 py-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
                                          Objednávka #{order.order_number}
                                        </span>
                                        <span className="text-gray-400 text-xs">{formatCurrency(order.total_amount)}</span>
                                      </div>
                                      <div className="space-y-0.5">
                                        {orderItems.map(item => (
                                          <div key={item.id} className="flex items-center justify-between">
                                            <span className="text-gray-300 text-sm">{item.quantity}× {item.name}</span>
                                            <span className="text-gray-500 text-xs">{formatCurrency(item.total_price)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
