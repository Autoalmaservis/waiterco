import { createAdminClient, createClient } from "@/lib/supabase/server"
import UsersClient from "./UsersClient"
import type { UserRole } from "@/types/database"

export type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  venue_id: string | null
  venue_name: string | null
  staff_role: string | null
}

export type VenueOption = {
  id: string
  name: string
  org_name: string
}

export default async function UsersPage() {
  const [supabase, admin] = await Promise.all([createClient(), createAdminClient()])

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const [authResult, profilesResult, venuesResult, orgsResult, staffResult] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('profiles').select('id, full_name, role, is_active, last_login_at'),
    admin.from('venues').select('id, name, organization_id'),
    admin.from('organizations').select('id, name'),
    admin.from('venue_staff').select('user_id, venue_id, role'),
  ])

  const profilesMap = new Map((profilesResult.data ?? []).map(p => [p.id, p]))
  const orgMap = new Map((orgsResult.data ?? []).map(o => [o.id, o.name]))

  const venues: VenueOption[] = (venuesResult.data ?? []).map(v => ({
    id: v.id,
    name: v.name,
    org_name: orgMap.get(v.organization_id) ?? '–',
  }))

  const venueMap = new Map(venues.map(v => [v.id, v.name]))

  // Map user → first venue_staff entry
  const staffMap = new Map<string, { venue_id: string; role: string }>()
  for (const s of staffResult.data ?? []) {
    if (!staffMap.has(s.user_id)) staffMap.set(s.user_id, { venue_id: s.venue_id, role: s.role })
  }

  const users: UserRow[] = (authResult.data?.users ?? [])
    .filter(u => u.email)
    .map(u => {
      const profile = profilesMap.get(u.id)
      const staff = staffMap.get(u.id)
      return {
        id: u.id,
        email: u.email!,
        full_name: profile?.full_name ?? null,
        role: (profile?.role ?? 'customer') as UserRole,
        is_active: profile?.is_active ?? true,
        last_login_at: profile?.last_login_at ?? u.last_sign_in_at ?? null,
        created_at: u.created_at,
        venue_id: staff?.venue_id ?? null,
        venue_name: staff ? (venueMap.get(staff.venue_id) ?? null) : null,
        staff_role: staff?.role ?? null,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="p-8">
      <UsersClient users={users} currentUserId={currentUser?.id ?? ''} venues={venues} />
    </div>
  )
}
