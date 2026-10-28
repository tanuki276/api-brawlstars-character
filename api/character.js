import { extractToken, verifyToken } from '../lib/auth.js';
import { loadCharacters, selectCharacters } from '../lib/characters.js';
import { enrichCharacters, validateLevel } from '../lib/brawl-data.js';

const translationCache = new Map();

async function translateText(text, source, target) {
  if (!text || !target || source === target) return text;

  const cacheKey = `${source}:${target}:${text}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${source}|${target}`);

  try {
    const response = await fetch(url);
    if (!response.ok) return text;
    const data = await response.json();
    const translated = data?.responseData?.translatedText || text;
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (error) {
    console.error('Translation API error:', error);
    return text;
  }
}

async function localizeAbility(ability, lang) {
  if (lang === 'en') return ability;
  return {
    ...ability,
    nameEn: ability.name,
    name: await translateText(ability.name, 'en', lang),
    description: await translateText(ability.description, 'en', lang),
  };
}

function queryValue(value, fallback) {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
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
    const lang = queryValue(req.query.lang, 'ja');
    const rarity = queryValue(req.query.rarity, undefined);
    const role = queryValue(req.query.role, undefined);
    const count = queryValue(req.query.count, '1');
    const level = validateLevel(queryValue(req.query.level, '11'));

    if (level === null) {
      return res.status(400).json({ error: 'level must be an integer from 1 to 11' });
    }

    const rawBlockedIds = Array.isArray(req.query.blockedIds)
      ? req.query.blockedIds.join(',')
      : req.query.blockedIds || '';
    const blockedIds = rawBlockedIds.split(',').map((id) => id.trim()).filter(Boolean);

    const enriched = await enrichCharacters(loadCharacters(), level);
    const selected = selectCharacters(enriched, {
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

    const results = await Promise.all(selected.map(async (character) => ({
      id: character.id,
      name: lang === 'en' ? character.nameEn : character.name,
      nameEn: character.nameEn,
      image: character.image,
      rarity: lang === 'ja' ? character.rarity : await translateText(character.rarity, 'ja', lang),
      role: lang === 'ja' ? character.role : await translateText(character.role, 'ja', lang),
      description: lang === 'en'
        ? character.description
        : await translateText(character.description, 'en', lang),
      stats: character.stats,
      gadgets: await Promise.all(character.gadgets.map((ability) => localizeAbility(ability, lang))),
      starPowers: await Promise.all(character.starPowers.map((ability) => localizeAbility(ability, lang))),
    })));

    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    return res.status(200).json(results.length === 1 ? results[0] : results);
  } catch (error) {
    console.error('Character API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
