import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"
import AdminSidebar from "@/components/layout/AdminSidebar"
import PreviewBanner from "@/components/layout/PreviewBanner"
import NoOrgPage from "./NoOrgPage"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const ctx = await getAdminContext()

  if (!ctx) {
    return <NoOrgPage email={user.email ?? ""} />
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {ctx.isPreview && <PreviewBanner orgName={ctx.org.name} />}
      <div className="flex flex-1 min-h-0">
        <AdminSidebar
          user={{
            email: ctx.user.email,
            name: ctx.profile.full_name,
            avatar: ctx.profile.avatar_url,
          }}
          orgName={ctx.org.name}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
