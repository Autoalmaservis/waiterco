import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import FloorPlanEditor from "./FloorPlanEditor"
import type { DBTable, VenueZone } from "@/types/database"

export default async function TablesPage({
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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Stoly & QR kódy</h1>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Najprv vytvorte prevádzku.
        </div>
      </div>
    )
  }

  const [tablesResult, zonesResult] = await Promise.all([
    supabase
      .from("tables")
      .select("*")
      .eq("venue_id", selectedVenueId)
      .order("created_at"),
    supabase
      .from("venue_zones")
      .select("*")
      .eq("venue_id", selectedVenueId)
      .order("sort_order"),
  ])

  return (
    <div className="p-6">
      <FloorPlanEditor
        tables={(tablesResult.data ?? []) as DBTable[]}
        zones={(zonesResult.data ?? []) as VenueZone[]}
        venueId={selectedVenueId}
        venues={ctx.venues}
        selectedVenueId={selectedVenueId}
      />
    </div>
  )
}
