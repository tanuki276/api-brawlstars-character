import fs from 'node:fs/promises';
import path from 'node:path';

const CATALOG_PATH = path.join(process.cwd(), 'character.json');
const BRAWLERS_URL = 'https://api.brawlapi.com/v1/brawlers';

const current = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
const currentCharacters = Array.isArray(current) ? current : current.characters || [];
const charactersById = new Map(
  currentCharacters.map((character) => [Number(character.id), { ...character }])
);

const response = await fetch(BRAWLERS_URL, {
  headers: { 'User-Agent': 'BrawlChara-data-sync/1.0' },
});
if (!response.ok) throw new Error(`BrawlAPI returned ${response.status}`);
const data = await response.json();

for (const brawler of data.list || []) {
  if (brawler.released === false) continue;
  const id = Number(brawler.id);
  const existing = charactersById.get(id);
  charactersById.set(id, {
    id,
    name: existing?.name || brawler.name,
    nameEn: brawler.name,
    image: brawler.imageUrl2 || existing?.image || `https://cdn.brawlify.com/brawlers/borderless/${id}.png`,
  });
}

const characters = [...charactersById.values()].sort((a, b) => Number(a.id) - Number(b.id));
const output = {
  updatedAt: new Date().toISOString().slice(0, 10),
  sources: {
    brawlers: BRAWLERS_URL,
    gameData: 'https://github.com/satishkhanal76/BrawlStats/tree/main/public/assets/csv/csv_logic',
  },
  characters,
};

await fs.writeFile(CATALOG_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Updated character.json with ${characters.length} catalog entries.`);
