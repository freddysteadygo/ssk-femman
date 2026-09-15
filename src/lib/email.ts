// Skickar mejl via Resend (REST-API, ingen SDK behövs).
// Kräver env: RESEND_API_KEY och EMAIL_FROM (t.ex. "SSK-femman <noreply@sskfemman.se>").
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "SSK-femman <noreply@sskfemman.se>";
  if (!key) throw new Error("RESEND_API_KEY saknas");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}
