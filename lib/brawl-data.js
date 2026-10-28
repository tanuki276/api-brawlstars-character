const BRAWLERS_URL = 'https://api.brawlapi.com/v1/brawlers';
const GAME_CHARACTERS_URL = 'https://raw.githubusercontent.com/satishkhanal76/BrawlStats/main/public/assets/csv/csv_logic/characters.csv';
const GAME_SKILLS_URL = 'https://raw.githubusercontent.com/satishkhanal76/BrawlStats/main/public/assets/csv/csv_logic/skills.csv';
const CACHE_TTL_MS = 15 * 60 * 1000;

let cache = {
  expiresAt: 0,
  brawlers: new Map(),
  stats: new Map(),
};
let loadingPromise = null;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }

  if (value.length || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  );
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'BrawlChara/1.6' } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRarity(name) {
  const map = {
    'Starting Brawler': '初期',
    Common: '初期',
    Rare: 'レア',
    'Super Rare': 'スーパー',
    Epic: 'ハイパー',
    Mythic: 'ウルトラ',
    Legendary: 'レジェンド',
    'Ultra Legendary': 'ウルトラレジェンドレア',
  };
  return map[name] || name || '不明';
}

function normalizeRole(name) {
  const map = {
    'Damage Dealer': 'アタッカー',
    Tank: 'タンク',
    Marksman: 'スナイパー',
    Support: 'サポート',
    Controller: 'コントローラー',
    Assassin: 'アサシン',
    Artillery: 'グレネーディア',
  };
  return map[name] || (name && name !== 'Unknown' ? name : '不明');
}

async function refreshExternalData() {
  const next = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    brawlers: new Map(),
    stats: new Map(),
  };

  const requests = await Promise.allSettled([
    fetch(BRAWLERS_URL, { headers: { 'User-Agent': 'BrawlChara/1.6' } }).then(async (response) => {
      if (!response.ok) throw new Error(`BrawlAPI returned ${response.status}`);
      return response.json();
    }),
    Promise.all([fetchText(GAME_CHARACTERS_URL), fetchText(GAME_SKILLS_URL)]),
  ]);

  if (requests[0].status === 'fulfilled') {
    for (const brawler of requests[0].value?.list || []) {
      next.brawlers.set(Number(brawler.id), brawler);
    }
  } else {
    console.error('BrawlAPI data error:', requests[0].reason);
  }

  if (requests[1].status === 'fulfilled') {
    const [charactersCsv, skillsCsv] = requests[1].value;
    const characterRows = parseCsv(charactersCsv);
    const skillRows = parseCsv(skillsCsv);
    const skills = new Map(skillRows.map((skill) => [skill.Name, skill]));

    for (const row of characterRows) {
      if (row.Type !== 'Hero' || !row.WeaponSkill) continue;
      const instanceId = toNumber(row.InstanceID) ?? 0;
      const id = 16000000 + instanceId;
      const weapon = skills.get(row.WeaponSkill);
      if (!weapon) continue;

      next.stats.set(id, {
        healthLevel1: toNumber(row.Hitpoints),
        moveSpeed: toNumber(row.Speed),
        attackDamageLevel1: toNumber(weapon.Damage),
        reloadMs: toNumber(weapon.RechargeTime),
        ammo: toNumber(weapon.MaxCharge),
        range: toNumber(weapon.CastingRange) !== null
          ? Math.round((Number(weapon.CastingRange) / 3) * 100) / 100
          : null,
        projectilesPerAttack: toNumber(weapon.NumBulletsInOneAttack),
      });
    }
  } else {
    console.error('Game data error:', requests[1].reason);
  }

  if (next.brawlers.size === 0 && cache.brawlers.size > 0) next.brawlers = cache.brawlers;
  if (next.stats.size === 0 && cache.stats.size > 0) next.stats = cache.stats;
  cache = next;
  return cache;
}

async function loadExternalData() {
  if (cache.expiresAt > Date.now()) return cache;
  if (!loadingPromise) {
    loadingPromise = refreshExternalData().finally(() => {
      loadingPromise = null;
    });
  }
  return loadingPromise;
}

function scaleStat(baseValue, level) {
  if (!Number.isFinite(baseValue)) return null;
  return Math.round(baseValue * (1 + (level - 1) * 0.1));
}

function cleanAbility(ability) {
  return {
    id: ability.id,
    name: ability.name,
    description: ability.description || '',
    image: ability.imageUrl || null,
  };
}

function buildCharacter(character, level, data) {
  const brawler = data.brawlers.get(Number(character.id));
  const baseStats = data.stats.get(Number(character.id));
  const stats = baseStats
    ? {
        level,
        health: scaleStat(baseStats.healthLevel1, level),
        attackDamage: scaleStat(baseStats.attackDamageLevel1, level),
        projectilesPerAttack: baseStats.projectilesPerAttack,
        reloadMs: baseStats.reloadMs,
        range: baseStats.range,
        moveSpeed: baseStats.moveSpeed,
        ammo: baseStats.ammo,
      }
    : null;

  return {
    ...character,
    image: brawler?.imageUrl2 || character.image,
    rarity: normalizeRarity(brawler?.rarity?.name),
    role: normalizeRole(brawler?.class?.name),
    description: brawler?.description || '',
    stats,
    gadgets: (brawler?.gadgets || []).filter((item) => item.released !== false).map(cleanAbility),
    starPowers: (brawler?.starPowers || []).filter((item) => item.released !== false).map(cleanAbility),
  };
}

export async function enrichCharacters(characters, level = 11) {
  const data = await loadExternalData();
  return characters.map((character) => buildCharacter(character, level, data));
}

export async function enrichCharacter(character, level = 11) {
  const [result] = await enrichCharacters([character], level);
  return result;
}

export function validateLevel(rawLevel) {
  const level = Number.parseInt(rawLevel ?? '11', 10);
  if (!Number.isInteger(level) || level < 1 || level > 11) return null;
  return level;
}
