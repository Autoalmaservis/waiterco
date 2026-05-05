"use client"

import { useTransition } from "react"
import { Eye, X } from "lucide-react"
import { exitOrgPreview } from "@/app/(super-admin)/super-admin/organizations/preview-actions"

export default function PreviewBanner({ orgName }: { orgName: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm text-white" style={{ backgroundColor: "var(--brand-navy)" }}>
      <div className="flex items-center gap-2">
        <Eye size={14} className="opacity-70" />
        <span className="opacity-70">Prezeráš ako Super Admin:</span>
        <span className="font-semibold">{orgName}</span>
      </div>
      <button
        onClick={() => startTransition(() => exitOrgPreview())}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs font-medium disabled:opacity-50"
      >
        <X size={13} />
        {isPending ? "Ukončujem..." : "Ukončiť náhľad"}
      </button>
    </div>
  )
}
