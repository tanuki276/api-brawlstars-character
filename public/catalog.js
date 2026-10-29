(() => {
  const byId = (id) => document.getElementById(id);
  const grid = byId('catalogGrid');
  const status = byId('catalogStatus');
  const favoriteKey = 'brawlchara_favorites';
  let favorites;
  try {
    const stored = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
    favorites = new Set(Array.isArray(stored) ? stored.filter((id) => /^\d+$/.test(String(id))).map(String).slice(0, 200) : []);
  } catch { favorites = new Set(); }
  globalThis.getCatalogFavoriteIds = () => [...favorites];
  let currentPage = 1;
  let totalPages = 0;
  let hasLoaded = false;
  let listController;
  let detailController;
  let timer;

  function updateFavorites() { byId('favoriteCount').textContent = String(favorites.size); }
  function pagination() {
    byId('catalogPage').textContent = `${totalPages ? currentPage : 0} / ${totalPages}`;
    byId('catalogPrev').disabled = currentPage <= 1 || !totalPages;
    byId('catalogNext').disabled = currentPage >= totalPages;
  }
  async function api(path, signal) {
    const token = byId('tokenOutput').value.trim();
    if (!token) throw Error('トークンを生成または選択してください。');
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal });
    const data = await response.json();
    if (!response.ok) throw Error(response.status === 401 ? 'トークンの有効期限が切れています。新しく生成してください。' : data.error || `HTTP ${response.status}`);
    return data;
  }
  function populate(id, values) {
    const select = byId(id);
    const selected = select.value;
    select.replaceChildren(new Option('すべて', ''));
    for (const value of values) select.add(new Option(value, value));
    select.value = values.includes(selected) ? selected : '';
  }
  async function details(id, button) {
    detailController?.abort();
    const controller = detailController = new AbortController();
    button.disabled = true;
    status.textContent = '詳細を取得中…';
    try {
      const params = new URLSearchParams({ id, level: byId('powerLevel').value });
      const character = await api(`/api/character?${params}`, controller.signal);
      if (controller.signal.aborted) return;
      renderCharacter(character);
      byId('characterResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
      status.textContent = `${character.name}の詳細を表示しました。`;
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error.message;
    } finally { button.disabled = false; }
  }
  function render(items) {
    grid.replaceChildren();
    for (const item of items) {
      const card = document.createElement('article'); card.className = 'catalog-card';
      const image = document.createElement('img'); image.src = item.image; image.alt = item.name; image.loading = 'lazy'; image.width = 88; image.height = 88;
      const heading = document.createElement('h3'); heading.textContent = item.name;
      const english = document.createElement('p'); english.className = 'muted'; english.textContent = item.nameEn;
      const meta = document.createElement('p'); meta.textContent = `${item.rarity} / ${item.role}`;
      const stats = document.createElement('p'); stats.className = 'catalog-stats'; stats.textContent = `HP ${item.stats?.health ?? '—'} · 攻撃 ${item.stats?.attackDamage ?? '—'}`;
      const actions = document.createElement('div'); actions.className = 'catalog-card-actions';
      const open = document.createElement('button'); open.type = 'button'; open.textContent = '詳細'; open.onclick = () => details(String(item.id), open);
      const favorite = document.createElement('button'); favorite.type = 'button';
      const sync = () => {
        const active = favorites.has(String(item.id));
        favorite.textContent = active ? '★' : '☆';
        favorite.setAttribute('aria-pressed', String(active));
        favorite.setAttribute('aria-label', `${item.name}をお気に入り${active ? 'から削除' : 'に追加'}`);
      };
      sync();
      favorite.onclick = () => {
        const id = String(item.id);
        if (favorites.has(id)) favorites.delete(id);
        else if (favorites.size < 200) favorites.add(id);
        else { status.textContent = 'お気に入りは200体まで登録できます。'; return; }
        sync(); updateFavorites();
        try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); }
        catch { status.textContent = 'お気に入りを保存できませんでした。この画面内では利用できます。'; }
        if (byId('favoritesOnly').checked) load(1);
      };
      actions.append(open, favorite); card.append(image, heading, english, meta, stats, actions); grid.appendChild(card);
    }
  }
  async function load(page = 1) {
    clearTimeout(timer);
    listController?.abort();
    const controller = listController = new AbortController();
    currentPage = page;
    byId('catalogPrev').disabled = true; byId('catalogNext').disabled = true;
    grid.setAttribute('aria-busy', 'true');
    status.textContent = '図鑑を読み込み中…';
    try {
      if (byId('favoritesOnly').checked && !favorites.size) {
        render([]); totalPages = 0; hasLoaded = true;
        status.textContent = 'お気に入りはまだありません。☆で追加できます。'; pagination(); return;
      }
      const params = new URLSearchParams({
        page: String(page), limit: '24', level: byId('powerLevel').value,
        q: byId('catalogSearch').value.trim(), rarity: byId('catalogRarity').value,
        role: byId('catalogRole').value, sort: byId('catalogSort').value,
      });
      if (byId('favoritesOnly').checked) params.set('ids', [...favorites].join(','));
      const data = await api(`/api/characters?${params}`, controller.signal);
      if (controller.signal.aborted) return;
      totalPages = data.totalPages; hasLoaded = true;
      populate('catalogRarity', data.filters.rarities); populate('catalogRole', data.filters.roles);
      render(data.items); pagination();
      status.textContent = data.total ? `${data.total}体中 ${(page - 1) * 24 + 1}〜${(page - 1) * 24 + data.items.length}体を表示 · パワー${byId('powerLevel').value}` : '条件に一致するキャラがいません。条件を変更してください。';
    } catch (error) {
      if (!controller.signal.aborted) { render([]); totalPages = 0; pagination(); status.textContent = error.message; }
    } finally { if (listController === controller) grid.setAttribute('aria-busy', 'false'); }
  }
  byId('catalogLoad').onclick = () => load(1);
  byId('catalogPrev').onclick = () => load(Math.max(1, currentPage - 1));
  byId('catalogNext').onclick = () => load(currentPage + 1);
  byId('catalogSearch').addEventListener('input', () => {
    listController?.abort();
    clearTimeout(timer); timer = setTimeout(() => load(1), 300);
  });
  for (const id of ['catalogRarity', 'catalogRole', 'catalogSort', 'favoritesOnly']) byId(id).addEventListener('change', () => load(1));
  byId('powerLevel').addEventListener('change', () => { detailController?.abort(); if (hasLoaded) load(1); });
  byId('catalogReset').onclick = () => {
    for (const id of ['catalogSearch', 'catalogRarity', 'catalogRole']) byId(id).value = '';
    byId('catalogSort').value = 'id'; byId('favoritesOnly').checked = false; load(1);
  };
  updateFavorites();
})();
