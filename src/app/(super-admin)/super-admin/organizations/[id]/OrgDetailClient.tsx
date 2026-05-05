'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, Trash2, X } from 'lucide-react'
import { updateOrganization, deleteOrganization } from '../actions'

type OrgData = {
  id: string; name: string; logo_url: string | null; billing_email: string | null
  ico: string | null; dic: string | null; ic_dph: string | null
  street: string | null; city: string | null; postal_code: string | null
  country: string | null; phone: string | null; website: string | null
}

function Field({ label, name, type = 'text', required, defaultValue, placeholder }: {
  label: string; name: string; type?: string
  required?: boolean; defaultValue?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
      <input
        type={type} name={name} required={required}
        defaultValue={defaultValue} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">{children}</p>
}

export default function OrgDetailClient({ org }: { org: OrgData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleEdit = (formData: FormData) => {
    setEditError(null)
    startTransition(async () => {
      const result = await updateOrganization(org.id, formData)
      if (result?.error) setEditError(result.error)
      else { setEditOpen(false); router.refresh() }
    })
  }

  const handleDelete = () => {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteOrganization(org.id)
      if (result?.error) setDeleteError(result.error)
      else router.push('/super-admin/organizations')
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => { setEditError(null); setEditOpen(true) }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Pencil size={14} />
          Upraviť
        </button>
        <button
          onClick={() => { setDeleteError(null); setDeleteOpen(true) }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
          Zmazať
        </button>
      </div>

      {/* Edit Dialog */}
      <Dialog.Root open={editOpen} onOpenChange={open => { if (!isPending) setEditOpen(open) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-lg z-50 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Upraviť organizáciu</Dialog.Title>
              <button onClick={() => { if (!isPending) setEditOpen(false) }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form key={org.id} action={handleEdit} className="space-y-3">
              <SectionTitle>Základné údaje</SectionTitle>
              <Field label="Názov organizácie" name="name" required defaultValue={org.name} />
              <Field label="Logo URL" name="logo_url" type="url" defaultValue={org.logo_url ?? ''} placeholder="https://..." />

              <SectionTitle>Fakturačné a právne údaje</SectionTitle>
              <Field label="Fakturačný email" name="billing_email" type="email" defaultValue={org.billing_email ?? ''} placeholder="billing@firma.sk" />
              <div className="grid grid-cols-3 gap-2">
                <Field label="IČO" name="ico" defaultValue={org.ico ?? ''} placeholder="12345678" />
                <Field label="DIČ" name="dic" defaultValue={org.dic ?? ''} placeholder="2012345678" />
                <Field label="IČ DPH" name="ic_dph" defaultValue={org.ic_dph ?? ''} placeholder="SK2012345678" />
              </div>

              <SectionTitle>Adresa</SectionTitle>
              <Field label="Ulica a číslo" name="street" defaultValue={org.street ?? ''} placeholder="Hlavná 12" />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Mesto" name="city" defaultValue={org.city ?? ''} placeholder="Bratislava" />
                </div>
                <Field label="PSČ" name="postal_code" defaultValue={org.postal_code ?? ''} placeholder="81101" />
              </div>
              <Field label="Krajina" name="country" defaultValue={org.country ?? 'SK'} placeholder="SK" />

              <SectionTitle>Kontakt</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Telefón" name="phone" type="tel" defaultValue={org.phone ?? ''} placeholder="+421 900 000 000" />
                <Field label="Web" name="website" type="url" defaultValue={org.website ?? ''} placeholder="https://firma.sk" />
              </div>

              {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                  Zrušiť
                </button>
                <button type="submit" disabled={isPending}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-orange)' }}>
                  {isPending ? 'Ukladanie…' : 'Uložiť'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Dialog */}
      <Dialog.Root open={deleteOpen} onOpenChange={open => { if (!isPending && !open) setDeleteOpen(false) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-sm z-50 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Zmazať organizáciu?</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-5">
              Naozaj chceš natrvalo zmazať <strong className="text-gray-900">{org.name}</strong>?
              Táto akcia je nevratná a zmaže aj všetky prevádzky a dáta.
            </Dialog.Description>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)} disabled={isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Zrušiť
              </button>
              <button onClick={handleDelete} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {isPending ? 'Mazanie…' : 'Zmazať'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
