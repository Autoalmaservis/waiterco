import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { userId, fullName } = await request.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  const admin = createAdminClient()

  // Upsert — ak profil uz existuje (napr. z auth callback), len aktualizujeme
  const { error } = await (admin as any).from("profiles").upsert({
    id: userId,
    full_name: fullName ?? null,
    role: "customer",
    language: "sk",
    is_active: true,
  }, { onConflict: "id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
