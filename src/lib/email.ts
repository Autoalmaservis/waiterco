const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = "eWaiter <onboarding@resend.dev>"
const ADMIN_EMAIL = "maros.jurkovic27@gmail.com"

export async function sendAdminNotification({
  subject,
  html,
}: {
  subject: string
  html: string
}) {
  if (!RESEND_API_KEY) return

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    })
  } catch {
    // non-blocking — ticket creation must not fail if email fails
  }
}
