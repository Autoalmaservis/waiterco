'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin-context'

async function getCtx() {
  const c = await getAdminContext()
  if (!c) throw new Error('Nie ste prihlaseny')
  return c
}

type PositionData = { name: string; color: string; permissions: string[] }

export async function createPosition(data: PositionData): Promise<{ error: string } | null> {
  try {
    const c = await getCtx()
    const admin = createAdminClient()
    const { error } = await (admin as any).from('positions').insert({
      organization_id: c.org.id,
      name: data.name,
      color: data.color,
      permissions: data.permissions,
    } as any)
    if (error) return { error: error.message }
    revalidatePath('/admin/staff')
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updatePosition(id: string, data: PositionData): Promise<{ error: string } | null> {
  try {
    const c = await getCtx()
    const admin = createAdminClient()
    const { data: pos } = await (admin as any).from('positions').select('organization_id').eq('id', id).single()
    if ((pos as any)?.organization_id !== c.org.id) return { error: 'Nenajdene' }
    const { error } = await (admin as any).from('positions').update({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
    } as any).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/staff')
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deletePosition(id: string): Promise<{ error: string } | null> {
  try {
    const c = await getCtx()
    const admin = createAdminClient()
    const { data: pos } = await (admin as any).from('positions').select('organization_id').eq('id', id).single()
    if ((pos as any)?.organization_id !== c.org.id) return { error: 'Nenajdene' }
    const { error } = await (admin as any).from('positions').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/staff')
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function assignPosition(staffId: string, positionId: string | null): Promise<{ error: string } | null> {
  try {
    await getCtx()
    const admin = createAdminClient()
    const { error } = await admin.from('venue_staff').update({ position_id: positionId } as any).eq('id', staffId)
    if (error) return { error: error.message }
    revalidatePath('/admin/staff')
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateStaffMember(
  staffId: string,
  data: { role?: string; permissions?: string[] | null }
): Promise<{ error: string } | null> {
  try {
    await getCtx()
    const admin = createAdminClient()
    const { error } = await admin.from('venue_staff').update(data as any).eq('id', staffId)
    if (error) return { error: error.message }
    revalidatePath('/admin/staff')
    return null
  } catch (e) {
    return { error: (e as Error).message }
  }
}
