import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const fullName = body.full_name?.trim() ?? null

  const admin = createAdminClient()
  await (admin as any)
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id)

  return NextResponse.json({ ok: true })
}
