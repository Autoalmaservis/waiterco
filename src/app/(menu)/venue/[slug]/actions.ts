"use server"

import { createAdminClient } from "@/lib/supabase/server"

type OrderModifier = { modifierId: string; name: string; price: number }
type OrderItem = {
  menuItemId: string; name: string; quantity: number; unitPrice: number
  station: string; modifiers: OrderModifier[]
}
export type DeliveryInfo = {
  type: "delivery" | "takeaway"
  customerName: string
  phone: string
  address?: string
  notes?: string
}

async function getOrCreateVirtualTable(venueId: string, type: "delivery" | "takeaway"): Promise<string | null> {
  const admin = createAdminClient()
  const token = `${type}-${venueId}`

  const { data: existing } = await admin
    .from("tables")
    .select("id")
    .eq("qr_token", token)
    .single()

  if (existing) return existing.id

  const label = type === "delivery" ? "Donáška" : "Takeaway"
  const { data: newTable, error } = await (admin as any)
    .from("tables")
    .insert({
      venue_id: venueId,
      name: label,
      qr_token: token,
      is_active: true,
      x_pos: 0,
      y_pos: 0,
      shape: "circle",
    })
    .select("id")
    .single()

  return error ? null : newTable?.id ?? null
}

export async function placeDeliveryOrder(
  venueId: string,
  deliveryInfo: DeliveryInfo,
  items: OrderItem[]
): Promise<{ error: string | null; orderId: string | null }> {
  if (items.length === 0) return { error: "Košík je prázdny.", orderId: null }

  const admin = createAdminClient()
  const tableId = await getOrCreateVirtualTable(venueId, deliveryInfo.type)
  if (!tableId) return { error: "Interná chyba. Skúste znova.", orderId: null }

  const { data: newSession, error: sErr } = await admin
    .from("table_sessions")
    .insert({ table_id: tableId, venue_id: venueId, status: "active" })
    .select("id")
    .single()
  if (sErr || !newSession) return { error: "Nepodarilo sa otvoriť reláciu.", orderId: null }

  const sessionId = newSession.id

  const { data: lastOrderData } = await admin
    .from("orders")
    .select("order_number")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(1)

  const lastNum = parseInt(lastOrderData?.[0]?.order_number ?? "0", 10)
  const orderNumber = String(isNaN(lastNum) ? 1 : lastNum + 1).padStart(3, "0")
  const totalAmount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const { data: order, error: oErr } = await (admin as any)
    .from("orders")
    .insert({
      session_id: sessionId,
      table_id: tableId,
      venue_id: venueId,
      order_number: orderNumber,
      round_number: 1,
      status: "pending",
      total_amount: totalAmount,
      notes: deliveryInfo.notes || null,
      order_type: deliveryInfo.type,
      customer_name: deliveryInfo.customerName,
      customer_phone: deliveryInfo.phone,
      delivery_address: deliveryInfo.address || null,
    })
    .select("id")
    .single()
  if (oErr || !order) return { error: "Objednávku sa nepodarilo odoslať.", orderId: null }

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
  if (iErr) return { error: "Položky sa nepodarilo uložiť.", orderId: null }

  const modifierRows: { order_item_id: string; modifier_id: string; name: string; price: number }[] = []
  for (let i = 0; i < (insertedItems ?? []).length; i++) {
    for (const mod of items[i].modifiers) {
      modifierRows.push({ order_item_id: insertedItems[i].id, modifier_id: mod.modifierId, name: mod.name, price: mod.price })
    }
  }
  if (modifierRows.length > 0) {
    await (admin as any).from("order_item_modifiers").insert(modifierRows)
  }

  return { error: null, orderId: order.id }
}
