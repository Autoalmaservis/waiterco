import { createClient } from "@/lib/supabase/server"
import RestaurantsClient from "./RestaurantsClient"

export const metadata = {
  title: "Reštaurácie – Waiterco",
  description: "Nájdite reštaurácie a objednajte si online",
}

export type VenueMenuItem = {
  name: string
  description: string | null
}

export type VenueCard = {
  id: string
  name: string
  slug: string
  type: string
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  address: string | null
  city: string | null
  is_open: boolean
  currency: string
  primary_color: string | null
  avg_rating: number | null
  review_count: number
  menu_items: VenueMenuItem[]
}

export default async function RestaurantsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let customerName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()
    customerName = (profile as any)?.full_name ?? null
  }

  const { data: venueData } = await supabase
    .from("venues")
    .select("id, name, slug, type, description, logo_url, cover_image_url, address, city, is_open, currency, primary_color")
    .eq("is_active", true)
    .order("name")

  const venueIds = (venueData ?? []).map((v: any) => v.id)

  // Fetch categories (to map items → venue), reviews, and menu items in parallel
  const [categoryRes, reviewRes] = await Promise.all([
    venueIds.length > 0
      ? supabase.from("menu_categories").select("id, venue_id").in("venue_id", venueIds)
      : Promise.resolve({ data: [] }),
    venueIds.length > 0
      ? supabase.from("reviews").select("venue_id, overall_rating").in("venue_id", venueIds)
      : Promise.resolve({ data: [] }),
  ])

  const categoryData = (categoryRes as any).data ?? []
  const reviewData = (reviewRes as any).data ?? []

  // Build ratings map
  const ratingMap: Record<string, { sum: number; count: number }> = {}
  for (const r of reviewData) {
    const rv = r as any
    if (!ratingMap[rv.venue_id]) ratingMap[rv.venue_id] = { sum: 0, count: 0 }
    ratingMap[rv.venue_id].sum += rv.overall_rating
    ratingMap[rv.venue_id].count += 1
  }

  // Build category → venue map and fetch items
  const catToVenue: Record<string, string> = {}
  const categoryIds: string[] = []
  for (const c of categoryData) {
    catToVenue[(c as any).id] = (c as any).venue_id
    categoryIds.push((c as any).id)
  }

  const itemMap: Record<string, VenueMenuItem[]> = {}
  if (categoryIds.length > 0) {
    const { data: itemData } = await supabase
      .from("menu_items")
      .select("category_id, name, description")
      .in("category_id", categoryIds)
      .eq("is_available", true)
    for (const item of itemData ?? []) {
      const it = item as any
      const venueId = catToVenue[it.category_id]
      if (!venueId) continue
      if (!itemMap[venueId]) itemMap[venueId] = []
      itemMap[venueId].push({ name: it.name, description: it.description ?? null })
    }
  }

  const venues: VenueCard[] = (venueData ?? []).map((v: any) => {
    const r = ratingMap[v.id]
    return {
      id: v.id,
      name: v.name,
      slug: v.slug,
      type: v.type,
      description: v.description ?? null,
      logo_url: v.logo_url ?? null,
      cover_image_url: v.cover_image_url ?? null,
      address: v.address ?? null,
      city: v.city ?? null,
      is_open: v.is_open,
      currency: v.currency,
      primary_color: v.primary_color ?? null,
      avg_rating: r ? r.sum / r.count : null,
      review_count: r?.count ?? 0,
      menu_items: itemMap[v.id] ?? [],
    }
  })

  return <RestaurantsClient venues={venues} isLoggedIn={!!user} customerName={customerName} />
}
