import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: msgs, error } = await adminSupabase
    .from('support_messages')
    .select('id, ticket_id, sender_id, message, is_staff, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const senderIds = [...new Set((msgs ?? []).filter(m => m.sender_id).map(m => m.sender_id!))]
  let namesMap = new Map<string, string>()

  if (senderIds.length > 0) {
    const { data: profiles } = await adminSupabase.from('profiles').select('id, full_name').in('id', senderIds)
    const { data: { users } } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) ?? [])
    users.forEach(u => {
      namesMap.set(u.id, profileMap.get(u.id) || u.email || u.id)
    })
  }

  const messages = (msgs ?? []).map(m => ({
    ...m,
    sender_name: m.sender_id ? (namesMap.get(m.sender_id) ?? m.sender_id) : null,
  }))

  return NextResponse.json({ messages })
}
