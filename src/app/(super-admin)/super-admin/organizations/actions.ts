'use server'

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('NeautorizovanĂ˝ prĂ­stup')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin') throw new Error('NedostatoÄŤnĂ© oprĂˇvnenia')
  return user
}

function str(formData: FormData, key: string) {
  return (formData.get(key) as string)?.trim() || null
}

export async function createOrganization(formData: FormData): Promise<{ error: string } | null> {
  try {
    const superAdmin = await verifySuperAdmin()
    const name = str(formData, 'name')
    if (!name) return { error: 'Názov organizácie je povinný' }

    const ownerEmail = str(formData, 'owner_email')
    const supabase = createAdminClient()

    let ownerId = superAdmin.id
    if (ownerEmail) {
      const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const found = users.find(u => u.email?.toLowerCase() === ownerEmail.toLowerCase())
      if (!found) return { error: `Používateľ s emailom ${ownerEmail} neexistuje` }
      ownerId = found.id
    }

    const { error } = await supabase.from('organizations').insert({
      name,
      owner_id: ownerId,
      billing_email: str(formData, 'billing_email'),
      ico: str(formData, 'ico'),
      dic: str(formData, 'dic'),
      ic_dph: str(formData, 'ic_dph'),
      street: str(formData, 'street'),
      city: str(formData, 'city'),
      postal_code: str(formData, 'postal_code'),
      country: str(formData, 'country') || 'SK',
      phone: str(formData, 'phone'),
      website: str(formData, 'website'),
    })
    if (error) return { error: error.message }
    revalidatePath('/super-admin/organizations')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}

export async function updateOrganization(id: string, formData: FormData): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const name = str(formData, 'name')
    if (!name) return { error: 'NĂˇzov organizĂˇcie je povinnĂ˝' }
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('organizations')
      .update({
        name,
        logo_url: str(formData, 'logo_url'),
        billing_email: str(formData, 'billing_email'),
        ico: str(formData, 'ico'),
        dic: str(formData, 'dic'),
        ic_dph: str(formData, 'ic_dph'),
        street: str(formData, 'street'),
        city: str(formData, 'city'),
        postal_code: str(formData, 'postal_code'),
        country: str(formData, 'country') || 'SK',
        phone: str(formData, 'phone'),
        website: str(formData, 'website'),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/organizations')
    revalidatePath(`/super-admin/organizations/${id}`)
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}

export async function deleteOrganization(id: string): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from('organizations').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/organizations')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}
