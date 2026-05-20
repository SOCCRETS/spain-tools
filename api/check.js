// api/check.js
// Checks if a directory name is already taken in Redis

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  return json.result; // null if not found
}

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  const slug = name.trim().toLowerCase();

  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Name can only contain letters, numbers, hyphens, underscores' });
  }

  try {
    const existing = await redisGet(`slot:${slug}`);
    return res.status(200).json({ available: existing === null });
  } catch (err) {
    return res.status(500).json({ error: 'Redis error', detail: err.message });
  }
}
