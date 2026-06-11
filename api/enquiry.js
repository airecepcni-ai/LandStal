const RECIPIENT = "oplustil@barnetasynove.cz";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const data = normalizeBody(req.body);

  if (data.website) {
    return res.status(200).json({ ok: true });
  }

  const name = String(data.name || "").trim();
  const phone = String(data.phone || "").trim();
  const email = String(data.email || "").trim();
  const machine = String(data.machine || "").trim();
  const message = String(data.message || "").trim();

  if (!name || !email) {
    return res.status(400).json({ ok: false, message: "Vyplňte prosím jméno a e-mail." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: "Zadejte prosím platný e-mail." });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ ok: false, message: "E-mailová služba není nastavená." });
  }

  const subject = `Poptávka Landstal: ${machine || "nezávazná poptávka"}`;
  const text = [
    "Poptávka z webu Landstal.cz",
    "",
    `Jméno a firma: ${name}`,
    `Telefon: ${phone || "-"}`,
    `E-mail: ${email}`,
    `Zájem: ${machine || "-"}`,
    "",
    "Poznámka:",
    message || "-",
  ].join("\n");

  const html = `
    <h2>Poptávka z webu Landstal.cz</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Jméno a firma</strong></td><td>${escapeHtml(name)}</td></tr>
      <tr><td><strong>Telefon</strong></td><td>${escapeHtml(phone || "-")}</td></tr>
      <tr><td><strong>E-mail</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Zájem</strong></td><td>${escapeHtml(machine || "-")}</td></tr>
    </table>
    <h3>Poznámka</h3>
    <p>${escapeHtml(message || "-").replace(/\n/g, "<br>")}</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Landstal Website <onboarding@resend.dev>",
      to: [RECIPIENT],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend email failed:", errorText);
    return res.status(502).json({ ok: false, message: "Poptávku se nepodařilo odeslat." });
  }

  return res.status(200).json({ ok: true });
};
