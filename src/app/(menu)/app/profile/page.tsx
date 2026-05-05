import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import ProfileClient from "./ProfileClient"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/app/sign-in?next=/app/profile")

  const admin = createAdminClient()

  // Fetch profile
  const { data: profile } = await (admin as any)
    .from("profiles")
    .select("full_name, role, created_at")
    .eq("id", user.id)
    .single()

  // Ensure customer profile exists
  if (!profile) {
    await (admin as any).from("profiles").insert({
      id: user.id,
      role: "customer",
      language: "sk",
      is_active: true,
    })
  }

  // Redirect non-customers to their app
  if (profile && profile.role !== "customer") redirect("/")

  // Fetch recent orders for this customer
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, status, total_amount, created_at, venue_id")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  // Fetch venue names for orders
  let venueMap: Record<string, string> = {}
  if (orders && orders.length > 0) {
    const venueIds = [...new Set(orders.map(o => o.venue_id))]
    const { data: venues } = await admin
      .from("venues")
      .select("id, name")
      .in("id", venueIds)
    for (const v of venues ?? []) venueMap[v.id] = v.name
  }

  return (
    <ProfileClient
      user={{ id: user.id, email: user.email ?? "", fullName: profile?.full_name ?? null }}
      orders={(orders ?? []).map(o => ({ ...o, venueName: venueMap[o.venue_id] ?? "" }))}
    />
  )
}
