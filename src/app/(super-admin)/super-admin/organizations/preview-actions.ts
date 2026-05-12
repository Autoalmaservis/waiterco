"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const PREVIEW_COOKIE = "waiterco_preview_org"

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Nie ste prihlásený")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") throw new Error("Nedostatočné oprávnenia")
}

export async function enterOrgPreview(orgId: string) {
  await verifySuperAdmin()
  const cookieStore = await cookies()
  cookieStore.set(PREVIEW_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hodín
  })
  redirect("/admin")
}

export async function exitOrgPreview() {
  const cookieStore = await cookies()
  cookieStore.delete(PREVIEW_COOKIE)
  redirect("/super-admin/organizations")
}
