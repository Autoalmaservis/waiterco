"use server"

import { createAdminClient } from "@/lib/supabase/server"

type OrderModifier = { modifierId: string; name: string; price: number }
type OrderItem = {
  menuItemId: string
  name: string
  quantity: number
  unitPrice: number
  station: string
  modifiers: OrderModifier[]
}

export type TrackingItem = {
  id: string
  name: string
  quantity: number
  unit_price: number
  status: string
  modifiers: { name: string }[]
}
export type TrackingOrder = {
  id: string
  order_number: string
  round_number: number
  status: string
  total_amount: number
  notes: string | null
  created_at: string
  items: TrackingItem[]
}

export async function placeCustomerOrder(
  tableId: string,
  venueId: string,
  items: OrderItem[],
  notes: string
): Promise<{ error: string | null; sessionId: string | null; shareToken: string | null }> {
  if (items.length === 0) return { error: "Košík je prázdny.", sessionId: null, shareToken: null }

  const admin = createAdminClient()

  const { data: venue } = await admin.from("venues").select("is_open").eq("id", venueId).single()
  if (!venue?.is_open) return { error: "Prevádzka je momentálne zatvorená.", sessionId: null, shareToken: null }

  const { data: existingSession } = await admin
    .from("table_sessions")
    .select("id, share_token")
    .eq("table_id", tableId)
    .eq("status", "active")
    .limit(1)
    .single()

  let sessionId = existingSession?.id
  let shareToken: string | null = existingSession?.share_token ?? null

  if (!sessionId) {
    const { data: newSession, error: sErr } = await admin
      .from("table_sessions")
      .insert({ table_id: tableId, venue_id: venueId, status: "active" })
      .select("id, share_token")
      .single()
    if (sErr || !newSession) return { error: "Nepodarilo sa otvoriť reláciu.", sessionId: null, shareToken: null }
    sessionId = newSession.id
    shareToken = newSession.share_token
  }

  const [{ data: lastRound }, { data: lastOrderData }] = await Promise.all([
    admin.from("orders").select("round_number").eq("session_id", sessionId).order("round_number", { ascending: false }).limit(1),
    admin.from("orders").select("order_number").eq("venue_id", venueId).order("created_at", { ascending: false }).limit(1),
  ])
  const roundNumber = (lastRound?.[0]?.round_number ?? 0) + 1
  const lastNum = parseInt(lastOrderData?.[0]?.order_number ?? "0", 10)
  const orderNumber = String(isNaN(lastNum) ? 1 : lastNum + 1).padStart(3, "0")
  const totalAmount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      session_id: sessionId,
      table_id: tableId,
      venue_id: venueId,
      order_number: orderNumber,
      round_number: roundNumber,
      status: "pending",
      total_amount: totalAmount,
      notes: notes || null,
    })
    .select("id")
    .single()
  if (oErr || !order) return { error: "Objednávku sa nepodarilo odoslať.", sessionId: null, shareToken: null }

  const { data: insertedItems, error: iErr } = await (admin as any)
    .from("order_items")
    .insert(
      items.map(item => ({
        order_id: order.id,
        item_id: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.unitPrice * item.quantity,
        status: "pending",
        station: item.station,
        payment_id: null,
      }))
    )
    .select("id")
  if (iErr) return { error: "Položky sa nepodarilo uložiť.", sessionId: null, shareToken: null }

  const modifierRows: { order_item_id: string; modifier_id: string; name: string; price: number }[] = []
  for (let i = 0; i < (insertedItems ?? []).length; i++) {
    const orderItemId = insertedItems[i].id
    for (const mod of items[i].modifiers) {
      modifierRows.push({ order_item_id: orderItemId, modifier_id: mod.modifierId, name: mod.name, price: mod.price })
    }
  }
  if (modifierRows.length > 0) {
    const { error: mErr } = await (admin as any).from("order_item_modifiers").insert(modifierRows)
    if (mErr) return { error: "Modifikátory sa nepodarilo uložiť.", sessionId: null, shareToken: null }
  }

  return { error: null, sessionId, shareToken }
}

export async function getSessionOrders(sessionId: string): Promise<{
  orders: TrackingOrder[]
  sessionStatus: string
  shareToken: string | null
  grandTotal: number
}> {
  const admin = createAdminClient()

  const [sessionResult, ordersResult] = await Promise.all([
    admin.from("table_sessions").select("status, share_token").eq("id", sessionId).single(),
    admin.from("orders")
      .select("id, order_number, round_number, status, total_amount, notes, created_at")
      .eq("session_id", sessionId)
      .order("round_number"),
  ])

  const sessionStatus = sessionResult.data?.status ?? "active"
  const shareToken = sessionResult.data?.share_token ?? null
  const orders = ordersResult.data ?? []

  if (orders.length === 0) return { orders: [], sessionStatus, shareToken, grandTotal: 0 }

  const orderIds = orders.map(o => o.id)
  const { data: allItems } = await (admin as any)
    .from("order_items")
    .select("id, order_id, name, quantity, unit_price, status")
    .in("order_id", orderIds)

  const itemIds = (allItems ?? []).map((i: any) => i.id)
  let allMods: any[] = []
  if (itemIds.length > 0) {
    const { data: modsData } = await (admin as any)
      .from("order_item_modifiers")
      .select("order_item_id, name")
      .in("order_item_id", itemIds)
    allMods = modsData ?? []
  }

  const result: TrackingOrder[] = orders.map(o => ({
    ...o,
    items: (allItems ?? [])
      .filter((i: any) => i.order_id === o.id)
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        status: i.status,
        modifiers: allMods
          .filter((m: any) => m.order_item_id === i.id)
          .map((m: any) => ({ name: m.name })),
      })),
  }))

  const grandTotal = result.reduce((s, o) => s + o.total_amount, 0)
  return { orders: result, sessionStatus, shareToken, grandTotal }
}

export async function requestBill(
  tableId: string,
  venueId: string,
  sessionId: string | null,
  note?: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await (admin as any).from("waiter_calls").insert({
    table_id: tableId,
    venue_id: venueId,
    session_id: sessionId,
    status: "pending",
    reason: "bill",
    custom_message: note ?? null,
  })
  return { error: error?.message ?? null }
}

export async function callWaiter(
  tableId: string,
  venueId: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { data: session } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active")
    .limit(1)
    .single()
  const { error } = await (admin as any).from("waiter_calls").insert({
    table_id: tableId,
    venue_id: venueId,
    session_id: session?.id ?? null,
    status: "pending",
    reason: "other",
  })
  return { error: error?.message ?? null }
}

export async function sendWaiterMessage(
  tableId: string,
  venueId: string,
  message: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { data: session } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active")
    .limit(1)
    .single()
  const { error } = await (admin as any).from("waiter_calls").insert({
    table_id: tableId,
    venue_id: venueId,
    session_id: session?.id ?? null,
    status: "pending",
    reason: "other",
    custom_message: message.trim().slice(0, 300),
  })
  return { error: error?.message ?? null }
}

export type ReviewItem = {
  id: string
  overall_rating: number
  food_rating: number | null
  service_rating: number | null
  comment: string | null
  created_at: string
}

export async function getVenueReviews(venueId: string): Promise<ReviewItem[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("reviews")
    .select("id, overall_rating, food_rating, service_rating, comment, created_at")
    .eq("venue_id", venueId)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .limit(50)
  return (data ?? []) as ReviewItem[]
}

export async function submitReview(
  venueId: string,
  sessionId: string | null,
  overall: number,
  food: number | null,
  service: number | null,
  comment: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await admin.from("reviews").insert({
    venue_id: venueId,
    session_id: sessionId,
    overall_rating: overall,
    food_rating: food,
    service_rating: service,
    comment: comment || null,
    is_visible: true,
  })
  return { error: error?.message ?? null }
}
