import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import WaiterClient from "./WaiterClient"

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venueStaff } = await (supabase as any)
    .from("venue_staff")
    .select("venue_id, role, position_id, permissions")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!venueStaff?.venue_id) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        <p>Nie ste priradeny k ziadnej prevadzke. Kontaktujte spravcu.</p>
      </div>
    )
  }

  let permissions: string[] = []
  if (venueStaff.permissions !== null && venueStaff.permissions !== undefined) {
    permissions = venueStaff.permissions
  } else if (venueStaff.position_id) {
    const admin = createAdminClient()
    const { data: pos } = await (admin as any).from("positions").select("permissions").eq("id", venueStaff.position_id).single()
    permissions = pos?.permissions ?? []
  }

  const hasWaiterPerms = permissions.length === 0
    || permissions.some((p: string) => ["waiter_calls", "tables", "orders"].includes(p))
  const hasKdsPerms = permissions.some((p: string) => ["kitchen", "bar"].includes(p))

  if (!hasWaiterPerms && hasKdsPerms) redirect("/staff/kds")
  if (permissions.length === 0 && (venueStaff.role === "cook" || venueStaff.role === "barman")) redirect("/staff/kds")

  const venueId = venueStaff.venue_id

  // Fetch sessions first — orders are filtered by active session IDs so we capture
  // delivered-but-unpaid orders (waiter confirmed delivery, payment not yet done)
  const [callsResult, sessionsResult, tablesResult, zonesResult, categoriesResult, menuItemsResult] = await Promise.all([
    supabase.from("waiter_calls")
      .select("id, table_id, session_id, reason, custom_message, status, created_at, acknowledged_at")
      .eq("venue_id", venueId)
      .in("status", ["pending", "acknowledged"])
      .order("created_at", { ascending: false }),

    supabase.from("table_sessions")
      .select("id, table_id, status, customer_count, opened_at")
      .eq("venue_id", venueId)
      .eq("status", "active")
      .order("opened_at", { ascending: false }),

    supabase.from("tables")
      .select("id, name, x_pos, y_pos, shape, capacity")
      .eq("venue_id", venueId)
      .eq("is_active", true),

    supabase.from("venue_zones")
      .select("id, name, x_pos, y_pos, w, h, color")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase.from("menu_categories")
      .select("id, name, sort_order")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    (supabase as any).from("menu_items")
      .select("id, category_id, name, base_price, station")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .eq("is_available", true)
      .order("sort_order", { ascending: true }),
  ])

  // Fetch all non-cancelled orders for active sessions (includes delivered-but-unpaid)
  const activeSessionIds = (sessionsResult.data ?? []).map((s) => s.id)
  let ordersData: any[] = []
  if (activeSessionIds.length > 0) {
    const { data } = await supabase
      .from("orders")
      .select("id, session_id, table_id, order_number, round_number, status, total_amount, notes, created_at, order_type, customer_name, customer_phone, delivery_address")
      .in("session_id", activeSessionIds)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
    ordersData = data ?? []
  }

  // Fetch order items for all fetched orders
  const activeOrderIds = ordersData.map((o) => o.id)
  let itemsData: any[] = []
  let orderItemModifiersData: any[] = []
  if (activeOrderIds.length > 0) {
    const [itemsResult, modifiersResult] = await Promise.all([
      (supabase as any)
        .from("order_items")
        .select("id, order_id, item_id, name, quantity, unit_price, total_price, status, notes, station")
        .in("order_id", activeOrderIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("order_item_modifiers")
        .select("id, order_item_id, modifier_id, name, price")
        .in("order_item_id",
          (await (supabase as any)
            .from("order_items")
            .select("id")
            .in("order_id", activeOrderIds)
            .neq("status", "cancelled")
          ).data?.map((i: any) => i.id) ?? []
        ),
    ])
    itemsData = itemsResult.data ?? []
    orderItemModifiersData = modifiersResult.data ?? []
  }

  // Fetch modifier groups and modifiers for all menu items in this venue
  const menuItemIds = (menuItemsResult.data ?? []).map((i: any) => i.id)
  let modifierGroupsData: any[] = []
  let modifiersData: any[] = []
  if (menuItemIds.length > 0) {
    const [groupsResult, modsResult] = await Promise.all([
      (supabase as any)
        .from("item_modifier_groups")
        .select("id, item_id, name, min_select, max_select, sort_order")
        .in("item_id", menuItemIds)
        .order("sort_order", { ascending: true }),
      (supabase as any)
        .from("item_modifiers")
        .select("id, group_id, name, price, is_available, sort_order")
        .eq("is_available", true)
        .order("sort_order", { ascending: true }),
    ])
    modifierGroupsData = groupsResult.data ?? []
    modifiersData = modsResult.data ?? []
  }

  // Fetch recently-closed sessions (within 30 min) so waiter can reopen them
  const cutoff30 = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: closedSessionsData } = await (supabase as any)
    .from("table_sessions")
    .select("id, table_id, customer_count, opened_at, closed_at")
    .eq("venue_id", venueId)
    .eq("status", "closed")
    .gte("closed_at", cutoff30)
    .order("closed_at", { ascending: false })

  // Fetch recent payments (last 30 min) for void functionality
  const cutoff = cutoff30
  const sessionIds = (sessionsResult.data ?? []).map((s) => s.id)
  let recentPayments: any[] = []
  if (sessionIds.length > 0) {
    const { data } = await (supabase as any)
      .from("payments")
      .select("id, session_id, amount, payment_method, created_at")
      .in("session_id", sessionIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
    recentPayments = data ?? []
  }

  const tableMap = Object.fromEntries((tablesResult.data ?? []).map((t) => [t.id, t.name]))

  return (
    <WaiterClient
      venueId={venueId}
      permissions={permissions}
      initialCalls={callsResult.data ?? []}
      initialSessions={sessionsResult.data ?? []}
      initialClosedSessions={closedSessionsData ?? []}
      initialOrders={ordersData}
      initialItems={itemsData}
      initialOrderItemModifiers={orderItemModifiersData}
      initialRecentPayments={recentPayments}
      initialTables={tablesResult.data ?? []}
      initialZones={zonesResult.data ?? []}
      tableMap={tableMap}
      menuCategories={categoriesResult.data ?? []}
      menuItems={menuItemsResult.data ?? []}
      modifierGroups={modifierGroupsData}
      modifiers={modifiersData}
    />
  )
}
