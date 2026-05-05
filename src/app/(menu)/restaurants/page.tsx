import { createClient } from "@/lib/supabase/server"
import RestaurantsClient from "./RestaurantsClient"

export const metadata = {
  title: "Reštaurácie – eWaiter",
  description: "Nájdite reštaurácie a objednajte si online",
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
}

export default async function RestaurantsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get customer name if logged in
  let customerName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()
    customerName = (profile as any)?.full_name ?? null
  }

  const { data } = await supabase
    .from("venues")
    .select("id, name, slug, type, description, logo_url, cover_image_url, address, city, is_open, currency, primary_color")
    .eq("is_active", true)
    .order("name")

  const venues: VenueCard[] = (data ?? []).map((v: any) => ({
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
  }))

  return <RestaurantsClient venues={venues} isLoggedIn={!!user} customerName={customerName} />
}
