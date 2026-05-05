"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Lightbulb, Search, Send, X, Check } from "lucide-react"
import { updateFeatureStatus, replyToFeature } from "./actions"
import type { FeatureTicketRow } from "./page"

type MessageRow = {
  id: string
  message: string
  is_staff: boolean
  sender_name: string | null
  created_at: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open:        { label: "Nový",          color: "text-blue-700 bg-blue-50" },
  planned:     { label: "Naplánované",   color: "text-purple-700 bg-purple-50" },
  in_progress: { label: "Vo vývoji",     color: "text-yellow-700 bg-yellow-50" },
  done:        { label: "Hotové",        color: "text-teal-700 bg-teal-50" },
  closed:      { label: "Zamietnuté",    color: "text-gray-600 bg-gray-100" },
}

const STATUS_ACTIONS = [
  { value: "open",        label: "Nový" },
  { value: "planned",     label: "Naplánované" },
  { value: "in_progress", label: "Vo vývoji" },
  { value: "done",        label: "Hotové" },
  { value: "closed",      label: "Zamietnuť" },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function FeatureDetail({
  ticket,
  onClose,
  onStatusChange,
}: {
  ticket: FeatureTicketRow
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [messages, setMessages] = useState<MessageRow[] | null>(null)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [statusError, setStatusError] = useState("")
  const [replyError, setReplyError] = useState("")
  const [replyKey, setReplyKey] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingMsgs(true)
    fetch(`/api/super-admin/support/${ticket.id}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false))
  }, [ticket.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleStatus = (status: string) => {
    startTransition(async () => {
      const result = await updateFeatureStatus(ticket.id, status)
      if (result?.error) { setStatusError(result.error); return }
      onStatusChange(ticket.id, status)
      setStatusError("")
      router.refresh()
    })
  }

  const handleReply = (formData: FormData) => {
    startTransition(async () => {
      const result = await replyToFeature(ticket.id, formData)
      if (result?.error) { setReplyError(result.error); return }
      const msg = formData.get("message") as string
      setMessages((prev) =>
        prev
          ? [
              ...prev,
              {
                id: crypto.randomUUID(),
                message: msg,
                is_staff: true,
                sender_name: "Super Admin",
                created_at: new Date().toISOString(),
              },
            ]
          : null
      )
      setReplyError("")
      setReplyKey((k) => k + 1)
      router.refresh()
    })
  }

  const sc = statusConfig[ticket.status] ?? { label: ticket.status, color: "text-gray-600 bg-gray-100" }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{ticket.subject}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{ticket.org_name} · {ticket.creator_name ?? "-"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Status bar */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.color}`}>{sc.label}</span>
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {STATUS_ACTIONS.map((s) => (
              <button
                key={s.value}
                disabled={isPending || ticket.status === s.value}
                onClick={() => handleStatus(s.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                  ticket.status === s.value
                    ? "border-gray-300 bg-gray-100 text-gray-500"
                    : "border-gray-200 hover:border-gray-400 text-gray-600"
                }`}
              >
                {ticket.status === s.value && <Check size={10} className="inline mr-0.5" />}
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {statusError && <p className="px-6 py-2 text-sm text-red-600 bg-red-50">{statusError}</p>}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
          {loadingMsgs ? (
            <div className="text-center text-sm text-gray-400 py-8">Načítavam správy…</div>
          ) : messages?.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-8">Žiadne správy</div>
          ) : (
            messages?.map((m) => (
              <div key={m.id} className={`flex ${m.is_staff ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    m.is_staff ? "text-white" : "bg-white text-gray-900 shadow-sm"
                  }`}
                  style={m.is_staff ? { backgroundColor: "var(--brand-orange)" } : {}}
                >
                  <p className={`text-xs font-medium mb-1 ${m.is_staff ? "text-orange-100" : "text-gray-500"}`}>
                    {m.is_staff ? "Super Admin" : (m.sender_name ?? ticket.org_name)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  <p className={`text-xs mt-1.5 ${m.is_staff ? "text-orange-200" : "text-gray-400"}`}>
                    {new Date(m.created_at).toLocaleString("sk-SK")}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply */}
        <div className="p-6 border-t border-gray-100">
          {replyError && <p className="text-sm text-red-600 mb-2">{replyError}</p>}
          <form key={replyKey} action={handleReply} className="flex gap-3">
            <input
              name="message"
              type="text"
              placeholder="Odpovedať alebo pridať komentár…"
              required
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              Odoslať
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function FeatureLogsClient({ tickets: initial }: { tickets: FeatureTicketRow[] }) {
  const [tickets, setTickets] = useState(initial)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<FeatureTicketRow | null>(null)

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.subject.toLowerCase().includes(q) || t.org_name.toLowerCase().includes(q)
    const matchStatus = statusFilter === "all" || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const newCount = tickets.filter((t) => t.status === "open").length
  const plannedCount = tickets.filter((t) => t.status === "planned" || t.status === "in_progress").length

  const handleStatusChange = (id: string, status: string) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s)
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Logs</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tickets.length} návrhov ·{" "}
            <span className="text-blue-600 font-medium">{newCount} nových</span>
            {plannedCount > 0 && (
              <> · <span className="text-purple-600 font-medium">{plannedCount} v pláne</span></>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Hľadať podľa nápadu alebo org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
        >
          <option value="all">Všetky statusy</option>
          <option value="open">Nové</option>
          <option value="planned">Naplánované</option>
          <option value="in_progress">Vo vývoji</option>
          <option value="done">Hotové</option>
          <option value="closed">Zamietnuté</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Lightbulb size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{tickets.length === 0 ? "Žiadne návrhy" : "Žiadne výsledky"}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Nápad
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Organizácia
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Správ
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pridané
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t) => {
                const sc = statusConfig[t.status] ?? { label: t.status, color: "text-gray-600 bg-gray-100" }
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                          <Lightbulb size={13} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm truncate max-w-xs">{t.subject}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{t.creator_name ?? "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.org_name}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{t.message_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{timeAgo(t.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <FeatureDetail
          ticket={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
