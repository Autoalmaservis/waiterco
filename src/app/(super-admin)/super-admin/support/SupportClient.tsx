'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Search, ChevronRight, Send, AlertCircle, Clock, CheckCircle, XCircle, Check } from 'lucide-react'
import { updateTicketStatus, replyToTicket } from './actions'
import type { TicketRow, MessageRow } from './page'

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:        { label: 'Otvorený',  color: 'text-blue-700 bg-blue-50',    icon: <AlertCircle size={12} /> },
  in_progress: { label: 'Rieši sa', color: 'text-yellow-700 bg-yellow-50', icon: <Clock size={12} /> },
  resolved:    { label: 'Vyriešený',color: 'text-green-700 bg-green-50',   icon: <CheckCircle size={12} /> },
  closed:      { label: 'Uzavretý', color: 'text-gray-600 bg-gray-100',    icon: <XCircle size={12} /> },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  low:    { label: 'Nizka',    color: 'text-gray-500 bg-gray-50' },
  normal: { label: 'Normalna', color: 'text-blue-600 bg-blue-50' },
  high:   { label: 'Vysoka',   color: 'text-orange-600 bg-orange-50' },
  urgent: { label: 'Urgentna', color: 'text-red-600 bg-red-50' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function TicketDetail({
  ticket,
  onClose,
  onStatusChange,
}: {
  ticket: TicketRow
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStatus, setCurrentStatus] = useState(ticket.status)
  const [messages, setMessages] = useState<MessageRow[] | null>(null)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [replyError, setReplyError] = useState('')
  const [replyKey, setReplyKey] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingMsgs(true)
    fetch(`/api/super-admin/support/${ticket.id}/messages`)
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false))
  }, [ticket.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStatus = (status: string) => {
    startTransition(async () => {
      const result = await updateTicketStatus(ticket.id, status)
      if (result?.error) {
        setStatusError(result.error)
      } else {
        setStatusError('')
        setCurrentStatus(status)
        onStatusChange(ticket.id, status)
        router.refresh()
      }
    })
  }

  const handleReply = (formData: FormData) => {
    startTransition(async () => {
      const result = await replyToTicket(ticket.id, formData)
      if (result?.error) {
        setReplyError(result.error)
      } else {
        setReplyError('')
        const msg = formData.get('message') as string
        setMessages(prev => prev ? [...prev, {
          id: crypto.randomUUID(),
          ticket_id: ticket.id,
          sender_id: null,
          sender_name: 'Super Admin',
          message: msg,
          is_staff: true,
          created_at: new Date().toISOString(),
        }] : null)
        setReplyKey(k => k + 1)
        router.refresh()
      }
    })
  }

  const sc = statusConfig[currentStatus] ?? { label: currentStatus, color: 'text-gray-600 bg-gray-100', icon: null }
  const pc = priorityConfig[ticket.priority] ?? { label: ticket.priority, color: 'text-gray-500 bg-gray-50' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{ticket.subject}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{ticket.org_name} · {ticket.creator_name ?? '-'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Status bar */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.color}`}>
            {sc.icon}{sc.label}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${pc.color}`}>{pc.label}</span>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <span className="text-xs text-gray-400">Zmenit status:</span>
            {['open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button
                key={s}
                disabled={isPending || currentStatus === s}
                onClick={() => handleStatus(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                  currentStatus === s
                    ? 'border-gray-400 bg-gray-100 text-gray-600 font-medium'
                    : 'border-gray-200 hover:border-gray-400 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {currentStatus === s && <Check size={9} className="inline mr-0.5" />}
                {statusConfig[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
        {statusError && <p className="px-6 py-2 text-sm text-red-600 bg-red-50">{statusError}</p>}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
          {loadingMsgs ? (
            <div className="text-center text-sm text-gray-400 py-8">Nacitavam spravy...</div>
          ) : messages?.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-8">Ziadne spravy</div>
          ) : messages?.map(m => (
            <div key={m.id} className={`flex ${m.is_staff ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.is_staff ? 'bg-orange-500 text-white' : 'bg-white text-gray-900 shadow-sm'}`}>
                <p className={`text-xs font-medium mb-1 ${m.is_staff ? 'text-orange-100' : 'text-gray-500'}`}>
                  {m.is_staff ? 'Super Admin' : (m.sender_name ?? 'Admin')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className={`text-xs mt-1.5 ${m.is_staff ? 'text-orange-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleString('sk-SK')}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Reply */}
        <div className="p-6 border-t border-gray-100">
          {replyError && <p className="text-sm text-red-600 mb-2">{replyError}</p>}
          <form key={replyKey} action={handleReply} className="flex gap-3">
            <input
              name="message"
              type="text"
              placeholder="Napisat odpoved..."
              required
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />Odoslat
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SupportClient({ tickets: initial }: { tickets: TicketRow[] }) {
  const [tickets, setTickets] = useState(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selected, setSelected] = useState<TicketRow | null>(null)

  const handleStatusChange = (id: string, status: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s)
  }

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.subject.toLowerCase().includes(q) || t.org_name.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter
    return matchSearch && matchStatus && matchPriority
  })

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Podpora</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tickets.length} ticketov · <span className="text-blue-600 font-medium">{openCount} otvorenych</span>
            {inProgressCount > 0 && <> · <span className="text-yellow-600 font-medium">{inProgressCount} riesi sa</span></>}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Hladat podla predmetu alebo org..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
        >
          <option value="all">Vsetky statusy</option>
          <option value="open">Otvoreny</option>
          <option value="in_progress">Riesi sa</option>
          <option value="resolved">Vyriešeny</option>
          <option value="closed">Uzavrety</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
        >
          <option value="all">Vsetky priority</option>
          <option value="urgent">Urgentna</option>
          <option value="high">Vysoka</option>
          <option value="normal">Normalna</option>
          <option value="low">Nizka</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageSquare size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{tickets.length === 0 ? 'Ziadne tickety' : 'Ziadne vysledky'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Predmet</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organizacia</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Priorita</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sprav</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Aktualizacia</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => {
                const sc = statusConfig[t.status] ?? { label: t.status, color: 'text-gray-600 bg-gray-100', icon: null }
                const pc = priorityConfig[t.priority] ?? { label: t.priority, color: 'text-gray-500 bg-gray-50' }
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 text-sm truncate max-w-xs">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.creator_name ?? '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.org_name}</td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1 w-fit text-xs font-medium px-2 py-0.5 rounded-full ${sc.color}`}>
                        {sc.icon}{sc.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pc.color}`}>{pc.label}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{t.message_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{timeAgo(t.updated_at)}</td>
                    <td className="px-6 py-4">
                      <ChevronRight size={16} className="text-gray-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <TicketDetail
          ticket={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
