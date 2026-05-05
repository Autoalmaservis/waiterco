"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Clock, Coffee, Loader2, Receipt, UtensilsCrossed } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { getSessionOrders, type TrackingOrder } from "@/app/(menu)/menu/[token]/actions"
import { createAdminClient } from "@/lib/supabase/server"

// This is a client page that fetches data via server action polling
export default function ShareOrderPage() {
  const params = useParams()
  const shareToken = params?.shareToken as string

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [venueName, setVenueName] = useState<string>("")
  const [tableName, setTableName] = useState<string>("")
  const [currency, setCurrency] = useState("EUR")
  const [brandColor, setBrandColor] = useState("#E85B1A")
  const [orders, setOrders] = useState<TrackingOrder[]>([])
  const [sessionStatus, setSessionStatus] = useState("active")
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shareToken) return

    async function init() {
      try {
        const res = await fetch(`/api/share-order/${shareToken}`)
        if (!res.ok) { setError("Objednávka nebola nájdená."); setLoading(false); return }
        const data = await res.json()
        setSessionId(data.sessionId)
        setVenueName(data.venueName)
        setTableName(data.tableName)
        setCurrency(data.currency)
        setBrandColor(data.primaryColor ?? "#E85B1A")
        setOrders(data.orders)
        setSessionStatus(data.sessionStatus)
        setGrandTotal(data.grandTotal)
      } catch {
        setError("Nastala chyba. Skúste obnoviť stránku.")
      }
      setLoading(false)
    }
    init()
  }, [shareToken])

  useEffect(() => {
    if (!sessionId) return
    const poll = async () => {
      const result = await getSessionOrders(sessionId)
      setOrders(result.orders)
      setSessionStatus(result.sessionStatus)
      setGrandTotal(result.grandTotal)
    }
    const interval = setInterval(poll, 10000)
    return () => clearInterval(interval)
  }, [sessionId])

  function itemStatusColor(status: string) {
    const c: Record<string, string> = { pending: "#9ca3af", confirmed: "#3b82f6", preparing: "#f97316", ready: "#22c55e", delivered: "#16a34a", cancelled: "#ef4444" }
    return c[status] ?? "#9ca3af"
  }
  function statusLabel(status: string) {
    const m: Record<string, string> = { pending: "Prijaté", confirmed: "Potvrdené", preparing: "Pripravuje sa", ready: "Pripravené", delivered: "Doručené", cancelled: "Zrušené" }
    return m[status] ?? status
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <Receipt size={40} className="text-gray-300 mb-3" />
        <h1 className="font-bold text-gray-900 text-xl mb-2">Objednávka nenájdená</h1>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <Link href="/restaurants" className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: brandColor }}>
          Prehľadať reštaurácie
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: brandColor }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Coffee size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-sm truncate">{venueName}</h1>
            <p className="text-white/70 text-xs">Stôl: {tableName} · Zdieľaná objednávka</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        {sessionStatus === "closed" ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            <p className="text-green-800 text-sm font-semibold">Relácia ukončená</p>
          </div>
        ) : orders.length > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}40` }}>
            <Loader2 size={16} style={{ color: brandColor }} className="animate-spin shrink-0" />
            <p className="text-sm font-medium" style={{ color: brandColor }}>Objednávka sa spracováva…</p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <UtensilsCrossed size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-500">Zatiaľ žiadne objednávky</p>
          </div>
        ) : (
          <>
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
                  <span className="font-bold text-gray-900 text-sm">Objednávka č. {order.order_number}</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: itemStatusColor(order.status), backgroundColor: `${itemStatusColor(order.status)}18` }}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="px-4 py-2.5 space-y-2">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-start gap-2">
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.status === "preparing" ? "animate-pulse" : ""}`}
                        style={{ backgroundColor: itemStatusColor(item.status) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{item.name} ×{item.quantity}</p>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-gray-400">{item.modifiers.map(m => m.name).join(", ")}</p>
                        )}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: itemStatusColor(item.status) }}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(order.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount, currency)}</span>
                </div>
              </div>
            ))}
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">Spolu</span>
              <span className="font-black text-lg" style={{ color: brandColor }}>{formatCurrency(grandTotal, currency)}</span>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Stránka sa aktualizuje automaticky každých 10 sekúnd.
        </p>
      </div>
    </div>
  )
}
