"use client"

import { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { TrendingUp, ShoppingBag, BarChart3, Users, CreditCard, Banknote, Clock, CalendarDays } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Period = "today" | "7days" | "month"

type Props = {
  period: Period
  venueId: string
  customFrom?: string
  customTo?: string
  isSingleDay: boolean
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  cashRevenue: number
  cardRevenue: number
  statusBreakdown: { status: string; count: number }[]
  topItems: { name: string; quantity: number; revenue: number }[]
  tableStats: { tableId: string; tableName: string; orderCount: number; revenue: number }[]
  timeSeries: { label: string; revenue: number; orderCount: number }[]
  staffList: { id: string; name: string; role: string; joinedAt: string }[]
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Dnes",
  "7days": "7 dní",
  month: "Tento mesiac",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Čaká",
  confirmed: "Potvrdená",
  preparing: "Pripravuje sa",
  ready: "Hotová",
  delivered: "Doručená",
  cancelled: "Zrušená",
}

const STATUS_BG: Record<string, string> = {
  pending: "#fbbf24",
  confirmed: "#60a5fa",
  preparing: "#fb923c",
  ready: "#2BB58C",
  delivered: "#22c55e",
  cancelled: "#d1d5db",
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  waiter: "Čašník",
  cook: "Kuchár",
  barman: "Barman",
}

export default function StatsClient({
  period, venueId, customFrom, customTo, isSingleDay,
  totalRevenue, totalOrders, avgOrderValue,
  cashRevenue, cardRevenue, statusBreakdown, topItems, tableStats,
  timeSeries, staffList,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isCustom = !!(customFrom && customTo)

  const today = new Date().toISOString().slice(0, 10)
  const [fromInput, setFromInput] = useState(customFrom ?? today)
  const [toInput, setToInput] = useState(customTo ?? today)

  function setPeriod(p: Period) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("from")
    params.delete("to")
    params.set("period", p)
    params.set("venue", venueId)
    router.push(`${pathname}?${params}`)
  }

  function applyCustomRange(from: string, to: string) {
    if (!from || !to || from > to) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete("period")
    params.set("from", from)
    params.set("to", to)
    params.set("venue", venueId)
    router.push(`${pathname}?${params}`)
  }

  function handleFromChange(val: string) {
    setFromInput(val)
    if (val && toInput && val <= toInput) applyCustomRange(val, toInput)
  }

  function handleToChange(val: string) {
    setToInput(val)
    if (fromInput && val && fromInput <= val) applyCustomRange(fromInput, val)
  }

  const maxRevenue = Math.max(...timeSeries.map((d) => d.revenue), 1)
  const maxItemQty = Math.max(...topItems.map((i) => i.quantity), 1)
  const maxTableRevenue = Math.max(...tableStats.map((t) => t.revenue), 1)
  const totalStatusCount = statusBreakdown.reduce((s, x) => s + x.count, 0)
  const hasRevenue = totalRevenue > 0
  const isHourly = isSingleDay

  // For hourly chart, filter to active window (first/last non-zero ±1 hour)
  const activeTimeSeries = isHourly
    ? (() => {
        const first = timeSeries.findIndex((d) => d.revenue > 0 || d.orderCount > 0)
        const last = [...timeSeries].reverse().findIndex((d) => d.revenue > 0 || d.orderCount > 0)
        if (first === -1) return timeSeries.slice(6, 23) // default 06:00–22:00
        const start = Math.max(0, first - 1)
        const end = timeSeries.length - Math.max(0, last - 1)
        return timeSeries.slice(start, end)
      })()
    : timeSeries

  return (
    <div className="space-y-6">
      {/* Period switcher + date picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["today", "7days", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !isCustom && period === p
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
              isCustom ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white"
            }`}
          >
            <CalendarDays size={14} className={isCustom ? "text-orange-500" : "text-gray-400"} />
            <input
              type="date"
              value={fromInput}
              max={toInput || today}
              onChange={e => handleFromChange(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none cursor-pointer w-32"
            />
            <span className="text-gray-300 text-sm">—</span>
            <input
              type="date"
              value={toInput}
              min={fromInput}
              max={today}
              onChange={e => handleToChange(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none cursor-pointer w-32"
            />
          </div>
          {isCustom && (
            <button
              onClick={() => { setPeriod(period) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ✕ Zrušiť
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Celkové tržby",
            value: formatCurrency(totalRevenue),
            icon: TrendingUp,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Počet objednávok",
            value: String(totalOrders),
            icon: ShoppingBag,
            color: "bg-orange-50 text-orange-600",
          },
          {
            label: "Priemerná objednávka",
            value: formatCurrency(avgOrderValue),
            icon: BarChart3,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Aktívny personál",
            value: String(staffList.length),
            icon: Users,
            color: "bg-purple-50 text-purple-600",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue / Orders chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-gray-900">
            Tržby {isHourly ? "po hodinách" : "po dňoch"}
            {isCustom && customFrom && customTo && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                {new Date(customFrom).toLocaleDateString("sk-SK", { day: "numeric", month: "short" })}
                {" – "}
                {new Date(customTo).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "var(--brand-orange)" }} />
              Tržby
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-blue-200" />
              Objednávky
            </span>
          </div>
        </div>

        {!hasRevenue && totalOrders === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300">
            <BarChart3 size={40} className="mb-2 opacity-50" />
            <p className="text-sm">Žiadne dáta za toto obdobie</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-1"
              style={{ minWidth: activeTimeSeries.length * 28, height: 140 }}
            >
              {activeTimeSeries.map(({ label, revenue, orderCount }) => {
                const revenueH = Math.max((revenue / maxRevenue) * 110, revenue > 0 ? 4 : 0)
                return (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-0.5 flex-1 min-w-[22px] group relative"
                    style={{ height: 140 }}
                  >
                    {/* Tooltip */}
                    {(revenue > 0 || orderCount > 0) && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        {revenue > 0 && <div>{formatCurrency(revenue)}</div>}
                        {orderCount > 0 && <div>{orderCount} obj.</div>}
                      </div>
                    )}
                    {/* Bars container */}
                    <div className="flex items-end gap-0.5 w-full" style={{ height: 120 }}>
                      {/* Revenue bar */}
                      <div
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: revenueH,
                          backgroundColor: revenue > 0 ? "var(--brand-orange)" : "#f3f4f6",
                          opacity: revenue > 0 ? 1 : 0.3,
                        }}
                      />
                    </div>
                    {/* Label */}
                    <span className="text-[9px] text-gray-400 leading-none mt-1 truncate w-full text-center">
                      {isHourly ? `${label}h` : label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Two-column: top items + table stats */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top items */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Najpredávanejšie položky</h2>
          </div>
          {topItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Žiadne dáta</div>
          ) : (
            <div className="p-4 space-y-3">
              {topItems.map(({ name, quantity, revenue }, idx) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                      <span className="text-xs font-bold text-gray-300 w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-gray-800 truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-gray-900">{quantity}×</span>
                      <span className="text-xs text-gray-400 w-20 text-right">
                        {formatCurrency(revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(quantity / maxItemQty) * 100}%`,
                        backgroundColor: "var(--brand-orange)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table stats */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Tržby podľa stola</h2>
          </div>
          {tableStats.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Žiadne dáta</div>
          ) : (
            <div className="p-4 space-y-3">
              {tableStats.map(({ tableId, tableName, orderCount, revenue }, idx) => (
                <div key={tableId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                      <span className="text-xs font-bold text-gray-300 w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{tableName}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{orderCount} obj.</span>
                      <span className="text-sm font-bold text-emerald-600 w-20 text-right">
                        {formatCurrency(revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400 transition-all"
                      style={{ width: `${(revenue / maxTableRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two-column: payment methods + status breakdown */}
      <div className="grid grid-cols-2 gap-6">
        {/* Payment methods */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Platobné metódy</h2>
          </div>
          {!hasRevenue ? (
            <div className="py-12 text-center text-gray-400 text-sm">Žiadne platby</div>
          ) : (
            <div className="p-6 space-y-5">
              {[
                {
                  label: "Hotovosť",
                  value: cashRevenue,
                  icon: Banknote,
                  iconBg: "bg-green-50",
                  iconColor: "text-green-600",
                  barColor: "#22c55e",
                },
                {
                  label: "Karta / terminál",
                  value: cardRevenue,
                  icon: CreditCard,
                  iconBg: "bg-blue-50",
                  iconColor: "text-blue-600",
                  barColor: "#3b82f6",
                },
              ].map(({ label, value, icon: Icon, iconBg, iconColor, barColor }) => (
                <div key={label} className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
                  >
                    <Icon size={18} className={iconColor} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(value)}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${totalRevenue > 0 ? (value / totalRevenue) * 100 : 0}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Objednávky podľa stavu</h2>
          </div>
          {statusBreakdown.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Žiadne objednávky</div>
          ) : (
            <div className="p-4 space-y-3">
              {statusBreakdown.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_BG[status] ?? "#d1d5db" }}
                  />
                  <span className="text-sm text-gray-700 flex-1">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-28 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0}%`,
                          backgroundColor: STATUS_BG[status] ?? "#d1d5db",
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-6 text-right">{count}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">
                      {totalStatusCount > 0 ? Math.round((count / totalStatusCount) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Staff roster */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Aktívny personál</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            {staffList.length} členov
          </span>
        </div>
        {staffList.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Žiadny aktívny personál</div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {staffList.map(({ id, name, role, joinedAt }) => (
                <div key={id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: "var(--brand-navy)" }}
                  >
                    {name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-400">
                      {ROLE_LABELS[role] ?? role} · nastúpil{" "}
                      {new Date(joinedAt).toLocaleDateString("sk-SK", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                    Aktívny
                  </span>
                </div>
              ))}
            </div>
            <div className="px-6 py-3.5 bg-gray-50 rounded-b-xl border-t border-gray-100 flex items-start gap-2">
              <Clock size={13} className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Prepojenie objednávok s konkrétnym zamestnancom bude dostupné po rozšírení databázy
                (pridanie poľa <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">created_by</code> do tabuľky objednávok).
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
