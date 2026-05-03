// Telegram Bot API proxy — requires authenticated Supabase session
// POST { token, chatId, message }  |  Authorization: Bearer <jwt>
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });
  const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

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
