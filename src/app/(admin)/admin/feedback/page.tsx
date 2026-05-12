import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createAdminClient } from "@/lib/supabase/server"
import FeedbackClient from "./FeedbackClient"

export type AdminTicketRow = {
  id: string
  subject: string
  ticket_type: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  message_count: number
}

export default async function FeedbackPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const admin = createAdminClient()

  const [ticketsResult, messagesResult] = await Promise.all([
    (admin as any)
      .from("support_tickets")
      .select("id, subject, ticket_type, status, priority, created_at, updated_at")
      .eq("organization_id", ctx.org.id)
      .order("updated_at", { ascending: false }),
    admin
      .from("support_messages")
      .select("ticket_id, id"),
  ])

  const msgCountMap = new Map<string, number>()
  for (const m of messagesResult.data ?? []) {
    msgCountMap.set(m.ticket_id, (msgCountMap.get(m.ticket_id) ?? 0) + 1)
  }

  const tickets: AdminTicketRow[] = (ticketsResult.data ?? []).map((t: any) => ({
    ...t,
    ticket_type: t.ticket_type ?? "support",
    message_count: msgCountMap.get(t.id) ?? 0,
  }))

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <div className="px-8 py-5 border-b border-gray-100 bg-white shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Podpora & Nápady</h1>
        <p className="text-gray-500 text-sm mt-1">
          Odošlite požiadavku na podporu alebo zdieľajte nápad s Waiterco tímom
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <FeedbackClient tickets={tickets} />
      </div>
    </div>
  )
}
