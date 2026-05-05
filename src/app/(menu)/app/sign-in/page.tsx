"use client"

import { Suspense, useState, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { UtensilsCrossed, Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function CustomerSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SignInInner />
    </Suspense>
  )
}

function SignInInner() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get("error") === "invalid_link"

  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(hasError ? "Odkaz bol neplatný alebo expiroval. Skúste znova." : null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/restaurants`,
          shouldCreateUser: true,
        },
      })
      if (err) {
        setError(err.message)
      } else {
        setSent(true)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1E2D4A] px-4 pt-12 pb-8">
        <div className="max-w-sm mx-auto">
          <Link href="/restaurants" className="flex items-center gap-2 text-white/60 text-sm mb-6 hover:text-white/90 transition-colors">
            <ArrowLeft size={16} />
            Späť na reštaurácie
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#E85B1A] flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl">eWaiter</span>
          </div>
          <p className="text-white/60 text-sm mt-1">Prihlás sa alebo vytvor účet</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-8">
        <div className="max-w-sm mx-auto">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="font-bold text-gray-900 text-xl mb-2">Skontroluj email</h2>
              <p className="text-gray-500 text-sm mb-1">
                Poslali sme odkaz na prihlásenie na
              </p>
              <p className="font-semibold text-gray-900 text-sm mb-6">{email}</p>
              <p className="text-gray-400 text-xs mb-8">
                Klikni na odkaz v emaili a budeš automaticky prihlásený. Odkaz platí 1 hodinu.
              </p>
              <button
                onClick={() => { setSent(false); setEmail("") }}
                className="text-sm text-[#E85B1A] font-medium hover:underline"
              >
                Použiť iný email
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-gray-900 text-2xl mb-1">Vitaj!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Zadaj email a pošleme ti odkaz na prihlásenie. Žiadne heslo!
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Emailová adresa
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tvoj@email.sk"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85B1A] focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className="w-full py-3.5 rounded-xl bg-[#E85B1A] text-white font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <><Loader2 size={18} className="animate-spin" />Odosielam…</>
                  ) : (
                    <>
                      <Mail size={18} />
                      Poslať odkaz
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-500 mb-3">Alebo pokračuj bez účtu</p>
                <Link
                  href="/restaurants"
                  className="text-sm font-semibold text-[#1E2D4A] hover:underline"
                >
                  Prehliadať reštaurácie →
                </Link>
              </div>

              <p className="text-xs text-gray-400 text-center mt-8 leading-relaxed">
                Prihlásením súhlasíš s podmienkami používania a ochranou osobných údajov.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
