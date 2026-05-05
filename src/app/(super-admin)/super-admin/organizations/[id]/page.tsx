import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, Building2, MapPin, Phone, Globe, Mail, Hash, Pencil, Trash2 } from "lucide-react"
import OrgDetailClient from "./OrgDetailClient"

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

const statusLabels: Record<string, string> = {
  trial: 'Trial', active: 'Aktívny', expired: 'Vypršal', cancelled: 'Zrušený',
}

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, logo_url, billing_email, ico, dic, ic_dph, street, city, postal_code, country, phone, website, owner_id, created_at, updated_at")
    .eq("id", id)
    .single()

  if (!org) notFound()

  const [subResult, venuesResult, ownerResult] = await Promise.all([
    supabase.from("subscriptions").select("plan, status, started_at, expires_at, monthly_price").eq("organization_id", id).maybeSingle(),
    supabase.from("venues").select("id, name, type, city, is_active").eq("organization_id", id).order("created_at"),
    supabase.from("profiles").select("full_name, phone").eq("id", org.owner_id).single(),
  ])

  const sub = subResult.data
  const venues = venuesResult.data ?? []
  const owner = ownerResult.data

  return (
    <div className="p-8 max-w-5xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link href="/super-admin/organizations" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
          <ArrowLeft size={15} />
          Späť na organizácie
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ backgroundColor: 'var(--brand-orange)' }}
            >
              {org.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {sub ? (
                  <>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColors[sub.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {sub.plan}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{statusLabels[sub.status] ?? sub.status}</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Bez predplatného</span>
                )}
                <span className="text-xs text-gray-400">· Vytvorená {new Date(org.created_at).toLocaleDateString('sk-SK')}</span>
              </div>
            </div>
          </div>
          <OrgDetailClient org={org} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Prevádzky" value={String(venues.length)} icon={<Building2 size={18} />} />
        <StatCard label="Aktívne prevádzky" value={String(venues.filter(v => v.is_active).length)} icon={<Building2 size={18} />} />
        <StatCard
          label="Mesačný plán"
          value={sub?.monthly_price != null ? `${sub.monthly_price} €` : '–'}
          icon={<Hash size={18} />}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Fakturačné a právne */}
        <InfoCard title="Fakturačné a právne údaje">
          <InfoRow label="Fakturačný email" value={org.billing_email} icon={<Mail size={14} />} />
          <InfoRow label="IČO" value={org.ico} icon={<Hash size={14} />} />
          <InfoRow label="DIČ" value={org.dic} icon={<Hash size={14} />} />
          <InfoRow label="IČ DPH" value={org.ic_dph} icon={<Hash size={14} />} />
        </InfoCard>

        {/* Kontakt */}
        <InfoCard title="Kontakt">
          <InfoRow label="Telefón" value={org.phone} icon={<Phone size={14} />} />
          <InfoRow label="Web" value={org.website} icon={<Globe size={14} />} link={org.website ?? undefined} />
          <InfoRow
            label="Adresa"
            value={[org.street, org.city && org.postal_code ? `${org.postal_code} ${org.city}` : (org.city ?? org.postal_code), org.country].filter(Boolean).join(', ') || null}
            icon={<MapPin size={14} />}
          />
        </InfoCard>

        {/* Vlastník */}
        <InfoCard title="Vlastník účtu">
          <InfoRow label="Meno" value={owner?.full_name} />
          <InfoRow label="Telefón" value={owner?.phone} icon={<Phone size={14} />} />
          <InfoRow label="ID" value={org.owner_id} mono />
        </InfoCard>

        {/* Predplatné */}
        <InfoCard title="Predplatné">
          {sub ? (
            <>
              <InfoRow label="Plán" value={sub.plan} />
              <InfoRow label="Status" value={statusLabels[sub.status] ?? sub.status} />
              <InfoRow label="Začiatok" value={new Date(sub.started_at).toLocaleDateString('sk-SK')} />
              <InfoRow label="Platnosť do" value={sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('sk-SK') : 'Bez obmedzenia'} />
              <InfoRow label="Mesačná cena" value={sub.monthly_price != null ? `${sub.monthly_price} €` : '–'} />
            </>
          ) : (
            <p className="text-sm text-gray-400 py-2">Žiadne aktívne predplatné</p>
          )}
        </InfoCard>
      </div>

      {/* Venues */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Prevádzky</h2>
          <span className="text-xs text-gray-400">{venues.length}</span>
        </div>
        {venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Building2 size={28} className="mb-2 opacity-30" />
            <p className="text-sm">Žiadne prevádzky</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Názov</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Typ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Mesto</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {venues.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{v.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500 capitalize">{v.type}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{v.city ?? '–'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {v.is_active ? 'Aktívna' : 'Neaktívna'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, icon, link, mono }: {
  label: string; value: string | null | undefined
  icon?: React.ReactNode; link?: string; mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className={`text-sm text-gray-900 break-all ${mono ? 'font-mono text-xs text-gray-500' : ''}`}>{value}</p>
        )}
      </div>
    </div>
  )
}
