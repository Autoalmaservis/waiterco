"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"
import type { StaffRole } from "@/types/database"

async function ctx() {
  const c = await getAdminContext()
  if (!c) throw new Error("Nie ste prihlásený")
  return c
}

export async function addStaff(formData: FormData): Promise<{ error: string } | null> {
  try {
    const c = await ctx()

    const venue_id  = formData.get("venue_id")  as string
    const email     = formData.get("email")      as string
    const full_name = formData.get("full_name")  as string
    const password  = formData.get("password")   as string
    const role      = formData.get("role")       as StaffRole

    if (!venue_id || !email || !full_name || !password || !role)
      return { error: "Chýbajú povinné polia" }
    if (password.length < 8)
      return { error: "Heslo musí mať aspoň 8 znakov" }
    if (!c.venues.find(v => v.id === venue_id))
      return { error: "Prevádzka nenájdená" }

    const supabase = createAdminClient()

    // Find or create the auth user
    const { data: usersData } = await supabase.auth.admin.listUsers()
    let authUser = usersData?.users.find(u => u.email === email)

    if (!authUser) {
      const profileRoleMap: Record<string, string> = { manager: "manager", waiter: "waiter", cook: "kitchen", barman: "bar" }
    const profileRole = profileRoleMap[role] ?? "waiter"
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      })
      if (error) return { error: error.message }
      authUser = data.user

      const { error: profileErr } = await (supabase as any).from("profiles").upsert({
        id: authUser.id,
        role: profileRole,
        full_name,
        language: "sk",
        is_active: true,
      })
      if (profileErr) return { error: `Profil: ${profileErr.message}` }
    }

    // Check if already assigned to this venue
    const { data: existing } = await supabase
      .from("venue_staff")
      .select("id")
      .eq("venue_id", venue_id)
      .eq("user_id", authUser.id)
      .single()

    if (existing) return { error: "Tento používateľ je už priradený k tejto prevádzke" }

    const position_id = (formData.get("position_id") as string) || null

    const { error: insertError } = await supabase.from("venue_staff").insert({
      venue_id,
      user_id: authUser.id,
      role,
      is_active: true,
      position_id,
    } as any)

    if (insertError) return { error: insertError.message }

    revalidatePath("/admin/staff")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function setStaffPassword(
  userId: string, password: string
): Promise<{ error: string } | null> {
  try {
    await ctx()
    if (password.length < 8) return { error: "Heslo musí mať aspoň 8 znakov" }
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, { password })
    if (error) return { error: error.message }
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeStaff(id: string): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const { error } = await supabase.from("venue_staff").delete().eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/staff")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function toggleStaffActive(
  id: string, is_active: boolean
): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const { error } = await supabase.from("venue_staff").update({ is_active }).eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/staff")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}
