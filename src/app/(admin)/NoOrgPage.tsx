"use client"

import { useRouter } from "next/navigation"
import { Building2, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function NoOrgPage({ email }: { email: string }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-100">
          <Building2 size={28} className="text-gray-400" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Nemáte priradenú organizáciu</h1>
        <p className="text-sm text-gray-500 mb-1">
          Váš účet <strong className="text-gray-700">{email}</strong> nemá prístup k žiadnej prevádzke.
        </p>
        <p className="text-sm text-gray-400">Kontaktujte správcu platformy.</p>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <LogOut size={15} />
        Odhlásiť sa
      </button>
    </div>
  )
}
