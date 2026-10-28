import fs from 'node:fs/promises';
import path from 'node:path';

const CATALOG_PATH = path.join(process.cwd(), 'character.json');
const BRAWLERS_URL = 'https://api.brawlapi.com/v1/brawlers';

const current = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
const currentCharacters = Array.isArray(current) ? current : current.characters || [];
const namesById = new Map(currentCharacters.map((character) => [Number(character.id), character.name]));

const response = await fetch(BRAWLERS_URL, { headers: { 'User-Agent': 'BrawlChara-data-sync/1.0' } });
if (!response.ok) throw new Error(`BrawlAPI returned ${response.status}`);
const data = await response.json();

const characters = (data.list || [])
  .filter((brawler) => brawler.released !== false)
  .map((brawler) => ({
    id: Number(brawler.id),
    name: namesById.get(Number(brawler.id)) || brawler.name,
    nameEn: brawler.name,
    image: brawler.imageUrl2 || `https://cdn.brawlify.com/brawlers/borderless/${brawler.id}.png`,
  }))
  .sort((a, b) => a.id - b.id);

const output = {
  updatedAt: new Date().toISOString().slice(0, 10),
  sources: {
    brawlers: BRAWLERS_URL,
    gameData: 'https://github.com/satishkhanal76/BrawlStats/tree/main/public/assets/csv/csv_logic',
  },
  characters,
};

await fs.writeFile(CATALOG_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Updated character.json with ${characters.length} released brawlers.`);
