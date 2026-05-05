import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import OrdersClient from "./OrdersClient"

export default async function OrdersPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const supabase = await createClient()
  const venueIds = ctx.venues.map((v) => v.id)

  if (venueIds.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Objednávky</h1>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Žiadne prevádzky
        </div>
      </div>
    )
  }

  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const [ordersResult, tablesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .in("venue_id", venueIds)
      .gte("created_at", monthAgo.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("tables")
      .select("id, name")
      .in("venue_id", venueIds),
  ])

  const tableMap = Object.fromEntries((tablesResult.data ?? []).map((t) => [t.id, t.name]))

  return (
    <div className="p-8">
      <OrdersClient orders={ordersResult.data ?? []} venues={ctx.venues} tableMap={tableMap} />
    </div>
  )
}
