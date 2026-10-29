import { extractToken, verifyToken } from '../lib/auth.js';
import { loadCharacters } from '../lib/characters.js';
import { enrichCharacters, validateLevel } from '../lib/brawl-data.js';
import { catalogPage } from '../lib/catalog.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = extractToken(req);
  if (!token) return res.status(400).json({ error: 'Token is required' });
  try { verifyToken(token); }
  catch (error) {
    return res.status(error.message === 'SECRET_KEY is not configured' ? 500 : 401)
      .json({ error: error.message === 'SECRET_KEY is not configured' ? 'Server authentication is not configured' : 'Invalid or expired token' });
  }
  const query = req.query || {};
  const scalar = (key, fallback) => Array.isArray(query[key]) ? query[key][0] ?? fallback : query[key] ?? fallback;
  const positive = (value, maximum) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= maximum;
  const page = scalar('page', '1');
  const limit = scalar('limit', '24');
  const level = validateLevel(scalar('level', '11'));
  const q = scalar('q', '');
  const rarity = scalar('rarity', '');
  const role = scalar('role', '');
  const sort = scalar('sort', 'id');
  const ids = scalar('ids', undefined);
  if (!positive(page, 1_000_000) || !positive(limit, 100) || level === null ||
      typeof q !== 'string' || q.length > 100 || typeof rarity !== 'string' || typeof role !== 'string' ||
      !['id', '-id', 'name', '-name', 'health', '-health', 'attackDamage', '-attackDamage'].includes(sort) ||
      (ids !== undefined && (typeof ids !== 'string' || !/^\d+(?:,\d+)*$/.test(ids) || ids.split(',').length > 200))) {
    return res.status(400).json({ error: 'Invalid catalog parameters: page >= 1, limit 1–100, level 1–11, q up to 100 characters, numeric ids, or supported sort required' });
  }
  try {
    const characters = await enrichCharacters(loadCharacters(), level);
    const result = catalogPage(characters, { q, rarity, role, ids: ids?.split(','), page: Number(page), limit: Number(limit), sort });
    // List browsing avoids translation calls; the detail endpoint localizes abilities.
    result.items = result.items.map(({ id, name, nameEn, image, rarity, role, stats }) => ({ id, name, nameEn, image, rarity, role, stats }));
    return res.status(200).json(result);
  } catch (error) {
    console.error('Catalog API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
