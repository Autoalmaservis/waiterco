"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, User, LogOut, ChevronRight, UtensilsCrossed,
  Clock, CheckCircle2, Loader2, Save,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { createAdminClient } from "@/lib/supabase/server"

type OrderRow = {
  id: string; order_number: string; status: string
  total_amount: number; created_at: string; venueName: string
}
type Props = {
  user: { id: string; email: string; fullName: string | null }
  orders: OrderRow[]
}

const statusLabel: Record<string, string> = {
  pending: "Prijaté", confirmed: "Potvrdené", preparing: "Pripravuje sa",
  ready: "Pripravené", delivered: "Doručené", cancelled: "Zrušené",
}
const statusColor: Record<string, string> = {
  pending: "#9ca3af", confirmed: "#3b82f6", preparing: "#f97316",
  ready: "#22c55e", delivered: "#16a34a", cancelled: "#ef4444",
}

export default function ProfileClient({ user, orders }: Props) {
  const router = useRouter()
  const [name, setName] = useState(user.fullName ?? "")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [isLoggingOut, startLogout] = useTransition()

  async function handleSaveName() {
    if (!name.trim()) return
    setSaveState("saving")
    const supabase = createClient()
    await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    // Update profile via fetch (can't call server action from client for admin client)
    await fetch("/api/customer/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name.trim() }),
    })
    setSaveState("saved")
    setTimeout(() => setSaveState("idle"), 2000)
  }

  function handleSignOut() {
    startLogout(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/restaurants")
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1E2D4A] px-4 pt-10 pb-8">
        <div className="max-w-lg mx-auto">
          <Link href="/restaurants" className="flex items-center gap-2 text-white/60 text-sm mb-5 hover:text-white/80 transition-colors">
            <ArrowLeft size={16} />Späť na reštaurácie
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E85B1A] flex items-center justify-center shrink-0">
              <User size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">
                {user.fullName ?? "Môj profil"}
              </h1>
              <p className="text-white/60 text-sm">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Profile form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Osobné údaje</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meno</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tvoje meno"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E85B1A]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                value={user.email}
                disabled
                className="w-full text-sm border border-gray-100 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-400"
              />
            </div>
            <button
              onClick={handleSaveName}
              disabled={saveState === "saving" || !name.trim() || name.trim() === (user.fullName ?? "")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: "#E85B1A" }}
            >
              {saveState === "saving" ? (
                <><Loader2 size={14} className="animate-spin" />Ukladám…</>
              ) : saveState === "saved" ? (
                <><CheckCircle2 size={14} />Uložené</>
              ) : (
                <><Save size={14} />Uložiť</>
              )}
            </button>
          </div>
        </div>

        {/* Order history */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">História objednávok</h2>
          </div>
          {orders.length === 0 ? (
            <div className="text-center py-10">
              <UtensilsCrossed size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Zatiaľ žiadne objednávky</p>
              <Link href="/restaurants" className="text-xs text-[#E85B1A] font-medium mt-2 block hover:underline">
                Objednaj niečo →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map(order => (
                <div key={order.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{order.venueName}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(order.created_at).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
                      <span className="text-gray-200">·</span>
                      č. {order.order_number}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount, "EUR")}</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: statusColor[order.status] ?? "#6b7280" }}>
                      {statusLabel[order.status] ?? order.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <Link href="/restaurants" className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50">
            <UtensilsCrossed size={18} className="text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700 flex-1">Prehliadať reštaurácie</span>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-red-100 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          Odhlásiť sa
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">eWaiter · Zákaznícky účet</p>
      </div>
    </div>
  )
}
