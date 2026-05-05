import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import VenueSelector from "../VenueSelector"
import StatsClient from "./StatsClient"

type Period = "today" | "7days" | "month"

function getPresetRange(period: Period): { from: Date; to: Date } {
  const from = new Date()
  const to = new Date()
  if (period === "today") {
    from.setHours(0, 0, 0, 0)
  } else if (period === "7days") {
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }
  return { from, to }
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; period?: string; from?: string; to?: string }>
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const { venue: venueParam, period: periodParam, from: fromParam, to: toParam } = await searchParams

  const period: Period = (["today", "7days", "month"].includes(periodParam ?? "")
    ? periodParam
    : "month") as Period

  const selectedVenueId =
    ctx.venues.find((v) => v.id === venueParam)?.id ?? ctx.venues[0]?.id

  if (!selectedVenueId) {
    return (
      <div className="p-8 text-gray-400 text-sm">
        Žiadne prevádzky. Pridajte prevádzku v sekcii Prevádzky.
      </div>
    )
  }

  const selectedVenue = ctx.venues.find((v) => v.id === selectedVenueId)!
  const supabase = await createClient()

  // Determine date range — custom (from/to params) overrides preset period
  const isCustom = !!(fromParam && toParam)
  let fromDate: Date
  let toDate: Date

  if (isCustom) {
    fromDate = new Date(fromParam + "T00:00:00")
    toDate = new Date(toParam + "T23:59:59")
  } else {
    const range = getPresetRange(period)
    fromDate = range.from
    toDate = range.to
  }

  const [ordersResult, paymentsResult, tablesResult, staffResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, table_id, status, total_amount, created_at")
      .eq("venue_id", selectedVenueId)
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString())
      .order("created_at", { ascending: true }),

    supabase
      .from("payments")
      .select("total_amount, payment_method, created_at")
      .eq("venue_id", selectedVenueId)
      .eq("status", "completed")
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString()),

    supabase
      .from("tables")
      .select("id, name")
      .eq("venue_id", selectedVenueId),

    supabase
      .from("venue_staff")
      .select("id, user_id, role, is_active, joined_at")
      .eq("venue_id", selectedVenueId)
      .eq("is_active", true),
  ])

  const orders = ordersResult.data ?? []
  const payments = paymentsResult.data ?? []
  const tables = tablesResult.data ?? []
  const staff = staffResult.data ?? []

  // Fetch order items for all orders in the period
  const orderIds = orders.map((o) => o.id)
  let orderItems: { name: string; quantity: number; total_price: number }[] = []
  if (orderIds.length > 0) {
    const chunks: string[][] = []
    for (let i = 0; i < orderIds.length; i += 100) chunks.push(orderIds.slice(i, i + 100))
    for (const chunk of chunks) {
      const { data } = await supabase
        .from("order_items")
        .select("name, quantity, total_price, status")
        .in("order_id", chunk)
        .neq("status", "cancelled")
      orderItems = orderItems.concat(data ?? [])
    }
  }

  // Fetch staff profiles
  const staffUserIds = staff.map((s) => s.user_id)
  let staffProfiles: { id: string; full_name: string | null }[] = []
  if (staffUserIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", staffUserIds)
    staffProfiles = data ?? []
  }

  // --- Aggregation ---
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t.name]))
  const profileMap = Object.fromEntries(staffProfiles.map((p) => [p.id, p.full_name]))

  const totalRevenue = payments.reduce((s, p) => s + Number(p.total_amount), 0)
  const totalOrders = orders.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const cashRevenue = payments
    .filter((p) => p.payment_method === "cash")
    .reduce((s, p) => s + Number(p.total_amount), 0)
  const cardRevenue = payments
    .filter((p) => p.payment_method === "card")
    .reduce((s, p) => s + Number(p.total_amount), 0)

  // Status breakdown
  const statusMap: Record<string, number> = {}
  for (const o of orders) {
    statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  }
  const statusBreakdown = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  // Top items
  const itemMap: Record<string, { quantity: number; revenue: number }> = {}
  for (const i of orderItems) {
    if (!itemMap[i.name]) itemMap[i.name] = { quantity: 0, revenue: 0 }
    itemMap[i.name].quantity += i.quantity
    itemMap[i.name].revenue += Number(i.total_price)
  }
  const topItems = Object.entries(itemMap)
    .map(([name, { quantity, revenue }]) => ({ name, quantity, revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)

  // Table stats
  const tableRevMap: Record<string, { orderCount: number; revenue: number }> = {}
  for (const o of orders) {
    if (!tableRevMap[o.table_id]) tableRevMap[o.table_id] = { orderCount: 0, revenue: 0 }
    tableRevMap[o.table_id].orderCount++
    tableRevMap[o.table_id].revenue += Number(o.total_amount)
  }
  const tableStats = Object.entries(tableRevMap)
    .map(([tableId, { orderCount, revenue }]) => ({
      tableId,
      tableName: tableMap[tableId] ?? "Stôl",
      orderCount,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Time series
  // Hourly: single day (today preset OR custom single-day)
  // Daily: everything else
  const isSingleDay = isCustom
    ? fromParam === toParam
    : period === "today"

  const timeMap: Record<string, { revenue: number; orderCount: number }> = {}

  if (isSingleDay) {
    for (let h = 0; h < 24; h++) {
      timeMap[String(h).padStart(2, "0")] = { revenue: 0, orderCount: 0 }
    }
    for (const p of payments) {
      const h = String(new Date(p.created_at).getHours()).padStart(2, "0")
      if (timeMap[h]) timeMap[h].revenue += Number(p.total_amount)
    }
    for (const o of orders) {
      const h = String(new Date(o.created_at).getHours()).padStart(2, "0")
      if (timeMap[h]) timeMap[h].orderCount++
    }
  } else if (isCustom) {
    // Daily buckets from fromDate to toDate
    const cur = new Date(fromDate)
    cur.setHours(0, 0, 0, 0)
    const end = new Date(toDate)
    end.setHours(23, 59, 59, 999)
    while (cur <= end) {
      const key = `${cur.getDate()}.${cur.getMonth() + 1}.`
      timeMap[key] = { revenue: 0, orderCount: 0 }
      cur.setDate(cur.getDate() + 1)
    }
    for (const p of payments) {
      const d = new Date(p.created_at)
      const key = `${d.getDate()}.${d.getMonth() + 1}.`
      if (timeMap[key]) timeMap[key].revenue += Number(p.total_amount)
    }
    for (const o of orders) {
      const d = new Date(o.created_at)
      const key = `${d.getDate()}.${d.getMonth() + 1}.`
      if (timeMap[key]) timeMap[key].orderCount++
    }
  } else {
    const days = period === "7days" ? 7 : new Date().getDate()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getDate()}.${d.getMonth() + 1}.`
      timeMap[key] = { revenue: 0, orderCount: 0 }
    }
    for (const p of payments) {
      const d = new Date(p.created_at)
      const key = `${d.getDate()}.${d.getMonth() + 1}.`
      if (timeMap[key]) timeMap[key].revenue += Number(p.total_amount)
    }
    for (const o of orders) {
      const d = new Date(o.created_at)
      const key = `${d.getDate()}.${d.getMonth() + 1}.`
      if (timeMap[key]) timeMap[key].orderCount++
    }
  }

  const timeSeries = Object.entries(timeMap).map(([label, { revenue, orderCount }]) => ({
    label,
    revenue,
    orderCount,
  }))

  // Staff list
  const staffList = staff.map((s) => ({
    id: s.id,
    name: profileMap[s.user_id] ?? "Neznámy",
    role: s.role,
    joinedAt: s.joined_at,
  }))

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Štatistiky</h1>
          <p className="text-gray-500 text-sm mt-1">{selectedVenue.name}</p>
        </div>
        {ctx.venues.length > 1 && (
          <VenueSelector
            venues={ctx.venues}
            selectedVenueId={selectedVenueId}
            basePath="/admin/stats"
          />
        )}
      </div>

      <StatsClient
        period={period}
        venueId={selectedVenueId}
        customFrom={isCustom ? fromParam : undefined}
        customTo={isCustom ? toParam : undefined}
        totalRevenue={totalRevenue}
        totalOrders={totalOrders}
        avgOrderValue={avgOrderValue}
        cashRevenue={cashRevenue}
        cardRevenue={cardRevenue}
        statusBreakdown={statusBreakdown}
        topItems={topItems}
        tableStats={tableStats}
        timeSeries={timeSeries}
        staffList={staffList}
        isSingleDay={isSingleDay}
      />
    </div>
  )
}
