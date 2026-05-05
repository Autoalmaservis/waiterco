"use client"

import { useState, useRef, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  MousePointer2, Plus, LayoutGrid, Trash2, Save, Check,
  Download, Square, Circle, RectangleHorizontal, X,
} from "lucide-react"
import type { DBTable, VenueZone } from "@/types/database"
import {
  createFloorTable, updateFloorTable, deleteTable,
  createFloorZone, updateFloorZone, deleteZone,
  savePositions,
} from "./actions"

// ── Types ─────────────────────────────────────────────────────────────────────

type FTable = DBTable & { x_pos: number; y_pos: number; shape: string }
type FZone  = VenueZone & { x_pos: number; y_pos: number; w: number; h: number; color: string }
type Tool   = "select" | "add-table" | "add-zone"
type TableDrag = {
  kind: "table" | "zone" | "resize"
  id: string; startX: number; startY: number
  ox: number; oy: number; ow?: number; oh?: number
  // for zone drag: tables that were inside the zone at drag-start
  zoneTables?: { id: string; ox: number; oy: number }[]
}
type CanvasDrag = { startX: number; startY: number; startW: number; startH: number }

// ── Constants / Helpers ───────────────────────────────────────────────────────

const DEFAULT_W = 900, DEFAULT_H = 580

const COLORS = [
  { hex: "#F3F4F6", label: "Sivá" },
  { hex: "#FEF3C7", label: "Žltá" },
  { hex: "#DBEAFE", label: "Modrá" },
  { hex: "#D1FAE5", label: "Zelená" },
  { hex: "#FCE7F3", label: "Ružová" },
  { hex: "#EDE9FE", label: "Fialová" },
  { hex: "#FFE4E6", label: "Červená" },
]

function tableDims(shape: string) {
  return shape === "rect" ? { w: 90, h: 55 } : { w: 60, h: 60 }
}

function svgPt(e: React.PointerEvent, svg: SVGSVGElement) {
  const p = svg.createSVGPoint()
  p.x = e.clientX; p.y = e.clientY
  return p.matrixTransform(svg.getScreenCTM()!.inverse())
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function tempId() { return `temp-${Date.now()}-${Math.random()}` }

function tableInZone(t: FTable, z: FZone) {
  const { w: tw, h: th } = tableDims(t.shape)
  const cx = t.x_pos + tw / 2, cy = t.y_pos + th / 2
  return cx >= z.x_pos && cx <= z.x_pos + z.w && cy >= z.y_pos && cy <= z.y_pos + z.h
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TablePanel({ table, venueId, onUpdate, onDelete, isPending, startT }: {
  table: FTable; venueId: string
  onUpdate: (u: Partial<FTable>) => void
  onDelete: () => void
  isPending: boolean
  startT: (fn: () => Promise<void>) => void
}) {
  const qrUrl = typeof window !== "undefined"
    ? `${window.location.origin}/menu/${table.qr_token}`
    : `/menu/${table.qr_token}`
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=1e2d4a`

  const save = (updates: Partial<FTable>) => {
    onUpdate(updates)
    if (!table.id.startsWith("temp-")) {
      startT(async () => { await updateFloorTable(table.id, updates) })
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Stôl</h3>
        <button onClick={onDelete} disabled={isPending}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Názov</label>
        <input
          defaultValue={table.name} key={table.id + "-name"}
          onBlur={e => { if (e.target.value !== table.name) save({ name: e.target.value }) }}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Stoličky</label>
        <input
          type="number" min={1} max={20}
          defaultValue={table.capacity ?? ""} key={table.id + "-cap"}
          onBlur={e => {
            const v = e.target.value ? Number(e.target.value) : null
            if (v !== table.capacity) save({ capacity: v })
          }}
          placeholder="–"
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Tvar</label>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            ["square", Square, "Štvorec"],
            ["rect",   RectangleHorizontal, "Obdĺžnik"],
            ["round",  Circle, "Kruh"],
          ] as const).map(([s, Icon, label]) => (
            <button key={s} onClick={() => save({ shape: s })}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${table.shape === s ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <Icon size={14} /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {!table.id.startsWith("temp-") && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-600 mb-2">QR kód</p>
          <div className="flex justify-center bg-gray-50 rounded-xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImg} alt="QR kód" width={160} height={160} className="rounded-lg" />
          </div>
          <p className="text-xs text-gray-400 mt-2 break-all text-center">{qrUrl}</p>
          <a href={qrImg} download={`qr-${table.name}.png`} target="_blank" rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={14} />Stiahnuť QR
          </a>
        </div>
      )}
    </div>
  )
}

function ZonePanel({ zone, onUpdate, onDelete, isPending, startT }: {
  zone: FZone
  onUpdate: (u: Partial<FZone>) => void
  onDelete: () => void
  isPending: boolean
  startT: (fn: () => Promise<void>) => void
}) {
  const save = (updates: Partial<FZone>) => {
    onUpdate(updates)
    if (!zone.id.startsWith("temp-")) {
      startT(async () => { await updateFloorZone(zone.id, updates) })
    }
  }
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Zóna</h3>
        <button onClick={onDelete} disabled={isPending}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Názov</label>
        <input
          defaultValue={zone.name} key={zone.id + "-name"}
          onBlur={e => { if (e.target.value !== zone.name) save({ name: e.target.value }) }}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Farba</label>
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map(c => (
            <button key={c.hex} onClick={() => save({ color: c.hex })} title={c.label}
              className={`h-8 rounded-lg border-2 transition-all ${zone.color === c.hex ? "border-gray-700 scale-105" : "border-transparent hover:border-gray-300"}`}
              style={{ backgroundColor: c.hex }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  tables: FTable[]
  zones: FZone[]
  venueId: string
  venues: { id: string; name: string }[]
  selectedVenueId: string
}

export default function FloorPlanEditor({ tables: initT, zones: initZ, venueId, venues, selectedVenueId }: Props) {
  const router = useRouter()
  const svgRef        = useRef<SVGSVGElement>(null)
  const dragRef       = useRef<TableDrag | null>(null)
  const canvasDragRef = useRef<CanvasDrag | null>(null)
  const [isPending, startT] = useTransition()

  const [tables, setTables] = useState(() =>
    initT.map((t, i) => ({
      ...t,
      x_pos: t.x_pos ?? (i % 8) * 80 + 20,
      y_pos: t.y_pos ?? Math.floor(i / 8) * 80 + 20,
      shape: t.shape ?? "square",
    }))
  )
  const [zones, setZones] = useState(() =>
    initZ.map(z => ({
      ...z,
      x_pos: z.x_pos ?? 20, y_pos: z.y_pos ?? 20,
      w: z.w ?? 160, h: z.h ?? 120,
      color: z.color ?? "#F3F4F6",
    }))
  )

  const [tool,        setTool]        = useState<Tool>("select")
  const [sel,         setSel]         = useState<{ id: string; type: "table" | "zone" } | null>(null)
  const [drawRect,    setDrawRect]    = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [zoneColor,   setZoneColor]   = useState(COLORS[0].hex)
  const [saveState,   setSaveState]   = useState<"idle" | "saved">("idle")
  const [error,       setError]       = useState<string | null>(null)
  const [filterZone,  setFilterZone]  = useState<string | null>(null)
  const [canvasW,     setCanvasW]     = useState(DEFAULT_W)
  const [canvasH,     setCanvasH]     = useState(DEFAULT_H)

  // Persist canvas size per venue
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`fp-canvas-${venueId}`)
      if (raw) { const { w, h } = JSON.parse(raw); setCanvasW(w); setCanvasH(h) }
    } catch {}
  }, [venueId])

  const saveCanvasSize = (w: number, h: number) => {
    try { localStorage.setItem(`fp-canvas-${venueId}`, JSON.stringify({ w, h })) } catch {}
  }

  const selTable = sel?.type === "table" ? tables.find(t => t.id === sel.id) ?? null : null
  const selZone  = sel?.type === "zone"  ? zones.find(z => z.id === sel.id)  ?? null : null

  // ── Canvas resize (DOM-level, outside SVG) ───────────────────────────────────

  const onCanvasResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    canvasDragRef.current = { startX: e.clientX, startY: e.clientY, startW: canvasW, startH: canvasH }
  }
  const onCanvasResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = canvasDragRef.current
    if (!d) return
    const newW = Math.max(400, d.startW + (e.clientX - d.startX))
    const newH = Math.max(300, d.startH + (e.clientY - d.startY))
    setCanvasW(newW)
    setCanvasH(newH)
  }
  const onCanvasResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = canvasDragRef.current
    if (!d) return
    const newW = Math.max(400, d.startW + (e.clientX - d.startX))
    const newH = Math.max(300, d.startH + (e.clientY - d.startY))
    saveCanvasSize(newW, newH)
    canvasDragRef.current = null
  }

  // ── SVG events ───────────────────────────────────────────────────────────────

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const { x, y } = svgPt(e, svgRef.current)

    if (tool === "add-table") {
      const { w: tw, h: th } = tableDims("square")
      const nx = clamp(Math.round(x - tw / 2), 0, canvasW - tw)
      const ny = clamp(Math.round(y - th / 2), 0, canvasH - th)
      const name = `Stôl ${tables.filter(t => !t.id.startsWith("temp-")).length + 1}`
      const tid = tempId()
      const optimistic: FTable = {
        id: tid, venue_id: venueId, zone_id: null,
        name, capacity: null, qr_token: tid,
        is_active: true, x_pos: nx, y_pos: ny, shape: "square",
        created_at: new Date().toISOString(),
      }
      setTables(p => [...p, optimistic])
      setSel({ id: tid, type: "table" })
      startT(async () => {
        const res = await createFloorTable(venueId, name, nx, ny)
        if ("error" in res) {
          setTables(p => p.filter(t => t.id !== tid))
          setError(res.error)
        } else {
          setTables(p => p.map(t => t.id === tid ? { ...t, ...(res.table as FTable) } : t))
          setSel({ id: res.table.id, type: "table" })
        }
      })
      setTool("select")
      return
    }

    if (tool === "add-zone") {
      svgRef.current.setPointerCapture(e.pointerId)
      setDrawRect({ x1: x, y1: y, x2: x, y2: y })
      return
    }

    setSel(null)
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const { x, y } = svgPt(e, svgRef.current)

    if (tool === "add-zone" && drawRect) {
      setDrawRect(p => p ? { ...p, x2: x, y2: y } : null)
      return
    }

    const d = dragRef.current
    if (!d) return
    const dx = x - d.startX, dy = y - d.startY

    if (d.kind === "table") {
      const tbl = tables.find(t => t.id === d.id)
      const { w: tw, h: th } = tableDims(tbl?.shape ?? "square")
      setTables(p => p.map(t => t.id !== d.id ? t : {
        ...t,
        x_pos: clamp(d.ox + dx, 0, canvasW - tw),
        y_pos: clamp(d.oy + dy, 0, canvasH - th),
      }))
    } else if (d.kind === "zone") {
      const newX = clamp(d.ox + dx, 0, canvasW - (d.ow ?? 100))
      const newY = clamp(d.oy + dy, 0, canvasH - (d.oh ?? 80))
      const actualDx = newX - d.ox
      const actualDy = newY - d.oy
      setZones(p => p.map(z => z.id !== d.id ? z : { ...z, x_pos: newX, y_pos: newY }))
      if (d.zoneTables?.length) {
        setTables(p => p.map(t => {
          const zt = d.zoneTables!.find(zt => zt.id === t.id)
          return zt ? { ...t, x_pos: zt.ox + actualDx, y_pos: zt.oy + actualDy } : t
        }))
      }
    } else if (d.kind === "resize") {
      setZones(p => p.map(z => z.id !== d.id ? z : {
        ...z,
        w: Math.max(70, d.ow! + dx),
        h: Math.max(50, d.oh! + dy),
      }))
    }
  }

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return

    if (drawRect) {
      const x1 = Math.min(drawRect.x1, drawRect.x2)
      const y1 = Math.min(drawRect.y1, drawRect.y2)
      const w  = Math.abs(drawRect.x2 - drawRect.x1)
      const h  = Math.abs(drawRect.y2 - drawRect.y1)
      setDrawRect(null)
      setTool("select")

      if (w > 30 && h > 30) {
        const zname = `Zóna ${zones.filter(z => !z.id.startsWith("temp-")).length + 1}`
        const tid = tempId()
        const optimistic: FZone = {
          id: tid, venue_id: venueId, name: zname,
          description: null, sort_order: 0, is_active: true,
          x_pos: Math.round(x1), y_pos: Math.round(y1),
          w: Math.round(w), h: Math.round(h), color: zoneColor,
        }
        setZones(p => [...p, optimistic])
        setSel({ id: tid, type: "zone" })
        startT(async () => {
          const res = await createFloorZone(venueId, zname,
            Math.round(x1), Math.round(y1), Math.round(w), Math.round(h), zoneColor)
          if ("error" in res) {
            setZones(p => p.filter(z => z.id !== tid))
            setError(res.error)
          } else {
            setZones(p => p.map(z => z.id === tid ? { ...z, ...(res.zone as FZone) } : z))
            setSel({ id: res.zone.id, type: "zone" })
          }
        })
      }
      return
    }

    dragRef.current = null
  }

  const startTableDrag = (e: React.PointerEvent, t: FTable) => {
    if (tool !== "select" || !svgRef.current) return
    e.stopPropagation()
    const { x, y } = svgPt(e as unknown as React.PointerEvent, svgRef.current)
    setSel({ id: t.id, type: "table" })
    svgRef.current.setPointerCapture(e.pointerId)
    dragRef.current = { kind: "table", id: t.id, startX: x, startY: y, ox: t.x_pos, oy: t.y_pos }
  }

  const startZoneDrag = (e: React.PointerEvent, z: FZone) => {
    if (tool !== "select" || !svgRef.current) return
    e.stopPropagation()
    const { x, y } = svgPt(e as unknown as React.PointerEvent, svgRef.current)
    setSel({ id: z.id, type: "zone" })
    svgRef.current.setPointerCapture(e.pointerId)
    const zoneTables = tables
      .filter(t => tableInZone(t, z))
      .map(t => ({ id: t.id, ox: t.x_pos, oy: t.y_pos }))
    dragRef.current = { kind: "zone", id: z.id, startX: x, startY: y, ox: z.x_pos, oy: z.y_pos, ow: z.w, oh: z.h, zoneTables }
  }

  const startResize = (e: React.PointerEvent, z: FZone) => {
    e.stopPropagation()
    if (!svgRef.current) return
    const { x, y } = svgPt(e as unknown as React.PointerEvent, svgRef.current)
    svgRef.current.setPointerCapture(e.pointerId)
    dragRef.current = { kind: "resize", id: z.id, startX: x, startY: y, ox: z.x_pos, oy: z.y_pos, ow: z.w, oh: z.h }
  }

  const handleSave = () => {
    startT(async () => {
      const res = await savePositions(
        tables.filter(t => !t.id.startsWith("temp-")).map(t => ({ id: t.id, x_pos: t.x_pos, y_pos: t.y_pos })),
        zones.filter(z => !z.id.startsWith("temp-")).map(z => ({ id: z.id, x_pos: z.x_pos, y_pos: z.y_pos, w: z.w, h: z.h }))
      )
      if (res && "error" in res) {
        setError(res.error)
      } else {
        setSaveState("saved")
        setTimeout(() => setSaveState("idle"), 2500)
      }
    })
  }

  const handleDeleteTable = () => {
    if (!selTable) return
    const id = selTable.id
    setTables(p => p.filter(t => t.id !== id))
    setSel(null)
    if (!id.startsWith("temp-")) {
      startT(async () => {
        const res = await deleteTable(id)
        if (res && "error" in res) setError(res.error)
      })
    }
  }

  const handleDeleteZone = () => {
    if (!selZone) return
    const id = selZone.id
    setZones(p => p.filter(z => z.id !== id))
    setSel(null)
    if (filterZone === id) setFilterZone(null)
    if (!id.startsWith("temp-")) {
      startT(async () => {
        const res = await deleteZone(id)
        if (res && "error" in res) setError(res.error)
      })
    }
  }

  const drX = drawRect ? Math.min(drawRect.x1, drawRect.x2) : 0
  const drY = drawRect ? Math.min(drawRect.y1, drawRect.y2) : 0
  const drW = drawRect ? Math.abs(drawRect.x2 - drawRect.x1) : 0
  const drH = drawRect ? Math.abs(drawRect.y2 - drawRect.y1) : 0

  const activeZone = filterZone ? zones.find(z => z.id === filterZone) : null

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-700 text-sm shrink-0">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-0.5 hover:bg-red-100 rounded"><X size={14} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100 flex-wrap shrink-0">
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {([
            ["select",    MousePointer2,    "Výber"],
            ["add-table", Plus,             "Pridať stôl"],
            ["add-zone",  LayoutGrid,       "Nakresliť zónu"],
          ] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTool(t)} title={label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tool === t ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/60"}`}
              style={tool === t ? { backgroundColor: "var(--brand-orange)" } : {}}>
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {tool === "add-zone" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Farba:</span>
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c.hex} onClick={() => setZoneColor(c.hex)} title={c.label}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${zoneColor === c.hex ? "border-gray-600 scale-125" : "border-gray-200"}`}
                  style={{ backgroundColor: c.hex }} />
              ))}
            </div>
          </div>
        )}

        {tool === "add-table" && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
            Klikni na plán pre umiestnenie stola
          </span>
        )}
        {tool === "add-zone" && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
            Ťahaj myšou pre nakreslenie zóny
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {venues.length > 1 && (
            <select
              value={selectedVenueId}
              onChange={(e) => router.push(`/admin/tables?venue=${e.target.value}`)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
          <span className="text-xs text-gray-400">
            {tables.filter(t => !t.id.startsWith("temp-")).length} stolov · {zones.filter(z => !z.id.startsWith("temp-")).length} zón
          </span>
          <button onClick={handleSave} disabled={isPending}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 ${saveState === "saved" ? "bg-emerald-500" : ""}`}
            style={saveState !== "saved" ? { backgroundColor: "var(--brand-orange)" } : {}}>
            {saveState === "saved" ? <><Check size={14} /> Uložené</> : <><Save size={14} /> Uložiť rozloženie</>}
          </button>
        </div>
      </div>

      {/* Zone filter bar */}
      {zones.filter(z => !z.id.startsWith("temp-")).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto shrink-0">
          <span className="text-xs text-gray-400 whitespace-nowrap">Zobraziť zónu:</span>
          <button
            onClick={() => setFilterZone(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filterZone === null ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
            Všetky
          </button>
          {zones.filter(z => !z.id.startsWith("temp-")).map(z => (
            <button key={z.id}
              onClick={() => setFilterZone(filterZone === z.id ? null : z.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${filterZone === z.id ? "border-gray-700 text-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-100 bg-white"}`}
              style={filterZone === z.id ? { backgroundColor: z.color } : {}}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
              {z.name}
            </button>
          ))}
        </div>
      )}

      {/* Canvas + Panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {/* Wrapper for SVG + resize handle */}
          <div className="relative inline-block">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              width={canvasW} height={canvasH}
              className="bg-white rounded-xl shadow-sm block"
              style={{ cursor: tool === "select" ? "default" : "crosshair", userSelect: "none", touchAction: "none" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              {/* Grid */}
              <defs>
                <pattern id="fp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0L0 0 0 40" fill="none" stroke="#F3F4F6" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={canvasW} height={canvasH} fill="url(#fp-grid)" />

              {/* Zones */}
              {zones.map(z => {
                const isSelected = sel?.id === z.id
                const isTemp = z.id.startsWith("temp-")
                const dimmed = activeZone && z.id !== activeZone.id
                return (
                  <g key={z.id} style={{ cursor: "grab" }} onPointerDown={e => startZoneDrag(e, z)}
                    opacity={isTemp ? 0.6 : dimmed ? 0.2 : 1}>
                    <rect x={z.x_pos} y={z.y_pos} width={z.w} height={z.h}
                      fill={z.color} stroke={isSelected ? "#F97316" : "#D1D5DB"}
                      strokeWidth={isSelected ? 2 : 1} rx={10} />
                    <text x={z.x_pos + 12} y={z.y_pos + 22}
                      fontSize={11} fontWeight={600} fill="#6B7280" pointerEvents="none">
                      {z.name.toUpperCase()}
                    </text>
                    <rect
                      x={z.x_pos + z.w - 12} y={z.y_pos + z.h - 12}
                      width={12} height={12} rx={3} fill="#9CA3AF"
                      style={{ cursor: "se-resize" }}
                      onPointerDown={e => startResize(e, z)}
                    />
                  </g>
                )
              })}

              {/* Tables */}
              {tables.map(t => {
                const { w: tw, h: th } = tableDims(t.shape)
                const cx = t.x_pos + tw / 2, cy = t.y_pos + th / 2
                const isSelected = sel?.id === t.id
                const isTemp = t.id.startsWith("temp-")
                const dimmed = activeZone && !tableInZone(t, activeZone)
                const stroke = isSelected ? "#F97316" : "#D1D5DB"
                const sw = isSelected ? 2.5 : 1.5
                return (
                  <g key={t.id} style={{ cursor: dimmed ? "default" : "grab" }}
                    opacity={isTemp ? 0.6 : dimmed ? 0.15 : 1}
                    onPointerDown={dimmed ? undefined : e => startTableDrag(e, t)}>
                    {t.shape === "round" ? (
                      <circle cx={cx} cy={cy} r={Math.min(tw, th) / 2 - 2} fill="white" stroke={stroke} strokeWidth={sw} />
                    ) : (
                      <rect x={t.x_pos + 2} y={t.y_pos + 2} width={tw - 4} height={th - 4} rx={8}
                        fill="white" stroke={stroke} strokeWidth={sw} />
                    )}
                    <text x={cx} y={t.capacity ? cy - 5 : cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize={10} fontWeight={700} fill="#374151" pointerEvents="none">
                      {t.name}
                    </text>
                    {t.capacity && (
                      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fill="#9CA3AF" pointerEvents="none">
                        {t.capacity} os.
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Zone draw preview */}
              {drawRect && drW > 10 && drH > 10 && (
                <rect x={drX} y={drY} width={drW} height={drH}
                  fill={zoneColor} opacity={0.4}
                  stroke="#F97316" strokeWidth={2} strokeDasharray="8 4" rx={10} />
              )}
            </svg>

            {/* Canvas resize handle */}
            <div
              className="absolute bottom-0 right-0 w-5 h-5 flex items-center justify-center rounded-br-xl cursor-se-resize"
              style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
              onPointerDown={onCanvasResizeDown}
              onPointerMove={onCanvasResizeMove}
              onPointerUp={onCanvasResizeUp}
              title="Zmeniť veľkosť plánu"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <line x1="2" y1="9" x2="9" y2="2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5" y1="9" x2="9" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-64 bg-white border-l border-gray-100 overflow-y-auto shrink-0">
          {selTable ? (
            <TablePanel
              table={selTable} venueId={venueId}
              onUpdate={u => setTables(p => p.map(t => t.id !== selTable.id ? t : { ...t, ...u }))}
              onDelete={handleDeleteTable}
              isPending={isPending} startT={startT}
            />
          ) : selZone ? (
            <ZonePanel
              zone={selZone}
              onUpdate={u => setZones(p => p.map(z => z.id !== selZone.id ? z : { ...z, ...u }))}
              onDelete={handleDeleteZone}
              isPending={isPending} startT={startT}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-gray-400">
              <MousePointer2 size={28} className="mb-3 opacity-30" />
              <p className="text-xs leading-relaxed">
                Klikni na stôl alebo zónu pre úpravu.<br />
                Vyber nástroj hore pre pridanie nových prvkov.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
