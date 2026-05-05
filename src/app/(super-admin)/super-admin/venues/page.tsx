import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Building2, Search } from "lucide-react"
import VenuesAdminClient from "./VenuesAdminClient"

export type VenueAdminRow = {
  id: string
  name: string
  slug: string
  type: string
  city: string | null
  country: string
  is_active: boolean
  is_open: boolean
  organization_id: string
  org_name: string
  created_at: string
}

export default async function SuperAdminVenuesPage() {
  const supabase = await createClient()

  const [venuesResult, orgsResult] = await Promise.all([
    supabase.from("venues")
      .select("id, name, slug, type, city, country, is_active, is_open, organization_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name").order("name"),
  ])

  const orgs = orgsResult.data ?? []
  const orgsMap = new Map(orgs.map(o => [o.id, o.name]))

  const venues: VenueAdminRow[] = (venuesResult.data ?? []).map(v => ({
    ...v,
    org_name: orgsMap.get(v.organization_id) ?? '–',
  }))

  return (
    <div className="p-8">
      <VenuesAdminClient venues={venues} orgs={orgs} />
    </div>
  )
}
