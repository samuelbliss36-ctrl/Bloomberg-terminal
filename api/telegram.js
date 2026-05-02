// Telegram Bot API proxy — keeps the request server-side to avoid CORS issues
// POST { token, chatId, message }

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const { token, chatId, message } = req.body || {};

  if (!token || !chatId || !message) {
    return res.status(400).json({ error: "token, chatId, and message required" });
  }

  // Basic token format validation (Telegram bot tokens look like 123456:ABC-DEF...)
  if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(token)) {
    return res.status(400).json({ error: "Invalid Telegram bot token format" });
  }

  // chatId is a numeric string (positive for users/groups, negative for channels)
  if (!/^-?\d+$/.test(String(chatId))) {
    return res.status(400).json({ error: "Invalid chat ID format" });
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       String(message).slice(0, 4096), // Telegram message limit
        parse_mode: "HTML",
      }),
    });

    const data = await r.json();
    if (!data.ok) {
      return res.status(400).json({ error: data.description || "Telegram API error" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ ok: true });
  } catch (err) {
    console.error("telegram error:", err.message);
    res.status(500).json({ error: "Failed to send Telegram message" });
  }
}
