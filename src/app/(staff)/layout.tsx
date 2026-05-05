import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import type { StaffRole } from "@/types/database"
import StaffHistoryButton from "./StaffHistoryButton"

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [{ data: profile }, { data: venueStaff }] = await Promise.all([
    supabase.from("profiles").select("role, full_name").eq("id", user.id).single(),
    (supabase as any).from("venue_staff").select("venue_id, role, position_id")
      .eq("user_id", user.id).eq("is_active", true).limit(1).single(),
  ])

  // Block only super_admin and restaurant_admin — everyone else either has
  // a venue_staff record (staff/manager) or sees "not assigned" in the page
  if (profile?.role === "super_admin") redirect("/super-admin")
  if (profile?.role === "restaurant_admin") redirect("/admin")
  if (!venueStaff && profile?.role !== "manager") redirect("/sign-out")

  let venueName: string | null = null
  if (venueStaff?.venue_id) {
    const { data: venue } = await supabase.from("venues").select("name").eq("id", venueStaff.venue_id).single()
    venueName = venue?.name ?? null
  }

  let positionLabel: string | null = null
  if (venueStaff?.position_id) {
    const admin = createAdminClient()
    const { data: pos } = await (admin as any).from("positions").select("name").eq("id", venueStaff.position_id).single()
    positionLabel = pos?.name ?? null
  }

  if (!positionLabel) {
    const roleLabels: Record<string, string> = { manager: "Manager", waiter: "Casnik", cook: "Kuchar", barman: "Barman" }
    positionLabel = venueStaff?.role ? (roleLabels[venueStaff.role] ?? null) : null
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <header
        className="h-14 flex items-center px-4 shrink-0 relative"
        style={{ backgroundColor: "var(--brand-navy)" }}
      >
        {/* Left: logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            e
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">eWaiter</p>
            {venueName && <p className="text-blue-300 text-xs leading-tight">{venueName}</p>}
          </div>
        </div>

        {/* Center: user name */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-white text-sm font-semibold leading-tight">{profile?.full_name ?? user.email}</p>
          {positionLabel && <p className="text-blue-300 text-xs leading-tight">{positionLabel}</p>}
        </div>

        {/* Right: history + logout */}
        <div className="ml-auto flex items-center gap-2">
          {venueStaff?.venue_id && <StaffHistoryButton venueId={venueStaff.venue_id} />}
          <a
            href="/sign-out"
            className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            Odhlasit
          </a>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
