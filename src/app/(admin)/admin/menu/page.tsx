import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import MenuClient from "./MenuClient"

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const { venue } = await searchParams

  const supabase = await createClient()

  const venueIds = ctx.venues.map((v) => v.id)
  const selectedVenueId = venue && venueIds.includes(venue) ? venue : venueIds[0]

  if (!selectedVenueId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Menu</h1>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Najprv vytvorte prevádzku.
        </div>
      </div>
    )
  }

  const { data: categories } = await supabase
    .from("menu_categories")
    .select("*")
    .in("venue_id", venueIds)
    .order("sort_order")

  const categoryIds = (categories ?? []).map((c) => c.id)
  const { data: itemCounts } = categoryIds.length
    ? await supabase
        .from("menu_items")
        .select("category_id")
        .in("category_id", categoryIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const item of itemCounts ?? []) {
    countMap[item.category_id] = (countMap[item.category_id] ?? 0) + 1
  }

  const categoriesWithCount = (categories ?? []).map((c) => ({
    ...c,
    item_count: countMap[c.id] ?? 0,
  }))

  return (
    <div className="p-8">
      <MenuClient
        venues={ctx.venues}
        categories={categoriesWithCount}
        selectedVenueId={selectedVenueId}
      />
    </div>
  )
}
