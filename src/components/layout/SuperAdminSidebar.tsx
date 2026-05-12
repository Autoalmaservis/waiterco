"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  HeadphonesIcon,
  Settings,
  LogOut,
  Flag,
  ScrollText,
  ChevronRight,
  Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const nav = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/organizations", label: "Organizácie", icon: Building2 },
  { href: "/super-admin/venues", label: "Prevádzky", icon: Building2 },
  { href: "/super-admin/users", label: "Používatelia", icon: Users },
  { href: "/super-admin/billing", label: "Billing", icon: CreditCard },
  { href: "/super-admin/analytics", label: "Analytika", icon: BarChart3 },
  { href: "/super-admin/support", label: "Podpora", icon: HeadphonesIcon },
  { href: "/super-admin/feature-logs", label: "Feature Logs", icon: Lightbulb },
  { href: "/super-admin/feature-flags", label: "Feature Flags", icon: Flag },
  { href: "/super-admin/audit-logs", label: "Audit Logy", icon: ScrollText },
  { href: "/super-admin/settings", label: "Nastavenia", icon: Settings },
]

interface Props {
  user: { email: string; name: string | null; avatar: string | null }
  badges?: Record<string, number>
}

export default function SuperAdminSidebar({ user, badges = {} }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-64 flex flex-col h-full text-white" style={{ backgroundColor: "var(--brand-navy)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: "var(--brand-orange)" }}>
          e
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">Waiterco</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--brand-teal)" }}>Super Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          const badgeCount = badges[href] ?? 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                active
                  ? "text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
              style={active ? { backgroundColor: "var(--brand-orange)" } : {}}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && !active && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: "var(--brand-orange)" }}>
            {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.name ?? "Super Admin"}</p>
            <p className="text-xs text-white/40 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all w-full mt-1"
        >
          <LogOut size={16} />
          <span>Odhlásiť sa</span>
        </button>
      </div>
    </aside>
  )
}
