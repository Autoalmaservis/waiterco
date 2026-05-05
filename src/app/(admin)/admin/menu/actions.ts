"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"

export async function createCategory(formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const venue_id = formData.get("venue_id") as string
  const name = formData.get("name") as string
  if (!venue_id || !name) return { error: "ChĂ˝bajĂş povinnĂ© polia" }

  const supabase = createAdminClient()

  const { error } = await supabase.from("menu_categories").insert({
    venue_id,
    name,
    description: (formData.get("description") as string) || null,
    sort_order: Number(formData.get("sort_order") ?? 0),
    is_active: formData.get("is_active") === "true",
    available_from: (formData.get("available_from") as string) || null,
    available_to: (formData.get("available_to") as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/admin/menu")
  return null
}

export async function updateCategory(id: string, formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("menu_categories")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      sort_order: Number(formData.get("sort_order") ?? 0),
      is_active: formData.get("is_active") === "true",
      available_from: (formData.get("available_from") as string) || null,
      available_to: (formData.get("available_to") as string) || null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin/menu")
  return null
}

export async function deleteCategory(id: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const { error } = await supabase.from("menu_categories").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin/menu")
  return null
}

export async function moveCategoryOrder(id: string, direction: "up" | "down"): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const { data: cat } = await supabase
    .from("menu_categories")
    .select("sort_order, venue_id")
    .eq("id", id)
    .single()

  if (!cat) return { error: "KategĂłria nenĂˇjdenĂˇ" }

  const newOrder = direction === "up" ? cat.sort_order - 1 : cat.sort_order + 1

  const { data: neighbor } = await supabase
    .from("menu_categories")
    .select("id, sort_order")
    .eq("venue_id", cat.venue_id)
    .eq("sort_order", newOrder)
    .single()

  if (neighbor) {
    await supabase.from("menu_categories").update({ sort_order: cat.sort_order }).eq("id", neighbor.id)
  }

  await supabase.from("menu_categories").update({ sort_order: newOrder }).eq("id", id)

  revalidatePath("/admin/menu")
  return null
}

export async function createMenuItem(formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const venue_id = formData.get("venue_id") as string
  const category_id = formData.get("category_id") as string
  const name = formData.get("name") as string
  if (!venue_id || !category_id || !name) return { error: "ChĂ˝bajĂş povinnĂ© polia" }

  const supabase = createAdminClient()

  const allergenRaw = (formData.get("allergens") as string) || ""
  const tagsRaw = (formData.get("tags") as string) || ""

  const allergens = allergenRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const tags = tagsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const { error } = await supabase.from("menu_items").insert({
    venue_id,
    category_id,
    name,
    description: (formData.get("description") as string) || null,
    base_price: Number(formData.get("base_price") ?? 0),
    preparation_time: formData.get("preparation_time") ? Number(formData.get("preparation_time")) : null,
    calories: formData.get("calories") ? Number(formData.get("calories")) : null,
    allergens,
    tags,
    is_active: formData.get("is_active") === "true",
    is_available: formData.get("is_available") !== "false",
    unavailable_reason: (formData.get("unavailable_reason") as string) || null,
    sort_order: Number(formData.get("sort_order") ?? 0),
    image_url: (formData.get("image_url") as string) || null,
    station: (formData.get("station") as string) || "kitchen",
  } as any)

  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${category_id}`)
  return null
}

export async function updateMenuItem(id: string, formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlĂˇsenĂ˝" }

  const supabase = createAdminClient()

  const allergenRaw = (formData.get("allergens") as string) || ""
  const tagsRaw = (formData.get("tags") as string) || ""

  const allergens = allergenRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const tags = tagsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const category_id = formData.get("category_id") as string

  const { error } = await supabase
    .from("menu_items")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      base_price: Number(formData.get("base_price") ?? 0),
      preparation_time: formData.get("preparation_time") ? Number(formData.get("preparation_time")) : null,
      calories: formData.get("calories") ? Number(formData.get("calories")) : null,
      allergens,
      tags,
      is_active: formData.get("is_active") === "true",
      is_available: formData.get("is_available") !== "false",
      unavailable_reason: (formData.get("unavailable_reason") as string) || null,
      sort_order: Number(formData.get("sort_order") ?? 0),
      image_url: (formData.get("image_url") as string) || null,
      station: (formData.get("station") as string) || "kitchen",
    } as any)
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${category_id}`)
  return null
}

export async function deleteMenuItem(id: string, categoryId: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()

  const { error } = await supabase.from("menu_items").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}

export async function createModifierGroup(
  itemId: string, venueId: string, categoryId: string,
  name: string, minSelect: number, maxSelect: number, sortOrder: number
): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()
  const { error } = await (supabase as any).from("item_modifier_groups").insert({
    item_id: itemId, venue_id: venueId, name, min_select: minSelect, max_select: maxSelect, sort_order: sortOrder,
  })
  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}

export async function updateModifierGroup(
  groupId: string, categoryId: string,
  name: string, minSelect: number, maxSelect: number
): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()
  const { error } = await (supabase as any).from("item_modifier_groups")
    .update({ name, min_select: minSelect, max_select: maxSelect })
    .eq("id", groupId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}

export async function deleteModifierGroup(groupId: string, categoryId: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()
  const { error } = await (supabase as any).from("item_modifier_groups").delete().eq("id", groupId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}

export async function createModifier(
  groupId: string, categoryId: string,
  name: string, price: number, sortOrder: number
): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()
  const { error } = await (supabase as any).from("item_modifiers").insert({
    group_id: groupId, name, price, is_available: true, sort_order: sortOrder,
  })
  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}

export async function updateModifier(
  modifierId: string, categoryId: string,
  name: string, price: number, isAvailable: boolean
): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()
  const { error } = await (supabase as any).from("item_modifiers")
    .update({ name, price, is_available: isAvailable })
    .eq("id", modifierId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}

export async function deleteModifier(modifierId: string, categoryId: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlásený" }

  const supabase = createAdminClient()
  const { error } = await (supabase as any).from("item_modifiers").delete().eq("id", modifierId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/menu/${categoryId}`)
  return null
}
