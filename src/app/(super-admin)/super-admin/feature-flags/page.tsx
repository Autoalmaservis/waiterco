import { createAdminClient, createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import FeatureFlagsClient from "./FeatureFlagsClient"

export type FlagRow = {
  id: string
  key: string
  description: string | null
  is_enabled: boolean
  updated_at: string
}

export default async function FeatureFlagsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") redirect("/login")

  const admin = createAdminClient()

  const { data } = await (admin as any)
    .from("feature_flags")
    .select("id, key, description, is_enabled, updated_at")
    .is("venue_id", null)
    .order("updated_at", { ascending: false })

  const flags: FlagRow[] = (data ?? []).map((f: any) => ({
    ...f,
    description: f.description ?? null,
  }))

  return (
    <div className="p-8">
      <FeatureFlagsClient flags={flags} />
    </div>
  )
}
