import { extractToken, verifyToken } from '../lib/auth.js';
import { loadCharacters, selectCharacters } from '../lib/characters.js';

async function translateText(text, target) {
  if (!target || target === 'ja') return text;

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `ja|${target}`);

  try {
    const response = await fetch(url);
    if (!response.ok) return text;

    const data = await response.json();
    return data?.responseData?.translatedText || text;
  } catch (error) {
    console.error('Translation API error:', error);
    return text;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    verifyToken(token);
  } catch (error) {
    if (error?.message === 'SECRET_KEY is not configured') {
      console.error(error.message);
      return res.status(500).json({ error: 'Server authentication is not configured' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const lang = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang || 'ja';
    const rarity = Array.isArray(req.query.rarity) ? req.query.rarity[0] : req.query.rarity;
    const role = Array.isArray(req.query.role) ? req.query.role[0] : req.query.role;
    const count = Array.isArray(req.query.count) ? req.query.count[0] : req.query.count || '1';
    const rawBlockedIds = Array.isArray(req.query.blockedIds)
      ? req.query.blockedIds.join(',')
      : req.query.blockedIds || '';

    const blockedIds = rawBlockedIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const selected = selectCharacters(loadCharacters(), {
      rarity,
      role,
      blockedIds,
      count,
    });

    if (selected.length === 0) {
      return res.status(404).json({
        error: 'No characters found with the specified criteria after filtering and blocking.',
      });
    }

    const results = await Promise.all(
      selected.map(async (character) => ({
        id: character.id,
        name: character.name,
        rarity: await translateText(character.rarity, lang),
        role: await translateText(character.role, lang),
      }))
    );

    return res.status(200).json(results.length === 1 ? results[0] : results);
  } catch (error) {
    console.error('Character API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
