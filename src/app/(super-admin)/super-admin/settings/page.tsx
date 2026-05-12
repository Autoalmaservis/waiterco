import { createClient } from "@/lib/supabase/server"

export default async function SuperAdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('full_name, phone, language').eq('id', user!.id).single()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nastavenia</h1>
        <p className="text-gray-500 text-sm mt-1">Nastavenia Super Admin účtu</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Profil</h2>
          <div className="space-y-3">
            <InfoRow label="Meno" value={profile?.full_name ?? '–'} />
            <InfoRow label="Email" value={user?.email ?? '–'} />
            <InfoRow label="Telefón" value={profile?.phone ?? '–'} />
            <InfoRow label="Jazyk" value={profile?.language ?? 'sk'} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Platforma</h2>
          <div className="space-y-3">
            <InfoRow label="Verzia" value="Waiterco 1.0.0" />
            <InfoRow label="Prostredie" value={process.env.NODE_ENV} />
            <InfoRow label="Supabase URL" value={process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').split('.')[0] + '.supabase.co'} />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            <span className="font-medium">Tip:</span> Pre zmenu hesla alebo profilu použite Supabase Dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value ?? '–'}</span>
    </div>
  )
}
