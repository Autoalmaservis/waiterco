"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Shield, Building2, ArrowLeft, ChefHat, ShoppingBag, Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type RoleChoice = "super_admin" | "admin" | "staff" | "customer"

const roles = [
  {
    key: "super_admin" as RoleChoice,
    label: "Super Admin",
    desc: "Sprava celej platformy",
    icon: Shield,
    accent: "#2BB58C",
  },
  {
    key: "admin" as RoleChoice,
    label: "Restauracia",
    desc: "Sprava prevadzky, menu a personalu",
    icon: Building2,
    accent: "#E85B1A",
  },
  {
    key: "staff" as RoleChoice,
    label: "Personal",
    desc: "Casnik, kuchar, barman",
    icon: ChefHat,
    accent: "#3B82F6",
  },
  {
    key: "customer" as RoleChoice,
    label: "Zakaznik",
    desc: "Objednavky, donavka, QR menu",
    icon: ShoppingBag,
    accent: "#8B5CF6",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<RoleChoice | null>(null)
  const [mode, setMode] = useState<"login" | "reset">("login")
  const [customerMode, setCustomerMode] = useState<"login" | "register">("login")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [isPending, startTransition] = useTransition()

  const selectedRole = roles.find(r => r.key === step)

  const handleLogin = (formData: FormData) => {
    setError("")
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    startTransition(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError("Nespravny email alebo heslo"); return }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
      if (profile?.role === "super_admin") router.push("/super-admin")
      else if (profile?.role === "restaurant_admin" || profile?.role === "manager") router.push("/admin")
      else router.push("/staff")
    })
  }

  const handleCustomerLogin = (formData: FormData) => {
    setError("")
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError("Nespravny email alebo heslo"); return }
      router.push("/restaurants")
    })
  }

  const handleCustomerRegister = (formData: FormData) => {
    setError("")
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const name = formData.get("name") as string
    if (password.length < 6) { setError("Heslo musi mat aspon 6 znakov"); return }
    startTransition(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name || null } },
      })
      if (error) { setError(error.message); return }
      if (data.user) {
        // Create customer profile
        await fetch("/api/customer/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, fullName: name || null }),
        })
      }
      if (data.session) {
        router.push("/restaurants")
      } else {
        setInfo("Skontroluj email a potvrď registráciu, potom sa prihlas.")
        setCustomerMode("login")
      }
    })
  }

  const handleReset = (formData: FormData) => {
    setError("")
    setInfo("")
    const email = formData.get("email") as string
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/set-password`,
      })
      if (error) { setError("Nepodarilo sa odoslat email. Skontrolujte adresu."); return }
      setInfo("Email s odkazom na obnovenie hesla bol odoslany.")
    })
  }

  const goBack = () => {
    setStep(null)
    setMode("login")
    setCustomerMode("login")
    setError("")
    setInfo("")
    setShowPassword(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: "#1E2D4A" }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ backgroundColor: "#E85B1A" }}>
          <span className="text-white text-3xl font-bold">e</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">eWaiter</h1>
        <p className="text-white/50 text-sm mt-1">
          {step === null ? "Vyberte sposob prihlasenia" : `Prihlasenie — ${selectedRole?.label}`}
        </p>
      </div>

      {/* Role picker */}
      {step === null && (
        <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
          {roles.map(role => {
            const Icon = role.icon
            return <RoleCard key={role.key} role={role} Icon={Icon} onClick={() => setStep(role.key)} />
          })}
        </div>
      )}

      {/* Customer form */}
      {step === "customer" && (
        <div className="w-full max-w-sm">
          <div className="h-1 rounded-t-xl" style={{ backgroundColor: "#8B5CF6" }} />
          <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-2xl p-8">
            {/* Login / Register toggle */}
            <div className="flex rounded-lg border border-gray-200 p-1 mb-5">
              {(["login", "register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setCustomerMode(m); setError(""); setInfo("") }}
                  className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={customerMode === m ? { backgroundColor: "#8B5CF6", color: "white" } : { color: "#6b7280" }}
                >
                  {m === "login" ? "Prihlásenie" : "Registrácia"}
                </button>
              ))}
            </div>

            {info && <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg mb-4">{info}</div>}
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

            {customerMode === "login" ? (
              <form onSubmit={e => { e.preventDefault(); handleCustomerLogin(new FormData(e.currentTarget)) }} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" name="email" required autoFocus placeholder="tvoj@email.sk"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "#8B5CF6" } as React.CSSProperties} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Heslo</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} name="password" required placeholder="••••••••"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ "--tw-ring-color": "#8B5CF6" } as React.CSSProperties} />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#8B5CF6" }}>
                  {isPending ? <><Loader2 size={15} className="animate-spin" />Prihlasujem…</> : "Prihlásiť sa"}
                </button>
              </form>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleCustomerRegister(new FormData(e.currentTarget)) }} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Meno (voliteľné)</label>
                  <input type="text" name="name" placeholder="Ján Novák"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "#8B5CF6" } as React.CSSProperties} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" name="email" required autoFocus placeholder="tvoj@email.sk"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "#8B5CF6" } as React.CSSProperties} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Heslo</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} name="password" required placeholder="min. 6 znakov"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ "--tw-ring-color": "#8B5CF6" } as React.CSSProperties} />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#8B5CF6" }}>
                  {isPending ? <><Loader2 size={15} className="animate-spin" />Registrujem…</> : "Vytvoriť účet"}
                </button>
              </form>
            )}

            <button onClick={goBack}
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={12} />Zmenit typ prihlasenia
            </button>
          </div>
        </div>
      )}

      {/* Staff / Admin form */}
      {step !== null && step !== "customer" && (
        <div className="w-full max-w-sm">
          <div className="h-1 rounded-t-xl" style={{ backgroundColor: selectedRole?.accent }} />
          <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-2xl p-8">
            {mode === "login" ? (
              <form onSubmit={e => { e.preventDefault(); handleLogin(new FormData(e.currentTarget)) }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" required autoFocus placeholder="vas@email.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Heslo</label>
                    <button type="button" onClick={() => { setMode("reset"); setError(""); setInfo("") }}
                      className="text-xs hover:opacity-70 transition-opacity" style={{ color: selectedRole?.accent }}>
                      Zabudnute heslo?
                    </button>
                  </div>
                  <input type="password" name="password" required placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
                </div>
                {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>}
                <button type="submit" disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: selectedRole?.accent }}>
                  {isPending ? "Prihlasovanie..." : "Prihlasit sa"}
                </button>
              </form>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleReset(new FormData(e.currentTarget)) }} className="space-y-4">
                <p className="text-sm text-gray-500">Zadajte vas email a posieme vam odkaz na nastavenie noveho hesla.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" required autoFocus placeholder="vas@email.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
                </div>
                {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>}
                {info && <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg">{info}</div>}
                <button type="submit" disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: selectedRole?.accent }}>
                  {isPending ? "Odosielam..." : "Odoslat odkaz"}
                </button>
                <button type="button" onClick={() => { setMode("login"); setError(""); setInfo("") }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                  <ArrowLeft size={13} />Spat na prihlasenie
                </button>
              </form>
            )}
            <button onClick={goBack}
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={12} />Zmenit typ prihlasenia
            </button>
          </div>
        </div>
      )}

      <p className="text-white/20 text-xs mt-10">&copy; {new Date().getFullYear()} eWaiter</p>
    </div>
  )
}

function RoleCard({
  role, Icon, onClick,
}: {
  role: { label: string; desc: string; accent: string }
  Icon: React.ElementType
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all duration-200 text-center hover:scale-[1.02] active:scale-[0.99]"
      style={{
        backgroundColor: hovered ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
        borderColor: hovered ? role.accent + "55" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: role.accent + "22" }}>
        <Icon size={24} style={{ color: role.accent }} />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">{role.label}</p>
        <p className="text-white/40 text-xs mt-0.5 leading-snug">{role.desc}</p>
      </div>
    </button>
  )
}
