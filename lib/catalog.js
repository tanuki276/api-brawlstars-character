export function searchKey(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export function searchCharacters(characters, query = '') {
  const words = searchKey(query).trim().split(/\s+/).filter(Boolean);
  return characters.filter((character) => {
    const text = searchKey(`${character.id} ${character.name} ${character.nameEn}`);
    return words.every((word) => text.includes(word));
  });
}

export function catalogPage(characters, { q = '', rarity, role, ids, page = 1, limit = 24, sort = 'id' } = {}) {
  let items = searchCharacters(characters, q);
  if (rarity) items = items.filter((item) => item.rarity === rarity);
  if (role) items = items.filter((item) => item.role === role);
  if (ids) {
    const selected = new Set(ids.map(String));
    items = items.filter((item) => selected.has(String(item.id)));
  }
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  items.sort((a, b) => {
    const left = field === 'health' || field === 'attackDamage' ? a.stats?.[field] : a[field];
    const right = field === 'health' || field === 'attackDamage' ? b.stats?.[field] : b[field];
    if (left == null && right != null) return 1;
    if (right == null && left != null) return -1;
    const difference = field === 'name' ? String(left ?? '').localeCompare(String(right ?? ''), 'ja') : (left ?? 0) - (right ?? 0);
    return difference * (descending ? -1 : 1) || Number(a.id) - Number(b.id);
  });
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total: items.length, page, limit, totalPages: Math.ceil(items.length / limit),
    filters: {
      rarities: [...new Set(characters.map((item) => item.rarity))].sort(),
      roles: [...new Set(characters.map((item) => item.role))].sort(),
    },
  };
}
