"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"
import type { DBTable, VenueZone } from "@/types/database"

async function ctx() {
  const c = await getAdminContext()
  if (!c) throw new Error("Nie ste prihlásený")
  return c
}

// ── Tables ──────────────────────────────────────────────────────────────────

export async function createFloorTable(
  venueId: string, name: string, x: number, y: number
): Promise<{ table: DBTable } | { error: string }> {
  try {
    const c = await ctx()
    if (!c.venues.find(v => v.id === venueId)) return { error: "Prevádzka nenájdená" }
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("tables")
      .insert({ venue_id: venueId, name, x_pos: x, y_pos: y, shape: "square", is_active: true })
      .select()
      .single()
    if (error) return { error: error.message }
    revalidatePath("/admin/tables")
    return { table: data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateFloorTable(
  id: string,
  updates: { name?: string; capacity?: number | null; shape?: string; is_active?: boolean }
): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const { error } = await supabase.from("tables").update(updates).eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/tables")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteTable(id: string): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const { error } = await supabase.from("tables").delete().eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/tables")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Zones ───────────────────────────────────────────────────────────────────

export async function createFloorZone(
  venueId: string, name: string, x: number, y: number, w: number, h: number, color: string
): Promise<{ zone: VenueZone } | { error: string }> {
  try {
    const c = await ctx()
    if (!c.venues.find(v => v.id === venueId)) return { error: "Prevádzka nenájdená" }
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("venue_zones")
      .insert({ venue_id: venueId, name, x_pos: x, y_pos: y, w, h, color, sort_order: 0, is_active: true })
      .select()
      .single()
    if (error) return { error: error.message }
    revalidatePath("/admin/tables")
    return { zone: data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateFloorZone(
  id: string,
  updates: { name?: string; color?: string }
): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const { error } = await supabase.from("venue_zones").update(updates).eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/tables")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteZone(id: string): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const { error } = await supabase.from("venue_zones").delete().eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/admin/tables")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Batch save positions ─────────────────────────────────────────────────────

export async function savePositions(
  tables: { id: string; x_pos: number; y_pos: number }[],
  zones: { id: string; x_pos: number; y_pos: number; w: number; h: number }[]
): Promise<{ error: string } | null> {
  try {
    await ctx()
    const supabase = createAdminClient()
    const results = await Promise.all([
      ...tables.map(t => supabase.from("tables").update({ x_pos: Math.round(t.x_pos), y_pos: Math.round(t.y_pos) }).eq("id", t.id)),
      ...zones.map(z => supabase.from("venue_zones").update({ x_pos: Math.round(z.x_pos), y_pos: Math.round(z.y_pos), w: Math.round(z.w), h: Math.round(z.h) }).eq("id", z.id)),
    ])
    const failed = results.find(r => r.error)
    if (failed?.error) return { error: failed.error.message }
    revalidatePath("/admin/tables")
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}
