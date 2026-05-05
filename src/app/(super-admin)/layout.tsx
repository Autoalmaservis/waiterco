import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar"

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "super_admin") redirect("/login")

  const admin = createAdminClient()
  const [supportRes, featureRes] = await Promise.all([
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .neq("ticket_type" as any, "feature")
      .eq("status", "open"),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type" as any, "feature")
      .eq("status", "open"),
  ])

  const badges: Record<string, number> = {
    "/super-admin/support": supportRes.count ?? 0,
    "/super-admin/feature-logs": featureRes.count ?? 0,
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdminSidebar
        user={{ email: user.email!, name: profile.full_name, avatar: profile.avatar_url }}
        badges={badges}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
