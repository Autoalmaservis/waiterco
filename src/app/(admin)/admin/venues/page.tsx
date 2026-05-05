import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import VenuesClient from "./VenuesClient"

export default async function VenuesPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const supabase = await createClient()

  const { data: venues } = await supabase
    .from("venues")
    .select("*")
    .eq("organization_id", ctx.org.id)
    .order("created_at")

  return (
    <div className="p-8">
      <VenuesClient venues={venues ?? []} />
    </div>
  )
}
