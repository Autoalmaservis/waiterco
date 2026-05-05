"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import type { OrderStatus } from "@/types/database"

type CartModifier = { modifierId: string; name: string; price: number }
type CartItem = { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string; station?: string; modifiers?: CartModifier[] }

export async function createWaiterOrder(
  tableId: string,
  venueId: string,
  existingSessionId: string | null,
  cartItems: CartItem[],
  orderNotes?: string
): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  let sessionId = existingSessionId
  if (!sessionId) {
    const { data: newSession, error: sErr } = await admin
      .from("table_sessions")
      .insert({ table_id: tableId, venue_id: venueId, status: "active" })
      .select("id")
      .single()
    if (sErr) return { error: sErr.message }
    sessionId = newSession.id
  }

  const [{ data: lastRound }, { data: lastOrder }] = await Promise.all([
    admin.from("orders").select("round_number").eq("session_id", sessionId).order("round_number", { ascending: false }).limit(1),
    admin.from("orders").select("order_number").eq("venue_id", venueId).order("created_at", { ascending: false }).limit(1),
  ])
  const roundNumber = (lastRound?.[0]?.round_number ?? 0) + 1
  const lastNum = parseInt(lastOrder?.[0]?.order_number ?? "0", 10)
  const orderNumber = String(isNaN(lastNum) ? 1 : lastNum + 1).padStart(3, "0")
  const totalAmount = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

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
      notes: orderNotes || null,
    })
    .select("id")
    .single()
  if (oErr) return { error: oErr.message }

  const { data: insertedItems, error: iErr } = await (admin as any).from("order_items").insert(
    cartItems.map(item => ({
      order_id: order.id,
      item_id: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity,
      status: "pending",
      notes: item.notes || null,
      station: item.station ?? "kitchen",
    }))
  ).select("id, item_id")
  if (iErr) return { error: iErr.message }

  // Insert modifiers for items that have them
  const modifierRows: { order_item_id: string; modifier_id: string; name: string; price: number }[] = []
  for (const orderItem of (insertedItems ?? [])) {
    const cartItem = cartItems.find(c => c.menuItemId === orderItem.item_id)
    for (const mod of cartItem?.modifiers ?? []) {
      modifierRows.push({ order_item_id: orderItem.id, modifier_id: mod.modifierId, name: mod.name, price: mod.price })
    }
  }
  if (modifierRows.length > 0) {
    const { error: mErr } = await (admin as any).from("order_item_modifiers").insert(modifierRows)
    if (mErr) return { error: mErr.message }
  }

  revalidatePath("/staff")
  return null
}

async function closeSessionIfComplete(admin: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data: orders } = await admin
    .from("orders")
    .select("id, status")
    .eq("session_id", sessionId)
    .neq("status", "cancelled")
  if (!orders || orders.length === 0) return

  // Auto-deliver orders whose all items are already paid (delivered)
  for (const order of orders.filter((o: any) => o.status !== "delivered")) {
    const { data: items } = await admin
      .from("order_items")
      .select("status")
      .eq("order_id", order.id)
      .neq("status", "cancelled")
    if (items && items.length > 0 && items.every((i: any) => i.status === "delivered")) {
      await admin.from("orders")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", order.id)
      order.status = "delivered"
    }
  }

  // Close session only when every item across all orders is paid (delivered).
  // Checking items (not order status) avoids premature close after split payment
  // when the order was already physically delivered but items aren't fully paid yet.
  const orderIds = orders.map((o: any) => o.id)
  const { data: allItems } = await (admin as any)
    .from("order_items")
    .select("status")
    .in("order_id", orderIds)
    .neq("status", "cancelled")

  if (allItems && allItems.length > 0 && allItems.every((i: any) => i.status === "delivered")) {
    await admin
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", sessionId)
  }
}

export async function payOrder(
  orderId: string,
  sessionId: string,
  venueId: string,
  amount: number,
  method: "cash" | "card",
): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  const { data: payment, error: pErr } = await (admin as any).from("payments").insert({
    session_id: sessionId, venue_id: venueId,
    amount, tip_amount: 0, total_amount: amount,
    payment_method: method, status: "completed",
  }).select("id").single()
  if (pErr) return { error: pErr.message }

  await (admin as any).from("order_items").update({ status: "delivered", payment_id: payment.id }).eq("order_id", orderId)
  await admin.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", orderId)
  await closeSessionIfComplete(admin, sessionId)

  revalidatePath("/staff")
  return null
}

export async function payTableOrders(
  orderIds: string[],
  sessionId: string,
  venueId: string,
  totalAmount: number,
  method: "cash" | "card",
): Promise<{ error: string } | null> {
  const admin = createAdminClient()
  const { data: payment, error: pErr } = await (admin as any).from("payments").insert({
    session_id: sessionId, venue_id: venueId,
    amount: totalAmount, tip_amount: 0, total_amount: totalAmount,
    payment_method: method, status: "completed",
  }).select("id").single()
  if (pErr) return { error: pErr.message }

  for (const orderId of orderIds) {
    await (admin as any).from("order_items").update({ status: "delivered", payment_id: payment.id }).eq("order_id", orderId)
    await admin.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", orderId)
  }
  await closeSessionIfComplete(admin, sessionId)

  revalidatePath("/staff")
  return null
}

export async function paySelectedItems(
  itemIds: string[],
  sessionId: string,
  venueId: string,
  totalAmount: number,
  method: "cash" | "card",
): Promise<{ error: string } | null> {
  const admin = createAdminClient()
  const { data: payment, error: pErr } = await (admin as any).from("payments").insert({
    session_id: sessionId, venue_id: venueId,
    amount: totalAmount, tip_amount: 0, total_amount: totalAmount,
    payment_method: method, status: "completed",
  }).select("id").single()
  if (pErr) return { error: pErr.message }

  await (admin as any).from("order_items").update({ status: "delivered", payment_id: payment.id }).in("id", itemIds)

  const { data: affected } = await admin.from("order_items").select("order_id").in("id", itemIds)
  const orderIds = [...new Set((affected ?? []).map((i: any) => i.order_id))]
  for (const orderId of orderIds) {
    const { data: remaining } = await admin.from("order_items")
      .select("status").eq("order_id", orderId).neq("status", "cancelled")
    if ((remaining ?? []).every((i: any) => i.status === "delivered")) {
      await admin.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", orderId)
    }
  }
  await closeSessionIfComplete(admin, sessionId)

  revalidatePath("/staff")
  return null
}

export async function payItemQuantities(
  selections: { itemId: string; quantity: number }[],
  sessionId: string,
  venueId: string,
  totalAmount: number,
  method: "cash" | "card",
): Promise<{ error: string } | null> {
  const admin = createAdminClient()
  const { data: payment, error: pErr } = await (admin as any).from("payments").insert({
    session_id: sessionId, venue_id: venueId,
    amount: totalAmount, tip_amount: 0, total_amount: totalAmount,
    payment_method: method, status: "completed",
  }).select("id").single()
  if (pErr) return { error: pErr.message }

  const itemIds = selections.map(s => s.itemId)
  const { data: originalItems } = await admin.from("order_items")
    .select("id, order_id, item_id, name, quantity, unit_price, notes")
    .in("id", itemIds)

  const itemMap = Object.fromEntries((originalItems ?? []).map((i: any) => [i.id, i]))
  const affectedOrderIds = new Set<string>()

  for (const { itemId, quantity } of selections) {
    const item = itemMap[itemId]
    if (!item) continue
    affectedOrderIds.add(item.order_id)

    if (quantity >= item.quantity) {
      await (admin as any).from("order_items").update({ status: "delivered", payment_id: payment.id }).eq("id", itemId)
    } else {
      const remaining = item.quantity - quantity
      await admin.from("order_items")
        .update({ quantity: remaining, total_price: item.unit_price * remaining })
        .eq("id", itemId)
      await (admin as any).from("order_items").insert({
        order_id: item.order_id,
        item_id: item.item_id,
        name: item.name,
        quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * quantity,
        status: "delivered" as const,
        notes: item.notes || null,
        payment_id: payment.id,
      })
    }
  }

  for (const orderId of affectedOrderIds) {
    const { data: remaining } = await admin.from("order_items")
      .select("status").eq("order_id", orderId).neq("status", "cancelled")
    if ((remaining ?? []).every((i: any) => i.status === "delivered")) {
      await admin.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", orderId)
    }
  }
  await closeSessionIfComplete(admin, sessionId)

  revalidatePath("/staff")
  return null
}

export async function updateWaiterOrder(
  orderId: string,
  cartItems: CartItem[],
): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  const { error: dErr } = await admin.from("order_items").delete().eq("order_id", orderId)
  if (dErr) return { error: dErr.message }

  const { data: insertedItems, error: iErr } = await (admin as any).from("order_items").insert(
    cartItems.map(item => ({
      order_id: orderId,
      item_id: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity,
      status: "pending",
      notes: item.notes || null,
      station: item.station ?? "kitchen",
    }))
  ).select("id, item_id")
  if (iErr) return { error: iErr.message }

  const modifierRows: { order_item_id: string; modifier_id: string; name: string; price: number }[] = []
  for (const orderItem of (insertedItems ?? [])) {
    const cartItem = cartItems.find(c => c.menuItemId === orderItem.item_id)
    for (const mod of cartItem?.modifiers ?? []) {
      modifierRows.push({ order_item_id: orderItem.id, modifier_id: mod.modifierId, name: mod.name, price: mod.price })
    }
  }
  if (modifierRows.length > 0) {
    const { error: mErr } = await (admin as any).from("order_item_modifiers").insert(modifierRows)
    if (mErr) return { error: mErr.message }
  }

  const totalAmount = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const { error: oErr } = await admin.from("orders").update({ total_amount: totalAmount }).eq("id", orderId)
  if (oErr) return { error: oErr.message }

  revalidatePath("/staff")
  return null
}

export async function markKitchenItemReady(itemId: string, orderId: string): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  const { error } = await admin.from("order_items").update({ status: "ready" }).eq("id", itemId)
  if (error) return { error: error.message }

  // If all preparable items (kitchen + bar, not waiter) are ready/delivered → advance order to ready
  const { data: preparable } = await (admin as any)
    .from("order_items")
    .select("status, station")
    .eq("order_id", orderId)
    .neq("station", "waiter")
    .neq("status", "cancelled")

  if (preparable && preparable.length > 0 && preparable.every((i: any) => i.status === "ready" || i.status === "delivered")) {
    await admin.from("orders")
      .update({ status: "ready", ready_at: new Date().toISOString() })
      .eq("id", orderId)
  }

  revalidatePath("/staff")
  return null
}

export async function markAllKitchenItemsReady(orderId: string, station: string): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  await (admin as any).from("order_items")
    .update({ status: "ready" })
    .eq("order_id", orderId)
    .eq("station", station)
    .neq("status", "cancelled")
    .neq("status", "delivered")

  const { data: preparable } = await (admin as any)
    .from("order_items")
    .select("status, station")
    .eq("order_id", orderId)
    .neq("station", "waiter")
    .neq("status", "cancelled")

  if (preparable && preparable.length > 0 && preparable.every((i: any) => i.status === "ready" || i.status === "delivered")) {
    await admin.from("orders")
      .update({ status: "ready", ready_at: new Date().toISOString() })
      .eq("id", orderId)
  }

  revalidatePath("/staff")
  return null
}

export async function revertOrderStatus(orderId: string, currentStatus: OrderStatus): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  const prev: Partial<Record<OrderStatus, OrderStatus>> = {
    ready: "preparing",
    preparing: "confirmed",
  }
  const target = prev[currentStatus]
  if (!target) return { error: "Nie je možné vrátiť späť" }

  // Reset item statuses to pending (skip already paid/delivered items)
  await (admin as any).from("order_items")
    .update({ status: "pending" })
    .eq("order_id", orderId)
    .neq("status", "cancelled")
    .neq("status", "delivered")

  await admin.from("orders").update({ status: target }).eq("id", orderId)

  revalidatePath("/staff")
  return null
}

export async function markWaiterItemReady(itemId: string): Promise<{ error: string } | null> {
  const admin = createAdminClient()
  const { error } = await admin.from("order_items").update({ status: "ready" }).eq("id", itemId)
  if (error) return { error: error.message }
  revalidatePath("/staff")
  return null
}

export async function markItemDelivered(itemId: string): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("order_items")
    .update({ status: "delivered" })
    .eq("id", itemId)
  if (error) return { error: error.message }
  return null
}

export async function acknowledgeWaiterCall(id: string): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("waiter_calls")
    .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }
  return null
}

export async function resolveWaiterCall(id: string): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("waiter_calls")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }
  return null
}

export async function voidLastPayment(
  sessionId: string,
  venueId: string,
): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  // Find the last payment for this session within 30 minutes
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: payment } = await (admin as any)
    .from("payments")
    .select("id, created_at")
    .eq("session_id", sessionId)
    .eq("venue_id", venueId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!payment) return { error: "Žiadna platba na stornovanie (staršia ako 30 minút)" }

  // Find all order_items paid by this payment
  const { data: paidItems } = await (admin as any)
    .from("order_items")
    .select("id, order_id")
    .eq("payment_id", payment.id)

  if (paidItems && paidItems.length > 0) {
    // Revert items back to ready (they were prepared, just not paid)
    await (admin as any).from("order_items")
      .update({ status: "ready", payment_id: null })
      .eq("payment_id", payment.id)

    // Revert affected orders back to ready if they were set to delivered
    const orderIds = [...new Set((paidItems as any[]).map(i => i.order_id))]
    for (const orderId of orderIds) {
      await admin.from("orders")
        .update({ status: "ready", delivered_at: null })
        .eq("id", orderId)
        .eq("status", "delivered")
    }
  }

  // Reopen session if it was closed by this payment
  await admin.from("table_sessions")
    .update({ status: "active", closed_at: null })
    .eq("id", sessionId)
    .eq("status", "closed")

  // Delete the payment
  await (admin as any).from("payments").delete().eq("id", payment.id)

  revalidatePath("/staff")
  return null
}

export async function reopenSession(
  sessionId: string,
  venueId: string,
): Promise<{ error: string } | null> {
  const admin = createAdminClient()

  // Revert all non-cancelled orders and their items back to payable state
  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("session_id", sessionId)
    .neq("status", "cancelled")

  if (orders && orders.length > 0) {
    const orderIds = orders.map((o: any) => o.id)
    await (admin as any)
      .from("order_items")
      .update({ status: "ready", payment_id: null })
      .in("order_id", orderIds)
      .neq("status", "cancelled")
    await admin
      .from("orders")
      .update({ status: "ready", delivered_at: null })
      .in("id", orderIds)
  }

  const { error } = await (admin as any)
    .from("table_sessions")
    .update({ status: "active", closed_at: null })
    .eq("id", sessionId)
    .eq("venue_id", venueId)
  if (error) return { error: error.message }

  revalidatePath("/staff")
  return null
}

export async function fetchOrderHistory(venueId: string): Promise<{
  sessions: any[]
  orders: any[]
  items: any[]
  tableMap: Record<string, string>
}> {
  const supabase = await createClient()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [sessionsResult, tablesResult] = await Promise.all([
    (supabase as any)
      .from("table_sessions")
      .select("id, table_id, customer_count, opened_at, closed_at")
      .eq("venue_id", venueId)
      .eq("status", "closed")
      .gte("closed_at", cutoff)
      .order("closed_at", { ascending: false })
      .limit(200),
    supabase.from("tables").select("id, name").eq("venue_id", venueId),
  ])

  const sessions = sessionsResult.data ?? []
  const tableMap = Object.fromEntries((tablesResult.data ?? []).map((t: any) => [t.id, t.name]))

  const sessionIds = sessions.map((s: any) => s.id)
  if (sessionIds.length === 0) return { sessions, orders: [], items: [], tableMap }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, session_id, order_number, status, total_amount, created_at")
    .in("session_id", sessionIds)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true })

  const orderIds = (orders ?? []).map((o: any) => o.id)
  let items: any[] = []
  if (orderIds.length > 0) {
    const { data } = await (supabase as any)
      .from("order_items")
      .select("id, order_id, name, quantity, total_price, status")
      .in("order_id", orderIds)
      .neq("status", "cancelled")
    items = data ?? []
  }

  return { sessions, orders: orders ?? [], items, tableMap }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ error: string } | null> {
  const supabase = await createClient()

  const timestamps: Record<string, string> = {}
  if (status === "confirmed") timestamps.confirmed_at = new Date().toISOString()
  if (status === "ready") timestamps.ready_at = new Date().toISOString()
  if (status === "delivered") timestamps.delivered_at = new Date().toISOString()

  const { error } = await supabase
    .from("orders")
    .update({ status, ...timestamps })
    .eq("id", orderId)

  if (error) return { error: error.message }
  return null
}
