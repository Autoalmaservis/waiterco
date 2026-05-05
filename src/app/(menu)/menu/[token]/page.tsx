import { notFound } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import MenuPageClient from "./MenuPageClient"
import { getSessionOrders, type TrackingOrder } from "./actions"

type Props = { params: Promise<{ token: string }> }

export default async function MenuPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: table } = await supabase
    .from("tables")
    .select("id, name, venue_id, is_active")
    .eq("qr_token", token)
    .single()

  if (!table || !table.is_active) notFound()

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, slug, logo_url, cover_image_url, address, city, description, is_active, is_open, closed_reason, currency, primary_color")
    .eq("id", table.venue_id)
    .single()

  if (!venue || !venue.is_active) notFound()

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, description, sort_order")
      .eq("venue_id", venue.id)
      .eq("is_active", true)
      .order("sort_order"),
    (supabase as any)
      .from("menu_items")
      .select("id, category_id, name, description, image_url, base_price, is_available, allergens, tags, station")
      .eq("venue_id", venue.id)
      .eq("is_active", true)
      .order("sort_order"),
  ])

  const items = itemsResult.data ?? []
  const itemIds = items.map((i: any) => i.id)

  let modifierGroups: any[] = []
  let modifiers: any[] = []

  if (itemIds.length > 0) {
    const { data: groupsData } = await (supabase as any)
      .from("item_modifier_groups")
      .select("id, item_id, name, min_select, max_select, sort_order")
      .in("item_id", itemIds)
      .order("sort_order")

    modifierGroups = groupsData ?? []
    const groupIds = modifierGroups.map((g: any) => g.id)

    if (groupIds.length > 0) {
      const { data: modData } = await (supabase as any)
        .from("item_modifiers")
        .select("id, group_id, name, price, is_available, sort_order")
        .in("group_id", groupIds)
        .eq("is_available", true)
        .order("sort_order")
      modifiers = modData ?? []
    }
  }

  // Check for active session (for order tracking pre-load)
  const admin = createAdminClient()
  const { data: activeSession } = await admin
    .from("table_sessions")
    .select("id, share_token")
    .eq("table_id", table.id)
    .eq("status", "active")
    .limit(1)
    .single()

  let initialOrders: TrackingOrder[] = []
  let initialSessionStatus = "active"
  let initialShareToken: string | null = null

  if (activeSession?.id) {
    const result = await getSessionOrders(activeSession.id)
    initialOrders = result.orders
    initialSessionStatus = result.sessionStatus
    initialShareToken = result.shareToken
  }

  return (
    <MenuPageClient
      table={{ id: table.id, name: table.name }}
      venue={{
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        logo_url: venue.logo_url,
        cover_image_url: venue.cover_image_url ?? null,
        address: venue.address ?? null,
        city: venue.city ?? null,
        description: venue.description ?? null,
        is_open: venue.is_open,
        closed_reason: venue.closed_reason ?? null,
        currency: venue.currency,
        primary_color: venue.primary_color ?? null,
      }}
      categories={categoriesResult.data ?? []}
      items={items}
      modifierGroups={modifierGroups}
      modifiers={modifiers}
      initialSessionId={activeSession?.id ?? null}
      initialShareToken={initialShareToken}
      initialOrders={initialOrders}
      initialSessionStatus={initialSessionStatus}
    />
  )
}
