"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"
import type { OrderStatus } from "@/types/database"

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const venueIds = ctx.venues.map((v) => v.id)

  const { data: order } = await supabase
    .from("orders")
    .select("venue_id")
    .eq("id", id)
    .single()

  if (!order || !venueIds.includes(order.venue_id)) {
    return { error: "ObjednĂˇvka nenĂˇjdenĂˇ" }
  }

  const now = new Date().toISOString()
  const extra: Record<string, string | null> = {}
  if (status === "confirmed") extra.confirmed_at = now
  if (status === "ready") extra.ready_at = now
  if (status === "delivered") extra.delivered_at = now

  const { error } = await supabase
    .from("orders")
    .update({ status, ...extra })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin/orders")
  revalidatePath("/admin")
  return null
}
