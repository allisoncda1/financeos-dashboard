/**
 * Email sending via the Resend HTTP API.
 *
 * Security notes:
 *   - The API key is read from the `Resend` (or `RESEND_API_KEY`) secret and
 *     never logged.
 *   - Errors are surfaced to callers; no silent fallbacks.
 *
 * The "from" address defaults to Resend's shared onboarding sender, which can
 * only deliver to the Resend account owner's email until a domain is verified.
 * Set RESEND_FROM_EMAIL (e.g. "FinanceOS <no-reply@yourdomain.com>") once a
 * domain is verified in the Resend dashboard.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

function getApiKey(): string | null {
  return process.env["RESEND_API_KEY"] ?? process.env["Resend"] ?? null;
}

export function emailConfigured(): boolean {
  return getApiKey() !== null;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Email is not configured — missing Resend API key secret.");
  }

  const from = process.env["RESEND_FROM_EMAIL"] ?? "FinanceOS <onboarding@resend.dev>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Never include the API key; the response body from Resend is safe to log.
    throw new Error(`Resend API error (${res.status}): ${body.slice(0, 500)}`);
  }
}
