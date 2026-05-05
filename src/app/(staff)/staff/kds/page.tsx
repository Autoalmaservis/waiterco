import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import KDSClient from "./KDSClient"

export default async function KDSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venueStaff } = await supabase
    .from("venue_staff")
    .select("venue_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!venueStaff?.venue_id) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        <p>Nie ste priradený k žiadnej prevádzke.</p>
      </div>
    )
  }

  const venueId = venueStaff.venue_id
  const staffRole = (venueStaff.role ?? "cook") as "cook" | "barman" | "manager" | "waiter"

  const [ordersResult, tablesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, table_id, order_number, round_number, status, notes, created_at")
      .eq("venue_id", venueId)
      .in("status", ["pending", "confirmed", "preparing", "ready"])
      .order("created_at", { ascending: true }),

    supabase
      .from("tables")
      .select("id, name")
      .eq("venue_id", venueId)
      .eq("is_active", true),
  ])

  const orders = ordersResult.data ?? []
  const orderIds = orders.map(o => o.id)

  let orderItems: { id: string; order_id: string; name: string; quantity: number; status: string; station: string }[] = []
  let orderItemModifiers: { id: string; order_item_id: string; modifier_id: string; name: string; price: number }[] = []
  if (orderIds.length > 0) {
    const { data: itemsData } = await (supabase as any)
      .from("order_items")
      .select("id, order_id, name, quantity, status, station")
      .in("order_id", orderIds)
      .neq("status", "cancelled")
    orderItems = itemsData ?? []

    const itemIds = orderItems.map(i => i.id)
    if (itemIds.length > 0) {
      const { data: modsData } = await (supabase as any)
        .from("order_item_modifiers")
        .select("id, order_item_id, modifier_id, name, price")
        .in("order_item_id", itemIds)
      orderItemModifiers = modsData ?? []
    }
  }

  const tableMap = Object.fromEntries(
    (tablesResult.data ?? []).map((t) => [t.id, t.name])
  )

  return (
    <KDSClient
      venueId={venueId}
      staffRole={staffRole}
      initialOrders={orders}
      initialItems={orderItems}
      initialOrderItemModifiers={orderItemModifiers}
      tableMap={tableMap}
    />
  )
}
