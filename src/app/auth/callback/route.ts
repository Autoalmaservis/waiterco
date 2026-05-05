import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/restaurants"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Ensure customer profile exists
      const admin = createAdminClient()
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id, role")
        .eq("id", data.user.id)
        .single()

      if (!existingProfile) {
        await (admin as any).from("profiles").insert({
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name ?? null,
          role: "customer",
          language: "sk",
          is_active: true,
        })
      } else if (existingProfile.role !== "customer") {
        // Non-customer user signed in via OTP — send to staff/admin flows
        return NextResponse.redirect(`${origin}/`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/app/sign-in?error=invalid_link`)
}
