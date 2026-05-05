"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Fuse from "fuse.js"
import {
  Search, MapPin, Coffee, UtensilsCrossed, Wine, User, ChevronRight,
  QrCode, X, Camera, Smartphone, ScanLine, ArrowLeft, Bike,
  Map as MapIcon, List, Star, Utensils,
} from "lucide-react"
import type { VenueCard } from "./page"

const typeLabel: Record<string, string> = {
  restaurant: "Reštaurácia", bar: "Bar", cafe: "Kaviareň", hotel: "Hotel",
}
const typeIcon: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed, bar: Wine, cafe: Coffee, hotel: Coffee,
}

type HomeView = "home" | "search" | "delivery"
type VenueResult = { venue: VenueCard; matchedItem?: string }
type ItemEntry = { venueId: string; name: string; description: string | null }

export default function RestaurantsClient({
  venues, isLoggedIn, customerName,
}: {
  venues: VenueCard[]
  isLoggedIn: boolean
  customerName: string | null
}) {
  const [view, setView] = useState<HomeView>("home")
  const [search, setSearch] = useState("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [mapMode, setMapMode] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fuse instance for venues
  const venueFuse = useMemo(() => new Fuse(venues, {
    keys: [
      { name: "name", weight: 3 },
      { name: "city", weight: 1.5 },
      { name: "address", weight: 1 },
      { name: "description", weight: 0.5 },
    ],
    threshold: 0.4,
    includeScore: true,
  }), [venues])

  // Flat menu items list for item-level search
  const allItems: ItemEntry[] = useMemo(() =>
    venues.flatMap(v => v.menu_items.map(i => ({ venueId: v.id, name: i.name, description: i.description }))),
    [venues]
  )
  const itemFuse = useMemo(() => new Fuse(allItems, {
    keys: [
      { name: "name", weight: 2 },
      { name: "description", weight: 1 },
    ],
    threshold: 0.4,
    includeScore: true,
  }), [allItems])

  const results: VenueResult[] = useMemo(() => {
    const q = search.trim()
    if (!q) {
      return venues
        .slice()
        .sort((a, b) => {
          const ar = a.avg_rating ?? 0
          const br = b.avg_rating ?? 0
          if (br !== ar) return br - ar
          return b.review_count - a.review_count
        })
        .map(v => ({ venue: v }))
    }

    const venueMap = new Map<string, VenueResult>()

    // Fuzzy-match venues by name/city/address
    for (const r of venueFuse.search(q)) {
      venueMap.set(r.item.id, { venue: r.item })
    }

    // Also match by type label (exact substring)
    const ql = q.toLowerCase()
    for (const [type, label] of Object.entries(typeLabel)) {
      if (label.toLowerCase().includes(ql) || type.includes(ql)) {
        for (const v of venues) {
          if (v.type === type && !venueMap.has(v.id)) {
            venueMap.set(v.id, { venue: v })
          }
        }
      }
    }

    // Fuzzy-match individual menu items
    for (const r of itemFuse.search(q)) {
      const { venueId, name } = r.item
      if (!venueMap.has(venueId)) {
        const venue = venues.find(v => v.id === venueId)
        if (venue) venueMap.set(venueId, { venue, matchedItem: name })
      } else {
        // Annotate existing entry with matched item if not already set
        const existing = venueMap.get(venueId)!
        if (!existing.matchedItem) {
          venueMap.set(venueId, { ...existing, matchedItem: name })
        }
      }
    }

    return Array.from(venueMap.values()).sort((a, b) =>
      (b.venue.avg_rating ?? 0) - (a.venue.avg_rating ?? 0)
    )
  }, [search, venues, venueFuse, itemFuse])

  function openSearch(mode: HomeView) {
    setView(mode)
    setMapMode(false)
    setTimeout(() => searchInputRef.current?.focus(), 80)
  }

  function closeSearch() {
    setView("home")
    setSearch("")
    setMapMode(false)
  }

  // ── Search / delivery venue list ─────────────────────────────────────────
  if (view === "search" || view === "delivery") {
    const isDelivery = view === "delivery"
    const accent = isDelivery ? "#2BB58C" : "#2563EB"
    const focusRing = isDelivery ? "focus:ring-[#2BB58C]" : "focus:ring-[#2563EB]"
    const label = isDelivery ? "Donáška jedla" : "Vyhľadať reštauráciu"
    const Icon = isDelivery ? Bike : Search
    const hasSearch = search.trim().length > 0

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
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
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-white" />
              </div>
              <h1 className="text-white font-bold text-xl flex-1">{label}</h1>
              {/* Map / list toggle */}
              <button
                onClick={() => setMapMode(m => !m)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${mapMode ? "bg-white" : "bg-white/20"}`}
              >
                {mapMode
                  ? <List size={18} className="text-gray-700" />
                  : <MapIcon size={18} className="text-white" />
                }
              </button>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Reštaurácia, jedlo, ulica…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full pl-10 pr-9 py-3 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 ${focusRing} shadow-sm border-0`}
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-lg mx-auto px-4 py-4">
          {hasSearch && (
            <p className="text-xs text-gray-400 px-1 mb-3">
              {results.length === 0 ? "Žiadne výsledky" : `${results.length} reštaurácií`}
            </p>
          )}

          {results.length === 0 && hasSearch ? (
            <div className="text-center py-16">
              <UtensilsCrossed size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-500">Žiadne výsledky</p>
              <p className="text-xs text-gray-400 mt-1">Skúste iný názov, jedlo alebo adresu</p>
            </div>
          ) : mapMode ? (
            <div className="space-y-2">
              {results.map(({ venue }) => (
                <MapVenueCard key={venue.id} venue={venue} deliveryMode={isDelivery} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(({ venue, matchedItem }) => (
                <VenueCardItem key={venue.id} venue={venue} deliveryMode={isDelivery} matchedItem={matchedItem} />
              ))}
            </div>
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

  const streamPendingRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function start() {
      const hasBarcodeDetector = "BarcodeDetector" in window
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

      if (isIOS || !hasBarcodeDetector) { setMode("ios"); return }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        })
        streamRef.current = stream
        streamPendingRef.current = stream
        setMode("scanning")
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
  }, [])

  useEffect(() => {
    if (mode !== "scanning" || !videoRef.current || !streamPendingRef.current) return
    const video = videoRef.current
    const stream = streamPendingRef.current
    streamPendingRef.current = null

    video.srcObject = stream
    video.play().catch(() => {})

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
    const scan = async () => {
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan); return
      }
      try {
        const barcodes = await detector.detect(video)
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
  }, [mode, router, stopCamera, onClose])

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

// ─── Star rating display ──────────────────────────────────────────────────────
function StarRating({ avg, count }: { avg: number; count: number }) {
  const full = Math.floor(avg)
  const half = avg - full >= 0.5
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            size={11}
            fill={i <= full ? "#f59e0b" : i === full + 1 && half ? "#f59e0b" : "none"}
            stroke={i <= full || (i === full + 1 && half) ? "#f59e0b" : "#d1d5db"}
            className={i === full + 1 && half ? "opacity-60" : ""}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-400 font-medium">{avg.toFixed(1)} ({count})</span>
    </div>
  )
}

// ─── Venue card (list mode) ───────────────────────────────────────────────────
function VenueCardItem({ venue, deliveryMode, matchedItem }: {
  venue: VenueCard; deliveryMode?: boolean; matchedItem?: string
}) {
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
            {/* Rating */}
            {venue.avg_rating !== null && venue.review_count > 0 && (
              <div className="mt-1">
                <StarRating avg={venue.avg_rating} count={venue.review_count} />
              </div>
            )}
            {/* Matched food item badge */}
            {matchedItem && (
              <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200">
                <Utensils size={9} className="text-orange-500 shrink-0" />
                <span className="text-[10px] text-orange-600 font-medium">{matchedItem}</span>
              </div>
            )}
            {!matchedItem && venue.description && (
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-1 leading-relaxed">{venue.description}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Venue card (map mode) ────────────────────────────────────────────────────
function MapVenueCard({ venue, deliveryMode }: { venue: VenueCard; deliveryMode?: boolean }) {
  const Icon = typeIcon[venue.type] ?? Coffee
  const brand = venue.primary_color ?? "#E85B1A"
  const href = deliveryMode ? `/venue/${venue.slug}?mode=delivery` : `/venue/${venue.slug}`
  const mapsQuery = [venue.name, venue.address, venue.city].filter(Boolean).join(", ")
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        {venue.logo_url ? (
          <img src={venue.logo_url} alt={venue.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brand}18`, color: brand }}>
            <Icon size={20} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{venue.name}</p>
          {(venue.address || venue.city) && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-start gap-1 leading-snug">
              <MapPin size={10} className="shrink-0 mt-0.5" />
              <span className="truncate">{[venue.address, venue.city].filter(Boolean).join(", ")}</span>
            </p>
          )}
          {venue.avg_rating !== null && venue.review_count > 0 && (
            <div className="mt-0.5">
              <StarRating avg={venue.avg_rating} count={venue.review_count} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Link href={href}
            className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold text-center"
            style={{ backgroundColor: brand }}>
            Otvoriť
          </Link>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 text-center">
            Mapa
          </a>
        </div>
      </div>
    </div>
  )
}
