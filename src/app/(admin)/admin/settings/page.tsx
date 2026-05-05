import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import SettingsClient from "./SettingsClient"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/admin")

  const { venue: venueParam } = await searchParams

  // Use venue from URL param, fall back to first venue
  const selectedVenueId = ctx.venues.find((v) => v.id === venueParam)?.id ?? ctx.venues[0]?.id

  if (!selectedVenueId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Nastavenia</h1>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Najprv vytvorte prevádzku v sekcii Prevádzky.
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const [venueResult, hoursResult, closuresResult] = await Promise.all([
    supabase.from("venues").select("*").eq("id", selectedVenueId).single(),
    supabase.from("opening_hours").select("*").eq("venue_id", selectedVenueId).order("day_of_week"),
    supabase.from("venue_closures").select("*").eq("venue_id", selectedVenueId).gte("date", new Date().toISOString().slice(0, 10)).order("date"),
  ])

  if (!venueResult.data) redirect("/admin/venues")

  return (
    <div className="p-8">
      <SettingsClient
        venue={venueResult.data}
        venues={ctx.venues}
        selectedVenueId={selectedVenueId}
        openingHours={hoursResult.data ?? []}
        closures={closuresResult.data ?? []}
        userEmail={ctx.user.email}
      />
    </div>
  )
}
