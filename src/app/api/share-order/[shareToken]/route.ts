import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getSessionOrders } from "@/app/(menu)/menu/[token]/actions"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params
  const admin = createAdminClient()

  const { data: session } = await admin
    .from("table_sessions")
    .select("id, status, table_id, venue_id")
    .eq("share_token", shareToken)
    .single()

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [venueResult, tableResult, ordersResult] = await Promise.all([
    admin.from("venues").select("name, currency, primary_color").eq("id", session.venue_id).single(),
    admin.from("tables").select("name").eq("id", session.table_id).single(),
    getSessionOrders(session.id),
  ])

  return NextResponse.json({
    sessionId: session.id,
    venueName: venueResult.data?.name ?? "",
    tableName: tableResult.data?.name ?? "",
    currency: venueResult.data?.currency ?? "EUR",
    primaryColor: venueResult.data?.primary_color ?? null,
    orders: ordersResult.orders,
    sessionStatus: ordersResult.sessionStatus,
    grandTotal: ordersResult.grandTotal,
  })
}
