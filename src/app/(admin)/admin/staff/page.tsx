import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createAdminClient } from "@/lib/supabase/server"
import StaffClient from "./StaffClient"
import type { StaffRole } from "@/types/database"
import type { PositionRow } from "./PositionsManager"

export default async function StaffPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const admin = createAdminClient()
  const venueIds = ctx.venues.map((v) => v.id)

  if (venueIds.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Personal</h1>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Ziadne prevadzky
        </div>
      </div>
    )
  }

  const [positionsRes, staffRes] = await Promise.all([
    (admin as any).from("positions").select("id, name, color, permissions").eq("organization_id", ctx.org.id).order("created_at"),
    (admin.from("venue_staff") as any).select("id, venue_id, user_id, role, is_active, joined_at, position_id, permissions").in("venue_id", venueIds).order("joined_at", { ascending: false }),
  ])

  const positions: PositionRow[] = positionsRes.data ?? []
  const positionMap = Object.fromEntries(positions.map((p: PositionRow) => [p.id, p]))

  const entries: any[] = staffRes.data ?? []
  const userIds = [...new Set(entries.map((s) => s.user_id as string))]

  const [profilesRes, authRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
    userIds.length > 0 ? admin.auth.admin.listUsers() : Promise.resolve({ data: { users: [] }, error: null }),
  ])

  const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p: any) => [p.id, p]))
  const emailMap = Object.fromEntries((authRes.data?.users ?? []).map((u: any) => [u.id, u.email ?? ""]))
  const venueNameMap = Object.fromEntries(ctx.venues.map((v) => [v.id, v.name]))

  const enriched = entries.map((entry) => ({
    ...entry,
    role: entry.role as StaffRole,
    profile: profileMap[entry.user_id] ?? null,
    email: emailMap[entry.user_id] ?? "",
    venue_name: venueNameMap[entry.venue_id] ?? "-",
    position_id: entry.position_id ?? null,
    position: entry.position_id ? (positionMap[entry.position_id] ?? null) : null,
    permissions: entry.permissions ?? null,
  }))

  return (
    <div className="p-8">
      <StaffClient staffEntries={enriched} venues={ctx.venues} positions={positions} />
    </div>
  )
}
