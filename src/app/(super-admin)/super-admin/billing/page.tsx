import { createClient } from "@/lib/supabase/server"
import BillingClient, { type SubRow, type OrgOption } from "./BillingClient"

export default async function BillingPage() {
  const supabase = await createClient()

  const [subsResult, orgsResult] = await Promise.all([
    supabase.from("subscriptions")
      .select("id, organization_id, plan, status, started_at, expires_at, monthly_price, stripe_subscription_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name").order("name"),
  ])

  const orgs: OrgOption[] = orgsResult.data ?? []
  const orgsMap = new Map(orgs.map(o => [o.id, o.name]))

  const subs: SubRow[] = (subsResult.data ?? []).map(s => ({
    ...s,
    org_name: orgsMap.get(s.organization_id) ?? s.organization_id.slice(0, 8),
  }))

  return (
    <div className="p-8">
      <BillingClient subs={subs} orgs={orgs} />
    </div>
  )
}
