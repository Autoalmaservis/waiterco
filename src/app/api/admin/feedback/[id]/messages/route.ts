import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .single()

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: messages } = await admin
    .from("support_messages")
    .select("id, message, is_staff, sender_id, created_at")
    .eq("ticket_id", id)
    .order("created_at")

  const enriched = (messages ?? []).map((m) => ({
    ...m,
    sender_name: m.is_staff ? "Waiterco Support" : null,
  }))

  return NextResponse.json({ messages: enriched })
}
