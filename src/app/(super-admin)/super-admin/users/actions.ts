'use server'

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { UserRole, StaffRole } from "@/types/database"

const staffRoles = new Set(['manager', 'waiter', 'cook', 'barman'])

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Neautorizovaný prístup')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin') throw new Error('Nedostatočné oprávnenia')
  return user
}

export async function createUser(formData: FormData): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const email       = (formData.get('email')        as string)?.trim()
    const fullName    = (formData.get('full_name')    as string)?.trim()
    const displayRole = (formData.get('display_role') as string) || 'restaurant_admin'
    const password    = (formData.get('password')     as string)?.trim()
    const venueId     = (formData.get('venue_id')     as string)?.trim()

    if (!email) return { error: 'Email je povinný' }
    if (!password || password.length < 8) return { error: 'Heslo musí mať aspoň 8 znakov' }

    // Map display role → profile UserRole
    let profileRole: UserRole
    if (displayRole === 'super_admin')      profileRole = 'super_admin'
    else if (displayRole === 'restaurant_admin') profileRole = 'restaurant_admin'
    else if (displayRole === 'manager')     profileRole = 'manager'
    else if (staffRoles.has(displayRole))   profileRole = 'waiter'
    else                                    profileRole = 'customer'

    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) return { error: error.message }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName || null,
      role: profileRole,
      language: 'sk',
      is_active: true,
    })
    if (profileError) return { error: profileError.message }

    // Staff role → insert into venue_staff
    if (staffRoles.has(displayRole) && venueId) {
      const { error: staffError } = await supabase.from('venue_staff').insert({
        venue_id: venueId,
        user_id: data.user.id,
        role: displayRole as StaffRole,
        is_active: true,
      })
      if (staffError) return { error: 'Používateľ bol vytvorený, ale priradenie k prevádzke zlyhalo: ' + staffError.message }
    }

    // Restaurant admin → optionally create org + venue
    if (displayRole === 'restaurant_admin') {
      const orgName   = (formData.get('org_name')   as string)?.trim()
      const venueName = (formData.get('venue_name') as string)?.trim()

      if (orgName) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: orgName, owner_id: data.user.id })
          .select('id')
          .single()
        if (orgError) return { error: 'Používateľ bol vytvorený, ale org sa nepodarilo vytvoriť: ' + orgError.message }

        if (venueName && orgData) {
          const slug = venueName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')

          await supabase.from('venues').insert({
            name: venueName,
            slug,
            organization_id: orgData.id,
            type: 'restaurant',
            country: 'SK',
            currency: 'EUR',
            timezone: 'Europe/Bratislava',
            is_active: true,
            is_open: false,
          })
        }
      }
    }

    revalidatePath('/super-admin/users')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznáma chyba' }
  }
}

export async function updateUser(id: string, formData: FormData): Promise<{ error: string } | null> {
  try {
    const currentUser = await verifySuperAdmin()
    const fullName = (formData.get('full_name') as string)?.trim()
    const role = formData.get('role') as UserRole
    const isActive = formData.get('is_active') === 'true'

    if (id === currentUser.id && role !== 'super_admin') {
      return { error: 'Nemôžeš zmeniť vlastnú rolu' }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').update({
      full_name: fullName || null,
      role,
      is_active: isActive,
    }).eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/super-admin/users')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznáma chyba' }
  }
}

export async function setUserPassword(id: string, formData: FormData): Promise<{ error: string } | null> {
  try {
    const currentUser = await verifySuperAdmin()
    if (id === currentUser.id) return { error: 'Vlastné heslo zmeň cez nastavenia účtu' }
    const password = (formData.get('password') as string)?.trim()
    if (!password || password.length < 8) return { error: 'Heslo musí mať aspoň 8 znakov' }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(id, { password })
    if (error) return { error: error.message }

    revalidatePath('/super-admin/users')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznáma chyba' }
  }
}

export async function deleteUser(id: string): Promise<{ error: string } | null> {
  try {
    const currentUser = await verifySuperAdmin()
    if (id === currentUser.id) return { error: 'Nemôžeš zmazať vlastný účet' }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return { error: error.message }

    revalidatePath('/super-admin/users')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Neznáma chyba' }
  }
}
