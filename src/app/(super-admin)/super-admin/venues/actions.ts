'use server'

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { VenueType } from "@/types/database"

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('NeautorizovanĂ˝ prĂ­stup')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('NedostatoÄŤnĂ© oprĂˇvnenia')
}

export async function createVenueForOrg(formData: FormData): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const name = (formData.get('name') as string)?.trim()
    const orgId = (formData.get('organization_id') as string)?.trim()
    if (!name) return { error: 'Názov je povinný' }
    if (!orgId) return { error: 'Organizácia je povinná' }

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const supabase = createAdminClient()
    const { error } = await supabase.from('venues').insert({
      name,
      slug,
      organization_id: orgId,
      type: ((formData.get('type') as string) || 'restaurant') as VenueType,
      city: (formData.get('city') as string) || null,
      country: 'SK',
      currency: 'EUR',
      timezone: 'Europe/Bratislava',
      is_active: true,
      is_open: false,
    })
    if (error) return { error: error.message }
    revalidatePath('/super-admin/venues')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznáma chyba' }
  }
}

export async function toggleVenueActive(id: string, isActive: boolean): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from('venues').update({ is_active: isActive }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/venues')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}
