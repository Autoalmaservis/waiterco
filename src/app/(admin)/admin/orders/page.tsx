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

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .in("venue_id", venueIds)
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false })

  return (
    <div className="p-8">
      <OrdersClient orders={orders ?? []} venues={ctx.venues} />
    </div>
  )
}
