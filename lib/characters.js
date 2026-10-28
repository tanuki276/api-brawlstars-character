import fs from 'fs';
import path from 'path';

const CHARACTER_PATH = path.join(process.cwd(), 'character.json');

export function loadCharacters() {
  const raw = fs.readFileSync(CHARACTER_PATH, 'utf8');
  const data = JSON.parse(raw);
  const characters = Array.isArray(data) ? data : data.characters;

  if (!Array.isArray(characters)) {
    throw new Error('character.json does not contain a character list');
  }

  return characters.map((character, index) => ({
    id: character.id ?? String(index + 1),
    ...character,
  }));
}

export function selectCharacters(characters, { rarity, role, blockedIds = [], count = 1 }) {
  let filtered = [...characters];

  if (rarity) {
    filtered = filtered.filter((character) => character.rarity === rarity);
  }

  if (role) {
    filtered = filtered.filter((character) => character.role === role);
  }

  if (blockedIds.length > 0) {
    const blocked = new Set(blockedIds.map(String));
    filtered = filtered.filter((character) => !blocked.has(String(character.id)));
  }

  if (filtered.length === 0) return [];

  const requestedCount = Number.parseInt(count, 10);
  const numberToRetrieve = Math.max(
    1,
    Math.min(Number.isFinite(requestedCount) ? requestedCount : 1, filtered.length)
  );

  const selected = [];
  for (let i = 0; i < numberToRetrieve; i += 1) {
    const randomIndex = Math.floor(Math.random() * filtered.length);
    selected.push(filtered.splice(randomIndex, 1)[0]);
  }

  return selected;
}
