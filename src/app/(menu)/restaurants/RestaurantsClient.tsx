"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, MapPin, Coffee, UtensilsCrossed, Wine, User, ChevronRight,
  QrCode, X, Camera, Smartphone, ScanLine, ArrowLeft, Bike,
} from "lucide-react"
import type { VenueCard } from "./page"

const typeLabel: Record<string, string> = {
  restaurant: "Reštaurácia", bar: "Bar", cafe: "Kaviareň", hotel: "Hotel",
}
const typeIcon: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed, bar: Wine, cafe: Coffee, hotel: Coffee,
}

type HomeView = "home" | "search" | "delivery"

export default function RestaurantsClient({
  venues, isLoggedIn, customerName,
}: {
  venues: VenueCard[]
  isLoggedIn: boolean
  customerName: string | null
}) {
  const [view, setView] = useState<HomeView>("home")
  const [search, setSearch] = useState("")
  const [scannerOpen, setScannerOpen] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)

  function openSearch(mode: HomeView) {
    setView(mode)
    setTimeout(() => searchInputRef.current?.focus(), 80)
  }

  function closeSearch() {
    setView("home")
    setSearch("")
  }

  const filtered = venues.filter(v => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      (v.city ?? "").toLowerCase().includes(q) ||
      (v.address ?? "").toLowerCase().includes(q) ||
      typeLabel[v.type]?.toLowerCase().includes(q)
    )
  })

  // ── Search / delivery venue list ─────────────────────────────────────────
  if (view === "search" || view === "delivery") {
    const isDelivery = view === "delivery"
    const accent = isDelivery ? "#2BB58C" : "#2563EB"
    const focusRing = isDelivery ? "focus:ring-[#2BB58C]" : "focus:ring-[#2563EB]"
    const label = isDelivery ? "Donáška jedla" : "Vyhľadať reštauráciu"
    const Icon = isDelivery ? Bike : Search

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 pt-10 pb-4" style={{ backgroundColor: accent }}>
          <div className="max-w-lg mx-auto">
            <button
              onClick={closeSearch}
              className="flex items-center gap-2 text-white/70 text-sm mb-4 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              Späť
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Icon size={18} className="text-white" />
              </div>
              <h1 className="text-white font-bold text-xl">{label}</h1>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Vyhľadať reštauráciu alebo mesto…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 ${focusRing} shadow-sm border-0`}
              />
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
          {search.trim() && (
            <p className="text-xs text-gray-400 px-1">
              {filtered.length === 0 ? "Žiadne výsledky" : `${filtered.length} reštaurácií`}
            </p>
          )}
          {filtered.length === 0 && search.trim() ? (
            <div className="text-center py-16">
              <UtensilsCrossed size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-500">Žiadne výsledky</p>
              <p className="text-xs text-gray-400 mt-1">Skúste iný názov alebo mesto</p>
            </div>
          ) : (
            filtered.map(venue => (
              <VenueCardItem
                key={venue.id}
                venue={venue}
                deliveryMode={isDelivery}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Home — 3 tiles ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0F1A2E" }}>

      {/* Top bar: logo + account */}
      <div className="flex items-center justify-between px-5 pt-12 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E85B1A] flex items-center justify-center">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">eWaiter</span>
        </div>

        {isLoggedIn ? (
          <Link href="/app/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors">
            <User size={14} className="text-white" />
            <span className="text-white text-xs font-medium">{customerName ?? "Účet"}</span>
          </Link>
        ) : (
          <Link href="/login"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors">
            <User size={14} className="text-white" />
            <span className="text-white text-xs font-medium">Prihlásiť</span>
          </Link>
        )}
      </div>

      {/* Tiles */}
      <div className="flex-1 flex flex-col px-4 gap-3 pb-8">

        {/* ── QR Scan — large primary tile ── */}
        <button
          onClick={() => setScannerOpen(true)}
          className="flex-[3] min-h-0 w-full rounded-3xl flex flex-col items-center justify-center gap-4 p-6 active:scale-[0.98] transition-transform relative overflow-hidden"
          style={{ backgroundColor: "#E85B1A" }}
        >
          {/* Background radial glow */}
          <div className="absolute inset-0 opacity-20"
            style={{ background: "radial-gradient(circle at 50% 40%, #fff 0%, transparent 70%)" }} />
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center relative z-10">
            <QrCode size={44} className="text-white" />
          </div>
          <div className="text-center relative z-10">
            <p className="text-white font-bold text-xl leading-tight">Naskenovať QR kód</p>
            <p className="text-white/70 text-sm mt-1">Objednaj zo stola · Zavolaj čašníka</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/20 px-4 py-2 rounded-full relative z-10">
            <ScanLine size={14} className="text-white" />
            <span className="text-white text-xs font-semibold">Otvoriť kameru</span>
          </div>
        </button>

        {/* ── Bottom two tiles ── */}
        <div className="flex gap-3" style={{ flex: "2" }}>

          {/* Delivery */}
          <button
            onClick={() => openSearch("delivery")}
            className="flex-1 rounded-3xl flex flex-col items-center justify-center gap-3 p-5 active:scale-[0.98] transition-transform relative overflow-hidden"
            style={{ backgroundColor: "#2BB58C" }}
          >
            <div className="absolute inset-0 opacity-15"
              style={{ background: "radial-gradient(circle at 50% 30%, #fff 0%, transparent 70%)" }} />
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center relative z-10">
              <Bike size={30} className="text-white" />
            </div>
            <div className="text-center relative z-10">
              <p className="text-white font-bold text-base leading-tight">Donáška</p>
              <p className="text-white/70 text-xs mt-0.5">jedla domov</p>
            </div>
          </button>

          {/* Find restaurant */}
          <button
            onClick={() => openSearch("search")}
            className="flex-1 rounded-3xl flex flex-col items-center justify-center gap-3 p-5 active:scale-[0.98] transition-transform relative overflow-hidden"
            style={{ backgroundColor: "#2563EB" }}
          >
            <div className="absolute inset-0 opacity-15"
              style={{ background: "radial-gradient(circle at 50% 30%, #fff 0%, transparent 70%)" }} />
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center relative z-10">
              <Search size={28} className="text-white" />
            </div>
            <div className="text-center relative z-10">
              <p className="text-white font-bold text-base leading-tight">Nájsť</p>
              <p className="text-white/70 text-xs mt-0.5">reštauráciu</p>
            </div>
          </button>

        </div>
      </div>

      {scannerOpen && <QRScannerModal onClose={() => setScannerOpen(false)} />}
    </div>
  )
}

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────
function QRScannerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [mode, setMode] = useState<"loading" | "scanning" | "ios" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => { return () => stopCamera() }, [stopCamera])

  useEffect(() => {
    async function start() {
      const hasBarcodeDetector = "BarcodeDetector" in window
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

      if (isIOS || !hasBarcodeDetector) { setMode("ios"); return }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setMode("scanning")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
        const scan = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            rafRef.current = requestAnimationFrame(scan); return
          }
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const raw = barcodes[0].rawValue as string
              stopCamera(); onClose()
              try {
                const url = new URL(raw)
                if (url.pathname.startsWith("/menu/")) router.push(url.pathname)
                else window.location.href = raw
              } catch { window.location.href = raw }
              return
            }
          } catch { /* ignore frame errors */ }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : ""
        setErrorMsg(
          msg.includes("Permission") || msg.includes("denied")
            ? "Prístup ku kamere bol zamietnutý. Povoľ kameru v nastaveniach prehliadača."
            : "Kameru sa nepodarilo spustiť."
        )
        setMode("error")
      }
    }
    start()
  }, [router, stopCamera, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <h2 className="text-white font-bold text-lg">Skenovať QR kód</h2>
        <button onClick={() => { stopCamera(); onClose() }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {mode === "loading" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Camera size={28} className="text-white" />
            </div>
            <p className="text-white/70 text-sm">Spúšťam kameru…</p>
          </div>
        )}

        {mode === "scanning" && (
          <div className="w-full max-w-sm">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 relative">
                  {[
                    "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
                    "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                    "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
                    "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-8 h-8 border-[#E85B1A] ${cls}`} />
                  ))}
                  <div className="absolute inset-x-0 h-0.5 bg-[#E85B1A] opacity-80 animate-[scanline_2s_ease-in-out_infinite]"
                    style={{ top: "50%", boxShadow: "0 0 8px #E85B1A" }} />
                </div>
              </div>
            </div>
            <p className="text-white/60 text-sm text-center mt-4">
              Nasmeruj kameru na QR kód na stole
            </p>
          </div>
        )}

        {mode === "ios" && (
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <Smartphone size={36} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Použi kameru telefónu</h3>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Otvor aplikáciu <strong className="text-white">Kamera</strong> na tvojom iPhone,
              namier ju na QR kód na stole a klepni na notifikáciu.
            </p>
            <div className="bg-white/10 rounded-2xl p-4 text-left space-y-3">
              {[
                { n: "1", t: "Otvor aplikáciu Kamera" },
                { n: "2", t: "Namiesti na QR kód na stole" },
                { n: "3", t: "Klepni na odkaz ktorý sa zobrazí" },
              ].map(s => (
                <div key={s.n} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#E85B1A] flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">{s.n}</span>
                  </div>
                  <span className="text-white/80 text-sm">{s.t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "error" && (
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Camera size={28} className="text-red-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Kamera nie je dostupná</h3>
            <p className="text-white/60 text-sm">{errorMsg}</p>
          </div>
        )}
      </div>

      <div className="px-6 pb-10 pt-4 shrink-0">
        <button onClick={() => { stopCamera(); onClose() }}
          className="w-full py-3.5 rounded-2xl border border-white/20 text-white font-semibold text-sm">
          Zatvoriť
        </button>
      </div>
    </div>
  )
}

// ─── Venue card ───────────────────────────────────────────────────────────────
function VenueCardItem({ venue, deliveryMode }: { venue: VenueCard; deliveryMode?: boolean }) {
  const Icon = typeIcon[venue.type] ?? Coffee
  const brand = venue.primary_color ?? "#E85B1A"
  const href = deliveryMode ? `/venue/${venue.slug}?mode=delivery` : `/venue/${venue.slug}`

  return (
    <Link href={href} className="block group">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        {venue.cover_image_url ? (
          <div className="h-36 overflow-hidden relative">
            <img src={venue.cover_image_url} alt={venue.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold ${venue.is_open ? "bg-green-500 text-white" : "bg-gray-700 text-gray-200"}`}>
              {venue.is_open ? "Otvorené" : "Zatvorené"}
            </div>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center relative" style={{ backgroundColor: `${brand}12` }}>
            <Icon size={32} style={{ color: brand }} className="opacity-30" />
            <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold ${venue.is_open ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
              {venue.is_open ? "Otvorené" : "Zatvorené"}
            </div>
          </div>
        )}
        <div className="p-4 flex items-start gap-3">
          {venue.logo_url ? (
            <img src={venue.logo_url} alt={venue.name}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-gray-100 -mt-7 bg-white shadow-sm" />
          ) : (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 -mt-7 bg-white shadow-sm" style={{ color: brand }}>
              <Icon size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{venue.name}</h3>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400">{typeLabel[venue.type] ?? venue.type}</span>
              {venue.city && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <MapPin size={10} className="shrink-0" />{venue.city}
                  </span>
                </>
              )}
            </div>
            {venue.description && (
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{venue.description}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
