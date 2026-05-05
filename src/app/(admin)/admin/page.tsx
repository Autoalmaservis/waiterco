import { redirect } from "next/navigation"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import VenueSelector from "./VenueSelector"
import {
  Building2,
  ShoppingBag,
  TrendingUp,
  Clock,
  UtensilsCrossed,
  BellRing,
} from "lucide-react"

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700",
  ready: "bg-teal-100 text-teal-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
}

const statusLabels: Record<string, string> = {
  pending: "Čaká",
  confirmed: "Potvrdená",
  preparing: "Pripravuje sa",
  ready: "Pripravená",
  delivered: "Doručená",
  cancelled: "Zrušená",
}

const callReasonLabels: Record<string, string> = {
  help: "Pomoc",
  water: "Voda",
  bill: "Účet",
  other: "Iné",
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/admin")

  const venueIds = ctx.venues.map((v) => v.id)

  if (venueIds.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{ctx.org.name}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Zatiaľ žiadne prevádzky. Pridajte prvú prevádzku.</p>
        </div>
      </div>
    )
  }

  const { venue: venueParam } = await searchParams
  const selectedVenueId = ctx.venues.find((v) => v.id === venueParam)?.id ?? ctx.venues[0]!.id
  const selectedVenue = ctx.venues.find((v) => v.id === selectedVenueId)!

  const supabase = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    venueDetailResult,
    menuItemsResult,
    todayOrdersResult,
    pendingOrdersResult,
    recentOrdersResult,
    waiterCallsResult,
  ] = await Promise.all([
    supabase
      .from("venues")
      .select("id, is_active, is_open")
      .eq("id", selectedVenueId)
      .single(),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", selectedVenueId),
    supabase
      .from("orders")
      .select("total_amount")
      .eq("venue_id", selectedVenueId)
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", selectedVenueId)
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("id, order_number, table_id, status, total_amount, created_at")
      .eq("venue_id", selectedVenueId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("waiter_calls")
      .select("id, table_id, reason, custom_message, created_at")
      .eq("venue_id", selectedVenueId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ])

  const venueDetail = venueDetailResult.data
  const isActive = venueDetail?.is_active ?? false
  const isOpen = venueDetail?.is_open ?? false

  const todayRevenue = (todayOrdersResult.data ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0)
  const todayOrderCount = todayOrdersResult.data?.length ?? 0
  const menuItemCount = menuItemsResult.count ?? 0
  const pendingCount = pendingOrdersResult.count ?? 0
  const waiterCallCount = waiterCallsResult.data?.length ?? 0

  const venueStatusLabel = !isActive ? "Neaktívna" : isOpen ? "Otvorená" : "Zatvorená"
  const venueStatusColor = !isActive
    ? "bg-gray-50 text-gray-400"
    : isOpen
    ? "bg-emerald-50 text-emerald-600"
    : "bg-yellow-50 text-yellow-600"

  const statCards = [
    {
      label: "Stav prevádzky",
      value: venueStatusLabel,
      icon: Building2,
      color: venueStatusColor,
    },
    {
      label: "Dnešné objednávky",
      value: todayOrderCount,
      icon: ShoppingBag,
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Dnešné tržby",
      value: formatCurrency(todayRevenue),
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Čakajúce objednávky",
      value: pendingCount,
      icon: Clock,
      color: pendingCount > 0 ? "bg-yellow-50 text-yellow-600" : "bg-gray-50 text-gray-400",
    },
    {
      label: "Položky v menu",
      value: menuItemCount,
      icon: UtensilsCrossed,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Výzvy čašníka",
      value: waiterCallCount,
      icon: BellRing,
      color: waiterCallCount > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400",
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{selectedVenue.name}</p>
        </div>
        {ctx.venues.length > 1 && (
          <VenueSelector venues={ctx.venues} selectedVenueId={selectedVenueId} basePath="/admin" />
        )}
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

      <div className="grid grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Posledné objednávky</h2>
            <a
              href={`/admin/orders?venue=${selectedVenueId}`}
              className="text-sm font-medium"
              style={{ color: "var(--brand-orange)" }}
            >
              Všetky →
            </a>
          </div>
          {!recentOrdersResult.data?.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">Žiadne objednávky</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrdersResult.data.map((order) => (
                <div key={order.id} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">#{order.order_number}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {new Date(order.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {statusLabels[order.status] ?? order.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    {formatCurrency(Number(order.total_amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waiter calls */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Výzvy čašníka</h2>
          </div>
          {!waiterCallsResult.data?.length ? (
            <div className="py-12 text-center text-gray-400 text-sm">Žiadne aktívne výzvy</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {waiterCallsResult.data.map((call) => (
                <div key={call.id} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="relative shrink-0 w-8 h-8">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: "var(--brand-orange)", opacity: 0.15 }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--brand-orange)" }}>
                      <BellRing size={14} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Stôl {call.table_id.slice(-6)}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {callReasonLabels[call.reason] ?? call.reason}
                      {call.custom_message ? ` – ${call.custom_message}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(call.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
