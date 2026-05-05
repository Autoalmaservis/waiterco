'use server'

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Neautorizovany pristup')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('Nedostatocne opravnenia')
  return user
}

export async function createFeatureFlag(formData: FormData): Promise<{ error: string } | null> {
  try {
    const user = await verifySuperAdmin()
    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    if (!name) return { error: 'Nazov je povinny' }
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const supabase = createAdminClient()
    const { error } = await supabase.from('feature_flags').insert({
      key,
      description,
      venue_id: null,
      is_enabled: false,
      updated_by: user.id,
    } as any)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/feature-flags')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznama chyba' }
  }
}

export async function toggleFeatureFlag(id: string, enabled: boolean): Promise<{ error: string } | null> {
  try {
    const user = await verifySuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from('feature_flags')
      .update({ is_enabled: enabled, updated_by: user.id })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/feature-flags')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznama chyba' }
  }
}

export async function deleteFeatureFlag(id: string): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from('feature_flags').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/feature-flags')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznama chyba' }
  }
}
