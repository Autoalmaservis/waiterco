"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"

async function verifyVenueAccess(venueId: string) {
  const ctx = await getAdminContext()
  if (!ctx) throw new Error("Nie ste prihlásený")
  if (!ctx.venues.find((v) => v.id === venueId)) throw new Error("Prevádzka nepatrí vašej organizácii")
  return ctx
}

export async function saveOpeningHours(
  venueId: string,
  formData: FormData
): Promise<{ error: string } | null> {
  try { await verifyVenueAccess(venueId) } catch (e) { return { error: (e as Error).message } }

  const supabase = await createClient()

  const rows = Array.from({ length: 7 }, (_, day) => ({
    venue_id: venueId,
    day_of_week: day,
    is_closed: formData.get(`is_closed_${day}`) === "true",
    open_time: (formData.get(`opens_at_${day}`) as string) || "09:00",
    close_time: (formData.get(`closes_at_${day}`) as string) || "22:00",
  }))

  const { error } = await supabase
    .from("opening_hours")
    .upsert(rows, { onConflict: "venue_id,day_of_week" })

  if (error) return { error: error.message }

  revalidatePath("/admin/settings")
  return null
}

export async function addVenueClosure(
  venueId: string,
  date: string,
  reason: string | null
): Promise<{ error: string } | null> {
  try { await verifyVenueAccess(venueId) } catch (e) { return { error: (e as Error).message } }
  const supabase = await createClient()
  const { error } = await supabase.from("venue_closures").insert({ venue_id: venueId, date, reason: reason || null })
  if (error) return { error: error.message }
  revalidatePath("/admin/settings")
  return null
}

export async function removeVenueClosure(id: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }
  const supabase = await createClient()
  const { error } = await supabase.from("venue_closures").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/settings")
  return null
}

export async function uploadVenueCoverImage(
  venueId: string,
  formData: FormData
): Promise<{ error: string } | { url: string }> {
  try { await verifyVenueAccess(venueId) } catch (e) { return { error: (e as Error).message } }

  const file = formData.get("cover_image") as File | null
  if (!file || file.size === 0) return { error: "Žiadny súbor" }
  if (file.size > 5 * 1024 * 1024) return { error: "Súbor je príliš veľký (max 5 MB)" }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `venues/${venueId}/cover.${ext}`

  const admin = createAdminClient()
  const { error: upErr } = await (admin as any).storage
    .from("venue-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (upErr) return { error: upErr.message }

  const { data } = (admin as any).storage.from("venue-images").getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  const { error: dbErr } = await (admin as any)
    .from("venues")
    .update({ cover_image_url: url })
    .eq("id", venueId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath("/admin/settings")
  return { url }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error: string } | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return { error: "Nie ste prihlaseny" }
    if (newPassword.length < 8) return { error: "Nove heslo musi mat aspon 8 znakov" }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) return { error: "Aktualne heslo je nespravne" }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}
