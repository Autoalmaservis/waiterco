import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, Building2, Users, ShoppingBag, CreditCard, Star } from "lucide-react"

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    orgsResult, venuesResult, usersResult,
    ordersThisMonth, ordersLastMonth,
    paymentsThisMonth, paymentsLastMonth,
    paymentsToday,
    subsResult, reviewsResult,
    topOrgsResult,
  ] = await Promise.all([
    supabase.from("organizations").select("id, created_at"),
    supabase.from("venues").select("id, is_active, type"),
    supabase.from("profiles").select("id, role, created_at"),
    supabase.from("orders").select("id, total_amount").gte("created_at", startOfMonth),
    supabase.from("orders").select("id, total_amount").gte("created_at", startOfLastMonth).lte("created_at", endOfLastMonth),
    supabase.from("payments").select("total_amount").eq("status", "completed").gte("created_at", startOfMonth),
    supabase.from("payments").select("total_amount").eq("status", "completed").gte("created_at", startOfLastMonth).lte("created_at", endOfLastMonth),
    supabase.from("payments").select("total_amount").eq("status", "completed").gte("created_at", startOfToday),
    supabase.from("subscriptions").select("plan, status, monthly_price"),
    supabase.from("reviews").select("overall_rating"),
    supabase.from("organizations").select("id, name").limit(10),
  ])

  const totalOrgs = orgsResult.data?.length ?? 0
  const totalVenues = venuesResult.data?.length ?? 0
  const activeVenues = venuesResult.data?.filter(v => v.is_active).length ?? 0
  const totalUsers = usersResult.data?.filter(u => u.role !== 'customer').length ?? 0

  const revenueThisMonth = (paymentsThisMonth.data ?? []).reduce((s, p) => s + Number(p.total_amount), 0)
  const revenueLastMonth = (paymentsLastMonth.data ?? []).reduce((s, p) => s + Number(p.total_amount), 0)
  const revenueToday = (paymentsToday.data ?? []).reduce((s, p) => s + Number(p.total_amount), 0)

  const ordersThisMonthCount = ordersThisMonth.data?.length ?? 0
  const ordersLastMonthCount = ordersLastMonth.data?.length ?? 0

  const activeSubs = subsResult.data?.filter(s => s.status === 'active') ?? []
  const mrr = activeSubs.reduce((s, sub) => s + (sub.monthly_price ?? 0), 0)

  const avgRating = reviewsResult.data?.length
    ? (reviewsResult.data.reduce((s, r) => s + r.overall_rating, 0) / reviewsResult.data.length).toFixed(1)
    : '–'

  const subsByPlan = {
    free: subsResult.data?.filter(s => s.plan === 'free').length ?? 0,
    basic: subsResult.data?.filter(s => s.plan === 'basic' && s.status === 'active').length ?? 0,
    pro: subsResult.data?.filter(s => s.plan === 'pro' && s.status === 'active').length ?? 0,
    enterprise: subsResult.data?.filter(s => s.plan === 'enterprise' && s.status === 'active').length ?? 0,
  }

  const venuesByType = (venuesResult.data ?? []).reduce((acc, v) => {
    acc[v.type] = (acc[v.type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pct = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? '+100%' : '0%'
    const diff = ((current - prev) / prev * 100).toFixed(0)
    return `${Number(diff) >= 0 ? '+' : ''}${diff}%`
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytika</h1>
        <p className="text-gray-500 text-sm mt-1">Prehľad platformy eWaiter</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="MRR" value={`${mrr.toFixed(0)} €`} sub="mesačný opakovaný príjem" icon={<TrendingUp size={18} />} color="bg-green-50 text-green-600" />
        <KpiCard label="Tržby dnes" value={formatCurrency(revenueToday)} sub="dnešný deň" icon={<CreditCard size={18} />} color="bg-blue-50 text-blue-600" />
        <KpiCard label="Tržby tento mesiac" value={formatCurrency(revenueThisMonth)} sub={`${pct(revenueThisMonth, revenueLastMonth)} vs min. mesiac`} icon={<TrendingUp size={18} />} color="bg-orange-50 text-orange-600" />
        <KpiCard label="Objednávky tento mes." value={String(ordersThisMonthCount)} sub={`${pct(ordersThisMonthCount, ordersLastMonthCount)} vs min. mesiac`} icon={<ShoppingBag size={18} />} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Organizácie" value={String(totalOrgs)} sub="celkový počet" icon={<Building2 size={18} />} color="bg-blue-50 text-blue-600" />
        <KpiCard label="Prevádzky" value={`${activeVenues} / ${totalVenues}`} sub="aktívne / celkovo" icon={<Building2 size={18} />} color="bg-teal-50 text-teal-600" />
        <KpiCard label="Admins & Staff" value={String(totalUsers)} sub="bez zákazníkov" icon={<Users size={18} />} color="bg-indigo-50 text-indigo-600" />
        <KpiCard label="Priem. hodnotenie" value={avgRating} sub={`z ${reviewsResult.data?.length ?? 0} hodnotení`} icon={<Star size={18} />} color="bg-yellow-50 text-yellow-600" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Subscriptions breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Predplatné podľa plánu</h2>
          <div className="space-y-3">
            {[
              { plan: 'enterprise', label: 'Enterprise', color: 'bg-amber-500' },
              { plan: 'pro', label: 'Pro', color: 'bg-purple-500' },
              { plan: 'basic', label: 'Basic', color: 'bg-blue-500' },
              { plan: 'free', label: 'Free', color: 'bg-gray-300' },
            ].map(({ plan, label, color }) => {
              const count = subsByPlan[plan as keyof typeof subsByPlan]
              const max = Math.max(...Object.values(subsByPlan), 1)
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Venues by type */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Prevádzky podľa typu</h2>
          <div className="space-y-3">
            {[
              { type: 'restaurant', label: 'Reštaurácia', color: 'bg-orange-500' },
              { type: 'bar', label: 'Bar', color: 'bg-purple-500' },
              { type: 'cafe', label: 'Kaviareň', color: 'bg-amber-500' },
              { type: 'hotel', label: 'Hotel', color: 'bg-blue-500' },
            ].map(({ type, label, color }) => {
              const count = venuesByType[type] ?? 0
              const max = Math.max(...Object.values(venuesByType), 1)
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Subscription status overview */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Status predplatného</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { status: 'active', label: 'Aktívne', color: 'text-green-600 bg-green-50' },
            { status: 'trial', label: 'Trial', color: 'text-yellow-600 bg-yellow-50' },
            { status: 'expired', label: 'Vypršané', color: 'text-gray-600 bg-gray-50' },
            { status: 'cancelled', label: 'Zrušené', color: 'text-red-600 bg-red-50' },
          ].map(({ status, label, color }) => {
            const count = subsResult.data?.filter(s => s.status === status).length ?? 0
            return (
              <div key={status} className={`rounded-lg p-4 ${color.split(' ')[1]}`}>
                <p className={`text-2xl font-bold ${color.split(' ')[0]}`}>{count}</p>
                <p className="text-sm text-gray-600 mt-0.5">{label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
