'use server'

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/database"

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('NeautorizovanĂ˝ prĂ­stup')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') throw new Error('NedostatoÄŤnĂ© oprĂˇvnenia')
  return user
}

function str(formData: FormData, key: string) {
  return (formData.get(key) as string)?.trim() || null
}

export async function createSubscription(formData: FormData): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const orgId = str(formData, 'organization_id')
    const plan = str(formData, 'plan') as SubscriptionPlan
    const status = str(formData, 'status') as SubscriptionStatus
    const startedAt = str(formData, 'started_at')
    if (!orgId || !plan || !status || !startedAt) return { error: 'VyplĹte vĹˇetky povinnĂ© polia' }

    const monthlyPrice = str(formData, 'monthly_price')
    const expiresAt = str(formData, 'expires_at')

    const supabase = createAdminClient()
    const { error } = await supabase.from('subscriptions').insert({
      organization_id: orgId,
      plan,
      status,
      started_at: startedAt,
      expires_at: expiresAt || null,
      monthly_price: monthlyPrice ? Number(monthlyPrice) : null,
    })
    if (error) return { error: error.message }
    revalidatePath('/super-admin/billing')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}

export async function updateSubscription(id: string, formData: FormData): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const plan = str(formData, 'plan') as SubscriptionPlan
    const status = str(formData, 'status') as SubscriptionStatus
    const startedAt = str(formData, 'started_at')
    const expiresAt = str(formData, 'expires_at')
    const monthlyPrice = str(formData, 'monthly_price')

    const supabase = createAdminClient()
    const { error } = await supabase.from('subscriptions').update({
      plan,
      status,
      started_at: startedAt || undefined,
      expires_at: expiresAt || null,
      monthly_price: monthlyPrice ? Number(monthlyPrice) : null,
    }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/billing')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}

export async function deleteSubscription(id: string): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/super-admin/billing')
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'NeznĂˇma chyba' }
  }
}
