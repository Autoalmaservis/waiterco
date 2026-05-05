"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"
import type { VenueType } from "@/types/database"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export async function createVenue(formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const name = formData.get("name") as string
  if (!name) return { error: "NĂˇzov je povinnĂ˝" }

  const supabase = createAdminClient()

  const slug = slugify(name)

  const { error } = await supabase.from("venues").insert({
    organization_id: ctx.org.id,
    name,
    slug,
    type: (formData.get("type") as VenueType) || "restaurant",
    description: (formData.get("description") as string) || null,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    country: (formData.get("country") as string) || "SK",
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    website: (formData.get("website") as string) || null,
    currency: (formData.get("currency") as string) || "EUR",
    timezone: (formData.get("timezone") as string) || "Europe/Bratislava",
    is_active: true,
    is_open: false,
  })

  if (error) return { error: error.message }

  revalidatePath("/admin/venues")
  revalidatePath("/admin")
  return null
}

export async function updateVenue(id: string, formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const name = formData.get("name") as string

  const { error } = await supabase
    .from("venues")
    .update({
      name,
      type: (formData.get("type") as VenueType) || "restaurant",
      description: (formData.get("description") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      country: (formData.get("country") as string) || "SK",
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      website: (formData.get("website") as string) || null,
      currency: (formData.get("currency") as string) || "EUR",
      timezone: (formData.get("timezone") as string) || "Europe/Bratislava",
      primary_color: (formData.get("primary_color") as string) || null,
      closed_reason: (formData.get("closed_reason") as string) || null,
      allow_delivery: formData.get("allow_delivery") === "true",
      allow_takeaway: formData.get("allow_takeaway") === "true",
      allow_qr: formData.get("allow_qr") === "true",
    } as any)
    .eq("id", id)
    .eq("organization_id", ctx.org.id)

  if (error) return { error: error.message }

  revalidatePath("/admin/venues")
  return null
}

export async function deleteVenue(id: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("venues")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.org.id)

  if (error) return { error: error.message }

  revalidatePath("/admin/venues")
  revalidatePath("/admin")
  return null
}

export async function toggleVenueActive(id: string, is_active: boolean): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("venues")
    .update({ is_active })
    .eq("id", id)
    .eq("organization_id", ctx.org.id)

  if (error) return { error: error.message }

  revalidatePath("/admin/venues")
  return null
}

export async function toggleVenueOpen(id: string, is_open: boolean): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("venues")
    .update({ is_open })
    .eq("id", id)
    .eq("organization_id", ctx.org.id)

  if (error) return { error: error.message }

  revalidatePath("/admin/venues")
  return null
}
