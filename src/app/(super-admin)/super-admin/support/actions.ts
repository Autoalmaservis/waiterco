"use server"

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Neautorizovaný prístup")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") throw new Error("Nedostatočné oprávnenia")
  return user
}

export async function updateTicketStatus(id: string, status: string): Promise<{ error: string } | null> {
  try {
    await verifySuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/super-admin/support")
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Neznáma chyba" }
  }
}

export async function replyToTicket(ticketId: string, formData: FormData): Promise<{ error: string } | null> {
  try {
    const user = await verifySuperAdmin()
    const message = (formData.get("message") as string)?.trim()
    if (!message) return { error: "Správa je prázdna" }
    const supabase = createAdminClient()
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticketId,
      sender_id: user.id,
      message,
      is_staff: true,
    })
    if (error) return { error: error.message }
    revalidatePath(`/super-admin/support/${ticketId}`)
    return null
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Neznáma chyba" }
  }
}
