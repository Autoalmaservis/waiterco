import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/restaurants")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role === "super_admin") redirect("/super-admin")
  if (profile?.role === "restaurant_admin" || profile?.role === "manager") redirect("/admin")
  if (["waiter", "kitchen", "bar"].includes(profile?.role ?? "")) redirect("/staff")
  if (profile?.role === "customer") redirect("/restaurants")
  redirect("/restaurants")
}
