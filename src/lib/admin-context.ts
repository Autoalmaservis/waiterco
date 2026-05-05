import { cookies } from "next/headers"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import type { VenueType } from "@/types/database"

const PREVIEW_COOKIE = "ewaiter_preview_org"

export type AdminContext = {
  user: { id: string; email: string }
  profile: { role: string; full_name: string | null; avatar_url: string | null }
  org: { id: string; name: string }
  venues: { id: string; name: string; type: VenueType; is_active: boolean }[]
  isPreview: boolean
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  // Super admin preview mode
  if (profile.role === "super_admin") {
    const cookieStore = await cookies()
    const previewOrgId = cookieStore.get(PREVIEW_COOKIE)?.value
    if (!previewOrgId) return null

    const admin = createAdminClient()
    const { data: org } = await admin.from("organizations").select("id, name").eq("id", previewOrgId).single()
    if (!org) return null

    const { data: venues } = await admin
      .from("venues")
      .select("id, name, type, is_active")
      .eq("organization_id", org.id)
      .order("created_at")

    return {
      user: { id: user.id, email: user.email! },
      profile,
      org,
      venues: venues ?? [],
      isPreview: true,
    }
  }

  // Regular restaurant_admin / manager
  if (profile.role !== "restaurant_admin" && profile.role !== "manager") return null

  // Try owner first
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("owner_id", user.id)
    .single()

  if (org) {
    const { data: venues } = await supabase
      .from("venues")
      .select("id, name, type, is_active")
      .eq("organization_id", org.id)
      .order("created_at")
    return {
      user: { id: user.id, email: user.email! },
      profile,
      org,
      venues: venues ?? [],
      isPreview: false,
    }
  }

  // Try via venue_staff
  const { data: staffEntries } = await supabase
    .from("venue_staff")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (!staffEntries?.length) return null

  const venueIds = staffEntries.map((s) => s.venue_id)
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, type, is_active, organization_id")
    .in("id", venueIds)

  if (!venues?.length) return null

  const { data: orgData } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", venues[0].organization_id)
    .single()

  if (!orgData) return null

  return {
    user: { id: user.id, email: user.email! },
    profile,
    org: orgData,
    venues: venues.map((v) => ({ id: v.id, name: v.name, type: v.type, is_active: v.is_active })),
    isPreview: false,
  }
}
