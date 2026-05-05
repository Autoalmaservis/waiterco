"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Lightbulb, Send, Plus, ArrowLeft } from "lucide-react"
import { createFeedbackTicket, sendFeedbackMessage } from "./actions"
import type { AdminTicketRow } from "./page"

type MessageRow = {
  id: string
  message: string
  is_staff: boolean
  sender_name: string | null
  created_at: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open:        { label: "Otvorené",     color: "text-blue-700 bg-blue-50" },
  in_progress: { label: "Rieši sa",    color: "text-yellow-700 bg-yellow-50" },
  resolved:    { label: "Vyriešené",   color: "text-green-700 bg-green-50" },
  closed:      { label: "Uzavreté",    color: "text-gray-600 bg-gray-100" },
  planned:     { label: "Naplánované", color: "text-purple-700 bg-purple-50" },
  done:        { label: "Hotové",      color: "text-teal-700 bg-teal-50" },
}

export default function FeedbackClient({ tickets }: { tickets: AdminTicketRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<"idle" | "compose" | "chat">("idle")
  const [ticketType, setTicketType] = useState<"support" | "feature">("support")
  const [selected, setSelected] = useState<AdminTicketRow | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [success, setSuccess] = useState("")
  const [composeError, setComposeError] = useState("")
  const [replyError, setReplyError] = useState("")
  const [replyKey, setReplyKey] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const openTicket = (ticket: AdminTicketRow) => {
    setSelected(ticket)
    setMessages([])
    setLoadingMsgs(true)
    setView("chat")
    fetch(`/api/admin/feedback/${ticket.id}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false))
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (formData: FormData) => {
    formData.set("ticket_type", ticketType)
    setComposeError("")
    setSuccess("")
    startTransition(async () => {
      const result = await createFeedbackTicket(formData)
      if (result?.error) { setComposeError(result.error); return }
      setSuccess(
        ticketType === "support"
          ? "Správa odoslaná. Odpovieme čoskoro."
          : "Nápad odoslaný. Ďakujeme za spätnú väzbu!"
      )
      router.refresh()
      setTimeout(() => { setView("idle"); setSuccess("") }, 2000)
    })
  }

  const handleReply = (formData: FormData) => {
    if (!selected) return
    const message = (formData.get("message") as string)?.trim()
    if (!message) return
    setReplyError("")
    startTransition(async () => {
      const result = await sendFeedbackMessage(selected.id, message)
      if (result?.error) { setReplyError(result.error); return }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          message,
          is_staff: false,
          sender_name: "Vy",
          created_at: new Date().toISOString(),
        },
      ])
      setReplyKey((k) => k + 1)
    })
  }

  const isClosed = (status: string) => status === "closed" || status === "done"

  return (
    <div className="flex" style={{ height: "calc(100vh - 120px)" }}>
      {/* Left panel — ticket list */}
      <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={() => { setSelected(null); setView("compose") }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            <Plus size={15} />
            Nová správa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {tickets.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Zatiaľ žiadne správy
            </div>
          ) : (
            tickets.map((t) => {
              const sc = statusConfig[t.status] ?? { label: t.status, color: "text-gray-600 bg-gray-100" }
              const isFeature = t.ticket_type === "feature"
              const isActive = selected?.id === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${isActive ? "bg-orange-50 border-l-2 border-orange-400" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isFeature ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {isFeature ? <Lightbulb size={13} /> : <MessageSquare size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${sc.color}`}>
                          {sc.label}
                        </span>
                        {t.message_count > 0 && (
                          <span className="text-xs text-gray-400">{t.message_count} spr.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Idle state */}
        {view === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <MessageSquare size={36} className="opacity-20" />
            <p className="text-sm">Vyberte správu alebo vytvorte novú</p>
          </div>
        )}

        {/* Compose */}
        {view === "compose" && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-8">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setView("idle")}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-semibold text-gray-900">Nová správa</h2>
              </div>

              {/* Type selector */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setTicketType("support")}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    ticketType === "support"
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Podpora / Problém</p>
                    <p className="text-xs text-gray-500 mt-0.5">Technický problém alebo otázka</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTicketType("feature")}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    ticketType === "feature"
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Lightbulb size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Nápad / Funkcia</p>
                    <p className="text-xs text-gray-500 mt-0.5">Návrh novej funkcie alebo vylepšenia</p>
                  </div>
                </button>
              </div>

              <form action={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Predmet *</label>
                  <input
                    name="subject"
                    required
                    placeholder={ticketType === "support" ? "Popis problému…" : "Názov nápadu…"}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                {ticketType === "support" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Priorita</label>
                    <select
                      name="priority"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    >
                      <option value="normal">Normálna</option>
                      <option value="high">Vysoká</option>
                      <option value="urgent">Urgentná</option>
                      <option value="low">Nízka</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {ticketType === "support" ? "Popis problému *" : "Popis nápadu *"}
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={7}
                    placeholder={
                      ticketType === "support"
                        ? "Opíšte čo sa deje, kroky na reprodukciu, čo ste očakávali…"
                        : "Opíšte funkciu, prečo by bola užitočná, ako by mala fungovať…"
                    }
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>

                {composeError && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{composeError}</p>
                )}
                {success && (
                  <p className="text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg">{success}</p>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60 hover:opacity-90"
                    style={{ backgroundColor: "var(--brand-orange)" }}
                  >
                    <Send size={14} />
                    {isPending ? "Odosielajem…" : "Odoslať"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Chat */}
        {view === "chat" && selected && (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
              <button
                onClick={() => { setView("idle"); setSelected(null) }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900 text-sm truncate">{selected.subject}</h2>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      (statusConfig[selected.status] ?? { color: "text-gray-600 bg-gray-100" }).color
                    }`}
                  >
                    {(statusConfig[selected.status] ?? { label: selected.status }).label}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      selected.ticket_type === "feature"
                        ? "text-purple-700 bg-purple-50"
                        : "text-blue-700 bg-blue-50"
                    }`}
                  >
                    {selected.ticket_type === "feature" ? "Nápad" : "Podpora"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selected.created_at).toLocaleDateString("sk-SK")}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
              {loadingMsgs ? (
                <div className="text-center text-sm text-gray-400 py-8">Načítavam…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-8">Žiadne správy</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${!m.is_staff ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        !m.is_staff ? "text-white" : "bg-white text-gray-900 shadow-sm"
                      }`}
                      style={!m.is_staff ? { backgroundColor: "var(--brand-teal)" } : {}}
                    >
                      <p
                        className={`text-xs font-medium mb-1 ${
                          !m.is_staff ? "text-teal-100" : "text-gray-500"
                        }`}
                      >
                        {m.is_staff ? "eWaiter Support" : "Vy"}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      <p
                        className={`text-xs mt-1.5 ${
                          !m.is_staff ? "text-teal-200" : "text-gray-400"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleString("sk-SK")}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            {!isClosed(selected.status) && (
              <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                {replyError && <p className="text-sm text-red-600 mb-2">{replyError}</p>}
                <form key={replyKey} action={handleReply} className="flex gap-3">
                  <input
                    name="message"
                    type="text"
                    placeholder="Napísať správu…"
                    required
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center justify-center w-10 h-10 rounded-xl text-white disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
                    style={{ backgroundColor: "var(--brand-orange)" }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
