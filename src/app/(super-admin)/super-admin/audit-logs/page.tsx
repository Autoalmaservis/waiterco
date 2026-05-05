import { createClient } from "@/lib/supabase/server"
import AuditLogsClient from "./AuditLogsClient"

export type AuditRow = {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export default async function AuditLogsPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, actor_id, actor_role, action, resource_type, resource_id, old_data, new_data, ip_address, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  const actorIds = [...new Set((logs ?? []).filter(l => l.actor_id).map(l => l.actor_id!))]

  let namesMap = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    profiles?.forEach(p => namesMap.set(p.id, p.full_name ?? p.id))
  }

  const rows: AuditRow[] = (logs ?? []).map(l => ({
    ...l,
    actor_name: l.actor_id ? (namesMap.get(l.actor_id) ?? l.actor_id) : null,
  }))

  return (
    <div className="p-8">
      <AuditLogsClient logs={rows} />
    </div>
  )
}
