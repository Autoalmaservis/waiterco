import { redirect } from "next/navigation"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import FeatureLogsClient from "./FeatureLogsClient"

export type FeatureTicketRow = {
  id: string
  subject: string
  status: string
  created_at: string
  updated_at: string
  organization_id: string
  org_name: string
  created_by: string | null
  creator_name: string | null
  message_count: number
}

export default async function FeatureLogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "super_admin") redirect("/login")

  const adminSupabase = createAdminClient()

  const [ticketsResult, orgsResult, messagesResult] = await Promise.all([
    adminSupabase
      .from("support_tickets")
      .select("id, subject, status, created_at, updated_at, organization_id, created_by")
      .eq("ticket_type" as any, "feature")
      .order("updated_at", { ascending: false }),
    adminSupabase.from("organizations").select("id, name"),
    adminSupabase.from("support_messages").select("ticket_id, id"),
  ])

  const orgsMap = new Map(orgsResult.data?.map((o) => [o.id, o.name]) ?? [])

  const creatorIds = [
    ...new Set(
      (ticketsResult.data ?? []).filter((t) => t.created_by).map((t) => t.created_by!)
    ),
  ]

  const creatorsMap = new Map<string, string>()
  if (creatorIds.length > 0) {
    const { data: { users } } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const profilesResult = await adminSupabase
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds)
    const profilesMap = new Map(profilesResult.data?.map((p) => [p.id, p.full_name]) ?? [])
    users.forEach((u) => {
      creatorsMap.set(u.id, profilesMap.get(u.id) || u.email || u.id)
    })
  }

  const msgCountMap = new Map<string, number>()
  for (const m of messagesResult.data ?? []) {
    msgCountMap.set(m.ticket_id, (msgCountMap.get(m.ticket_id) ?? 0) + 1)
  }

  const tickets: FeatureTicketRow[] = (ticketsResult.data ?? []).map((t) => ({
    ...t,
    org_name: orgsMap.get(t.organization_id) ?? "-",
    creator_name: t.created_by ? (creatorsMap.get(t.created_by) ?? null) : null,
    message_count: msgCountMap.get(t.id) ?? 0,
  }))

  return (
    <div className="p-8">
      <FeatureLogsClient tickets={tickets} />
    </div>
  )
}
