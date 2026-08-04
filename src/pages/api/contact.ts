import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_MESSAGE = 5000;
const MAX_SERVICES = 20;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitize(text: string, max: number): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

export const POST: APIRoute = async ({ request }) => {
  const verification = await checkBotId();
  if (verification.isBot) {
    return json({ ok: false, error: "Access denied" }, 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, error: "Invalid form data" }, 400);
  }

  const name = sanitize(asString(formData.get("name")), MAX_NAME);
  const email = sanitize(asString(formData.get("email")), 320);
  const message = sanitize(asString(formData.get("message")), MAX_MESSAGE);
  const services = formData
    .getAll("service")
    .filter((v): v is string => typeof v === "string")
    .map((v) => sanitize(v, 64))
    .filter(Boolean)
    .slice(0, MAX_SERVICES);

  if (!email || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "A valid email is required" }, 400);
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const toEmail = import.meta.env.CONTACT_TO_EMAIL;
  const fromEmail =
    import.meta.env.CONTACT_FROM_EMAIL || "Perception Pod <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    console.error("Contact API missing RESEND_API_KEY or CONTACT_TO_EMAIL");
    return json({ ok: false, error: "Contact form is not configured" }, 500);
  }

  const serviceLine = services.length ? services.join(", ") : "—";
  const text = [
    `Name: ${name || "—"}`,
    `Email: ${email}`,
    `Services: ${serviceLine}`,
    "",
    "Message:",
    message || "—",
  ].join("\n");

  const html = `
    <p><strong>Name:</strong> ${escapeHtml(name || "—")}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Services:</strong> ${escapeHtml(serviceLine)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message || "—").replace(/\n/g, "<br>")}</p>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `New contact from ${name || email}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Resend error", res.status, detail);
      return json({ ok: false, error: "Failed to send message" }, 502);
    }
  } catch (err) {
    console.error("Resend request failed", err);
    return json({ ok: false, error: "Failed to send message" }, 502);
  }

  return json({ ok: true });
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
