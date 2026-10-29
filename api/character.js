import { extractToken, verifyToken } from '../lib/auth.js';
import { loadCharacters, selectCharacters, validateCount } from '../lib/characters.js';
import { enrichCharacters, validateLevel } from '../lib/brawl-data.js';

const translationCache = new Map();
const MAX_TRANSLATIONS = 500;
const TRANSLATION_TTL_MS = 15 * 60 * 1000;

async function translateText(text, source, target) {
  if (!text || !target || source === target) return text;

  const cacheKey = `${source}:${target}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return cached.text;
  translationCache.delete(cacheKey);

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${source}|${target}`);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return text;
    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    if (Number(data?.responseStatus) !== 200 || typeof translated !== 'string' || !translated) return text;
    if (translationCache.size >= MAX_TRANSLATIONS) translationCache.delete(translationCache.keys().next().value);
    translationCache.set(cacheKey, { text: translated, expiresAt: Date.now() + TRANSLATION_TTL_MS });
    return translated;
  } catch (error) {
    console.error('Translation API error:', error);
    return text;
  }
}

async function localizeAbility(ability, lang) {
  if (lang === 'en') return ability;
  const [name, description] = await Promise.all([
    translateText(ability.name, 'en', lang),
    translateText(ability.description, 'en', lang),
  ]);
  return {
    ...ability,
    nameEn: ability.name,
    name,
    description,
  };
}

function queryValue(value, fallback) {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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
    const query = req.query || {};
    const rawLang = queryValue(query.lang, 'ja');
    if (typeof rawLang !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/i.test(rawLang)) {
      return res.status(400).json({ error: 'lang must be a language code such as ja or en' });
    }
    const lang = rawLang.toLowerCase();
    const rarity = queryValue(query.rarity, undefined);
    const role = queryValue(query.role, undefined);
    const count = validateCount(queryValue(query.count, '1'));
    const level = validateLevel(queryValue(query.level, '11'));

    if (count === null) {
      return res.status(400).json({ error: 'count must be a positive integer' });
    }

    if (level === null) {
      return res.status(400).json({ error: 'level must be an integer from 1 to 11' });
    }

    const rawBlockedIds = Array.isArray(query.blockedIds)
      ? query.blockedIds.join(',')
      : query.blockedIds || '';
    if (typeof rawBlockedIds !== 'string' || !/^(?:\s*\d*\s*,)*\s*\d*\s*$/.test(rawBlockedIds)) {
      return res.status(400).json({ error: 'blockedIds must contain comma-separated numeric IDs' });
    }
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

    const results = await Promise.all(selected.map(async (character) => {
      const [name, rarity, role, description, gadgets, starPowers] = await Promise.all([
        lang === 'ja' ? character.name : translateText(character.nameEn, 'en', lang),
        translateText(character.rarity, 'ja', lang),
        translateText(character.role, 'ja', lang),
        translateText(character.description, 'en', lang),
        Promise.all(character.gadgets.map((ability) => localizeAbility(ability, lang))),
        Promise.all(character.starPowers.map((ability) => localizeAbility(ability, lang))),
      ]);
      return {
        id: character.id,
        name,
        nameEn: character.nameEn,
        image: character.image,
        rarity,
        role,
        description,
        stats: character.stats,
        gadgets,
        starPowers,
      };
    }));

    return res.status(200).json(count === 1 ? results[0] : results);
  } catch (error) {
    console.error('Character API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
