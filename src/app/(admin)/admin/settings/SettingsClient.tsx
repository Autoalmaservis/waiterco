"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Venue, VenueType, OpeningHours, VenueClosure } from "@/types/database"
import { updateVenue } from "../venues/actions"
import { saveOpeningHours, changePassword } from "./actions"
import ClosuresCalendar from "./ClosuresCalendar"

function PasswordSection({ userEmail }: { userEmail: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const handleSubmit = (formData: FormData) => {
    setError("")
    setSuccess(false)
    const current = formData.get("current_password") as string
    const next = formData.get("new_password") as string
    const confirm = formData.get("confirm_password") as string
    if (next !== confirm) { setError("Nove hesla sa nezhoduju"); return }
    startTransition(async () => {
      const result = await changePassword(current, next)
      if (result?.error) { setError(result.error); return }
      setSuccess(true)
      setFormKey(k => k + 1)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Zmena hesla</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Prihlasovaci ucet: <span className="font-medium text-gray-600">{userEmail}</span>
        </p>
      </div>
      <form key={formKey} action={handleSubmit} className="p-6 space-y-4 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Aktualne heslo *</label>
          <input name="current_password" type="password" required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Vase aktualne heslo" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nove heslo *</label>
          <input name="new_password" type="password" required minLength={8}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Min. 8 znakov" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Potvrdit nove heslo *</label>
          <input name="confirm_password" type="password" required minLength={8}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Zopakujte nove heslo" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Heslo bolo uspesne zmenene.</p>}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={isPending}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: "var(--brand-orange)" }}>
            {isPending ? "Menim heslo..." : "Zmenit heslo"}
          </button>
        </div>
      </form>
    </div>
  )
}

const DAY_NAMES = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"]
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Po–Ne

interface Props {
  venue: Venue
  venues: { id: string; name: string; type: VenueType; is_active: boolean }[]
  selectedVenueId: string
  openingHours: OpeningHours[]
  closures: VenueClosure[]
  userEmail: string
}

function TimeInput({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <input
      type="time"
      name={name}
      defaultValue={defaultValue}
      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-28"
    />
  )
}

function OpeningHoursSection({ venueId, hours }: { venueId: string; hours: OpeningHours[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [closedDays, setClosedDays] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {}
    for (const h of hours) map[h.day_of_week] = h.is_closed
    return map
  })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const getHours = (day: number) => hours.find((h) => h.day_of_week === day)

  const handleSave = (formData: FormData) => {
    for (let d = 0; d < 7; d++) {
      formData.set(`is_closed_${d}`, closedDays[d] ? "true" : "false")
    }
    setError("")
    setSuccess(false)
    startTransition(async () => {
      const result = await saveOpeningHours(venueId, formData)
      if (result?.error) { setError(result.error); return }
      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <form action={handleSave}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Otváracie hodiny</h2>
          <p className="text-xs text-gray-400 mt-0.5">Nastavte časy pre každý deň v týždni</p>
        </div>
        <div className="divide-y divide-gray-50">
          {DAY_ORDER.map((day) => {
            const h = getHours(day)
            const isClosed = closedDays[day] ?? h?.is_closed ?? false
            return (
              <div key={day} className="px-6 py-3 flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <span className="text-sm font-medium text-gray-900">{DAY_NAMES[day]}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setClosedDays((prev) => ({ ...prev, [day]: !isClosed }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${!isClosed ? "bg-green-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${!isClosed ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-xs text-gray-400 w-16 shrink-0">{isClosed ? "Zatvorené" : "Otvorené"}</span>
                {!isClosed ? (
                  <div className="flex items-center gap-2">
                    <TimeInput name={`opens_at_${day}`} defaultValue={h?.open_time ?? "09:00"} />
                    <span className="text-gray-400 text-sm">–</span>
                    <TimeInput name={`closes_at_${day}`} defaultValue={h?.close_time ?? "22:00"} />
                  </div>
                ) : (
                  <span className="text-sm text-gray-300 italic">—</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">Otváracie hodiny boli uložené.</p>}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            {isPending ? "Ukladám..." : "Uložiť hodiny"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function SettingsClient({ venue: initial, venues, selectedVenueId, openingHours, closures, userEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSave = (formData: FormData) => {
    setError("")
    setSuccess(false)
    startTransition(async () => {
      const result = await updateVenue(selectedVenueId, formData)
      if (result?.error) { setError(result.error); return }
      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nastavenia prevádzky</h1>
          <p className="text-gray-500 text-sm mt-1">Upravte nastavenia vašej prevádzky</p>
        </div>
        {venues.length > 1 && (
          <select
            value={selectedVenueId}
            onChange={(e) => router.push(`/admin/settings?venue=${e.target.value}`)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      {/* Venue form */}
      <div className="bg-white rounded-xl border border-gray-100">
        <form action={handleSave} className="p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Základné informácie</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Názov prevádzky *</label>
                <input name="name" required defaultValue={initial.name} key={`name-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Typ</label>
                <select name="type" defaultValue={initial.type} key={`type-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="restaurant">Reštaurácia</option>
                  <option value="bar">Bar</option>
                  <option value="hotel">Hotel</option>
                  <option value="cafe">Kaviareň</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mena</label>
                <select name="currency" defaultValue={initial.currency} key={`currency-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="EUR">EUR – Euro</option>
                  <option value="CZK">CZK – Česká koruna</option>
                  <option value="USD">USD – Dolár</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Popis</label>
                <textarea name="description" rows={3} defaultValue={initial.description ?? ""} key={`desc-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Kontaktné informácie</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresa</label>
                <input name="address" defaultValue={initial.address ?? ""} key={`address-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mesto</label>
                <input name="city" defaultValue={initial.city ?? ""} key={`city-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Krajina</label>
                <input name="country" defaultValue={initial.country} key={`country-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefón</label>
                <input name="phone" defaultValue={initial.phone ?? ""} key={`phone-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input name="email" type="email" defaultValue={initial.email ?? ""} key={`email-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Webstránka</label>
                <input name="website" defaultValue={initial.website ?? ""} key={`website-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Zobrazenie & prevádzka</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Časové pásmo</label>
                <select name="timezone" defaultValue={initial.timezone} key={`tz-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="Europe/Bratislava">Europe/Bratislava</option>
                  <option value="Europe/Prague">Europe/Prague</option>
                  <option value="Europe/Vienna">Europe/Vienna</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Primárna farba</label>
                <input name="primary_color" type="color" defaultValue={initial.primary_color ?? "#E85B1A"} key={`color-${selectedVenueId}`}
                  className="w-full h-10 px-1 border border-gray-200 rounded-lg cursor-pointer" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Dôvod zatvorenia</label>
                <input name="closed_reason" defaultValue={initial.closed_reason ?? ""} key={`reason-${selectedVenueId}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Napr. Dovolenka do 15.8." />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg">Nastavenia boli uložené.</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button type="submit" disabled={isPending}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: "var(--brand-orange)" }}>
              {isPending ? "Ukladám..." : "Uložiť nastavenia"}
            </button>
          </div>
        </form>
      </div>

      {/* Opening hours */}
      <OpeningHoursSection venueId={selectedVenueId} hours={openingHours} />

      {/* Closures calendar */}
      <ClosuresCalendar venueId={selectedVenueId} closures={closures} />

      {/* Password */}
      <PasswordSection userEmail={userEmail} />
    </div>
  )
}
