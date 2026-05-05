"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/admin-context"
import { sendAdminNotification } from "@/lib/email"

export async function createFeedbackTicket(formData: FormData): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlaseny" }

  const subject = (formData.get("subject") as string)?.trim()
  const message = (formData.get("message") as string)?.trim()
  const ticket_type = (formData.get("ticket_type") as string) || "support"
  const priority = (formData.get("priority") as string) || "normal"

  if (!subject) return { error: "Predmet je povinny" }
  if (!message) return { error: "Popis je povinny" }

  const admin = createAdminClient()

  const { data: ticket, error: ticketError } = await admin
    .from("support_tickets")
    .insert({
      organization_id: ctx.org.id,
      created_by: ctx.user.id,
      subject,
      status: "open",
      priority: ticket_type === "feature" ? "normal" : priority,
      ticket_type,
    } as any)
    .select("id")
    .single()

  if (ticketError) return { error: ticketError.message }

  const { error: msgError } = await admin
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: ctx.user.id,
      message,
      is_staff: false,
    })

  if (msgError) return { error: msgError.message }

  const isFeature = ticket_type === "feature"
  const priorityLabel: Record<string, string> = {
    low: "Nizka", normal: "Normalna", high: "Vysoka", urgent: "Urgentna",
  }

  sendAdminNotification({
    subject: isFeature
      ? `[eWaiter] Novy napad od ${ctx.org.name}: ${subject}`
      : `[eWaiter] Nova podpora od ${ctx.org.name}: ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:${isFeature ? "#7c3aed" : "#E85B1A"};padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">
            ${isFeature ? "Novy napad / funkcia" : "Nova poziadavka na podporu"}
          </h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px">Organizacia:</td>
              <td style="padding:8px 0;font-weight:600;font-size:14px">${ctx.org.name}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px">Predmet:</td>
              <td style="padding:8px 0;font-weight:600;font-size:14px">${subject}</td>
            </tr>
            ${!isFeature ? `<tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px">Priorita:</td>
              <td style="padding:8px 0;font-size:14px">${priorityLabel[priority] ?? priority}</td>
            </tr>` : ""}
          </table>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
            <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap">${message}</p>
          </div>
          <a href="https://ewaiter.app/super-admin/${isFeature ? "feature-logs" : "support"}"
             style="display:inline-block;background:${isFeature ? "#7c3aed" : "#E85B1A"};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
            Otvorit v eWaiter
          </a>
        </div>
      </div>
    `,
  })

  revalidatePath("/admin/feedback")
  return null
}

export async function sendFeedbackMessage(ticketId: string, message: string): Promise<{ error: string } | null> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: "Nie ste prihlaseny" }
  if (!message?.trim()) return { error: "Sprava je prazdna" }

  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, subject, ticket_type")
    .eq("id", ticketId)
    .eq("organization_id", ctx.org.id)
    .single()

  if (!ticket) return { error: "Ticket neexistuje" }

  const { error } = await admin
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: ctx.user.id,
      message: message.trim(),
      is_staff: false,
    })

  if (error) return { error: error.message }

  const isFeature = (ticket as any).ticket_type === "feature"
  sendAdminNotification({
    subject: `[eWaiter] Nova sprava od ${ctx.org.name}: ${(ticket as any).subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1E2D4A;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:18px">Nova sprava v konverzacii</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p style="margin:0 0 8px;color:#6b7280;font-size:13px">${ctx.org.name} — ${(ticket as any).subject}</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
            <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap">${message.trim()}</p>
          </div>
          <a href="https://ewaiter.app/super-admin/${isFeature ? "feature-logs" : "support"}"
             style="display:inline-block;background:#E85B1A;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
            Otvorit v eWaiter
          </a>
        </div>
      </div>
    `,
  })

  revalidatePath("/admin/feedback")
  return null
}
