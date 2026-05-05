import { createClient } from "@/lib/supabase/server"
import OrganizationsClient from "./OrganizationsClient"

export type OrgRow = {
  id: string
  name: string
  logo_url: string | null
  billing_email: string | null
  ico: string | null
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  phone: string | null
  website: string | null
  owner_id: string
  created_at: string
  subscription: { plan: string; status: string } | null
  venue_count: number
  owner_name: string | null
}

export default async function OrganizationsPage() {
  const supabase = await createClient()

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, logo_url, billing_email, ico, dic, ic_dph, street, city, postal_code, country, phone, website, owner_id, created_at")
    .order("created_at", { ascending: false })

  if (!orgs?.length) {
    return (
      <div className="p-8">
        <OrganizationsClient orgs={[]} />
      </div>
    )
  }

  const orgIds = orgs.map(o => o.id)
  const ownerIds = [...new Set(orgs.map(o => o.owner_id))]

  const [subsResult, venuesResult, profilesResult] = await Promise.all([
    supabase.from("subscriptions").select("organization_id, plan, status").in("organization_id", orgIds),
    supabase.from("venues").select("organization_id").in("organization_id", orgIds),
    supabase.from("profiles").select("id, full_name").in("id", ownerIds),
  ])

  const subsMap = new Map(
    subsResult.data?.map(s => [s.organization_id, { plan: s.plan, status: s.status }]) ?? []
  )
  const venueCounts = new Map<string, number>()
  venuesResult.data?.forEach(v => {
    venueCounts.set(v.organization_id, (venueCounts.get(v.organization_id) ?? 0) + 1)
  })
  const profilesMap = new Map(profilesResult.data?.map(p => [p.id, p.full_name]) ?? [])

  const orgRows: OrgRow[] = orgs.map(org => ({
    ...org,
    subscription: subsMap.get(org.id) ?? null,
    venue_count: venueCounts.get(org.id) ?? 0,
    owner_name: profilesMap.get(org.owner_id) ?? null,
  }))

  return (
    <div className="p-8">
      <OrganizationsClient orgs={orgRows} />
    </div>
  )
}
