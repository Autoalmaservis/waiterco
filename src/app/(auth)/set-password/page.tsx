"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SetPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [ready, setReady] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    // Supabase appends #access_token=...&type=recovery to the URL
    // The client SDK picks it up automatically on mount
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        setError("Neplatný alebo expirovaný odkaz na obnovenie hesla.")
      }
    })
  }, [])

  const handleSubmit = (formData: FormData) => {
    const password = formData.get("password") as string
    const confirm = formData.get("confirm") as string

    if (password.length < 8) {
      setError("Heslo musí mať aspoň 8 znakov.")
      return
    }
    if (password !== confirm) {
      setError("Heslá sa nezhodujú.")
      return
    }

    setError("")
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError("Nepodarilo sa nastaviť heslo: " + error.message)
        return
      }
      setInfo("Heslo bolo úspešne nastavené. Prihláste sa.")
      setTimeout(() => router.push("/login"), 2000)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: "var(--brand-orange)" }}>
            <span className="text-white text-2xl font-bold">e</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Waiterco</h1>
          <p className="text-gray-500 mt-1">Nastavenie nového hesla</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {!ready && !error && (
            <p className="text-sm text-gray-500 text-center">Overujem odkaz…</p>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>
          )}

          {info && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg mb-4">{info}</div>
          )}

          {ready && !info && (
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nové heslo</label>
                <input type="password" name="password" required autoFocus minLength={8}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="min. 8 znakov" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Potvrďte heslo</label>
                <input type="password" name="confirm" required minLength={8}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="••••••••" />
              </div>

              <button type="submit" disabled={isPending}
                className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {isPending ? "Ukladám…" : "Nastaviť heslo"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
