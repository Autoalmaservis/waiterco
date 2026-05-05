"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react"
import type { VenueClosure } from "@/types/database"
import { addVenueClosure, removeVenueClosure } from "./actions"

const MONTH_NAMES = [
  "Január", "Február", "Marec", "Apríl", "Máj", "Jún",
  "Júl", "August", "September", "Október", "November", "December",
]
const DAY_LABELS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"]

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  // day 0=Sun → shift to Mon=0
  const startDow = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

interface Props {
  venueId: string
  closures: VenueClosure[]
}

export default function ClosuresCalendar({ venueId, closures: initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [closures, setClosures] = useState(initial)

  // Modal state
  const [addDate, setAddDate] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  const closureMap = new Map(closures.map((c) => [c.date, c]))

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (date: Date) => {
    const str = toDateStr(date)
    if (closureMap.has(str)) {
      // Remove
      const closure = closureMap.get(str)!
      startTransition(async () => {
        const result = await removeVenueClosure(closure.id)
        if (result?.error) { setError(result.error); return }
        setClosures(prev => prev.filter(c => c.id !== closure.id))
        router.refresh()
      })
    } else {
      // Open add dialog
      setAddDate(str)
      setReason("")
      setError("")
    }
  }

  const handleAdd = () => {
    if (!addDate) return
    setError("")
    startTransition(async () => {
      const result = await addVenueClosure(venueId, addDate, reason.trim() || null)
      if (result?.error) { setError(result.error); return }
      setClosures(prev => [...prev, {
        id: crypto.randomUUID(),
        venue_id: venueId,
        date: addDate,
        reason: reason.trim() || null,
        created_at: new Date().toISOString(),
      }])
      setAddDate(null)
      router.refresh()
    })
  }

  const grid = getMonthGrid(viewYear, viewMonth)
  const todayStr = toDateStr(today)

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Plánované zatvorenie</h2>
          <p className="text-xs text-gray-400 mt-0.5">Kliknutím na deň ho označíte ako zatvorený</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-900 w-32 text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Day labels */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((date, i) => {
            if (!date) return <div key={i} />
            const str = toDateStr(date)
            const closure = closureMap.get(str)
            const isToday = str === todayStr
            const isPast = date < today && !isToday
            const isClosed = !!closure

            return (
              <button
                key={str}
                onClick={() => !isPast && handleDayClick(date)}
                disabled={isPending || isPast}
                title={closure?.reason ?? undefined}
                className={[
                  "relative h-9 w-full rounded-lg text-sm font-medium transition-all",
                  isPast ? "text-gray-300 cursor-default" : "cursor-pointer",
                  isClosed ? "bg-red-500 text-white hover:bg-red-600" :
                  isToday ? "ring-2 ring-orange-400 text-orange-600 hover:bg-orange-50" :
                  isPast ? "" : "text-gray-700 hover:bg-gray-100",
                ].join(" ")}
              >
                {date.getDate()}
                {isClosed && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white/60" />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend & upcoming closures */}
        {closures.filter(c => c.date >= todayStr).length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Nadchádzajúce zatvorenia</p>
            <div className="space-y-1.5">
              {closures
                .filter(c => c.date >= todayStr)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm bg-red-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-red-700">
                        {new Date(c.date + "T12:00:00").toLocaleDateString("sk-SK", { weekday: "short", day: "numeric", month: "long" })}
                      </span>
                      {c.reason && <span className="text-red-500 text-xs">{c.reason}</span>}
                    </div>
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          await removeVenueClosure(c.id)
                          setClosures(prev => prev.filter(x => x.id !== c.id))
                          router.refresh()
                        })
                      }}
                      disabled={isPending}
                      className="p-1 rounded hover:bg-red-100 text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Add closure modal */}
      {addDate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Zatvoriť prevádzku</h3>
              <button onClick={() => setAddDate(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {new Date(addDate + "T12:00:00").toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Dôvod (voliteľné)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="napr. Štátny sviatok, dovolenka..."
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setAddDate(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                Zrušiť
              </button>
              <button onClick={handleAdd} disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                <Plus size={14} />
                {isPending ? "Ukladám..." : "Pridať"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
