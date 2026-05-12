import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Building2, Users, ShoppingBag, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"

async function getStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [orgsResult, venuesResult, usersResult, ordersResult, paymentsResult, ticketsResult] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("venues").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("role", "customer"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("total_amount").eq("status", "completed"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ])

  const totalRevenue = (paymentsResult.data ?? []).reduce((sum, p) => sum + Number(p.total_amount), 0)

  return {
    organizations: orgsResult.count ?? 0,
    venues: venuesResult.count ?? 0,
    users: usersResult.count ?? 0,
    orders: ordersResult.count ?? 0,
    totalRevenue,
    openTickets: ticketsResult.count ?? 0,
  }
}

async function getRecentOrgs(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, billing_email, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  if (!orgs) return []

  const orgIds = orgs.map(o => o.id)
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("organization_id, plan, status")
    .in("organization_id", orgIds)

  return orgs.map(org => ({
    ...org,
    subscription: subs?.find(s => s.organization_id === org.id) ?? null,
  }))
}

export default async function SuperAdminDashboard() {
  const supabase = await createClient()
  const [stats, recentOrgs] = await Promise.all([
    getStats(supabase),
    getRecentOrgs(supabase),
  ])

  const statCards = [
    { label: "Organizácie", value: stats.organizations, icon: Building2, color: "bg-blue-50 text-blue-600" },
    { label: "Prevádzky", value: stats.venues, icon: Building2, color: "bg-purple-50 text-purple-600" },
    { label: "Admins & Staff", value: stats.users, icon: Users, color: "bg-green-50 text-green-600" },
    { label: "Celkové objednávky", value: stats.orders.toLocaleString("sk-SK"), icon: ShoppingBag, color: "bg-orange-50 text-orange-600" },
    { label: "Celkové tržby", value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
    { label: "Otvorené tickety", value: stats.openTickets, icon: AlertCircle, color: stats.openTickets > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400" },
  ]

  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    basic: "bg-blue-100 text-blue-700",
    pro: "bg-purple-100 text-purple-700",
    enterprise: "bg-amber-100 text-amber-700",
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Prehľad celej platformy Waiterco</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent organizations */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Najnovšie organizácie</h2>
          <a href="/super-admin/organizations" className="text-sm font-medium" style={{ color: "var(--brand-orange)" }}>
            Zobraziť všetky →
          </a>
        </div>
        {recentOrgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CheckCircle2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Zatiaľ žiadne organizácie</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrgs.map((org) => {
              const sub = org.subscription
              return (
                <div key={org.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: "var(--brand-orange)" }}>
                    {org.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{org.name}</p>
                    <p className="text-xs text-gray-400 truncate">{org.billing_email ?? "–"}</p>
                  </div>
                  {sub && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColors[sub.plan] ?? "bg-gray-100 text-gray-600"}`}>
                      {sub.plan}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(org.created_at).toLocaleDateString("sk-SK")}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
