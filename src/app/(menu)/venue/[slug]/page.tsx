import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import VenuePageClient from "./VenuePageClient"

type Props = { params: Promise<{ slug: string }> }

export default async function VenuePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, slug, type, description, logo_url, cover_image_url, address, city, country, phone, website, currency, primary_color, is_active, is_open, closed_reason")
    .eq("slug", slug)
    .single()

  if (!venue || !venue.is_active) notFound()

  const [categoriesResult, itemsResult, reviewsResult] = await Promise.all([
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
    supabase
      .from("reviews")
      .select("overall_rating, food_rating, service_rating")
      .eq("venue_id", venue.id)
      .eq("is_visible", true)
      .limit(100),
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

  const reviews = reviewsResult.data ?? []
  const avgRating = reviews.length > 0
    ? reviews.reduce((s: number, r: any) => s + r.overall_rating, 0) / reviews.length
    : null

  return (
    <VenuePageClient
      venue={{
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        type: venue.type,
        description: venue.description ?? null,
        logo_url: venue.logo_url ?? null,
        cover_image_url: venue.cover_image_url ?? null,
        address: venue.address ?? null,
        city: venue.city ?? null,
        country: venue.country,
        phone: venue.phone ?? null,
        website: venue.website ?? null,
        currency: venue.currency,
        primary_color: venue.primary_color ?? null,
        is_open: venue.is_open,
        closed_reason: venue.closed_reason ?? null,
      }}
      categories={categoriesResult.data ?? []}
      items={items}
      modifierGroups={modifierGroups}
      modifiers={modifiers}
      avgRating={avgRating}
      reviewCount={reviews.length}
    />
  )
}
