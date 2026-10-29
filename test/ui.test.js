import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class Element {
  constructor() {
    this.children = []; this.value = ''; this.textContent = ''; this.disabled = false;
    this.style = {}; this.classList = { toggle() {} }; this.listeners = {};
  }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}

function page({ tokens = [], blockedStorage = false } = {}) {
  const elements = new Map();
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) elements.set(match[1], new Element());
  const storage = new Map([['brawlstar_tokens', JSON.stringify(tokens)]]);
  const events = {};
  const context = vm.createContext({
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
      createElement() { return new Element(); },
      addEventListener(name, callback) { events[name] = callback; },
    },
    localStorage: {
      getItem(key) { if (blockedStorage) throw Error('Storage disabled'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('Storage disabled'); storage.set(key, value); },
    },
    Date, console, navigator: {}, alert() {},
    fetch: async () => { throw Error('Network unavailable'); },
  });
  vm.runInContext(script, context);
  return { context, elements, storage, events, run: (code) => vm.runInContext(code, context) };
}

test('stored tokens keep unlimited entries and discard malformed and expired entries', () => {
  const ui = page({ tokens: [null, { token: 123, expiresAt: 0 },
    { token: 'unlimited', expiresAt: 0 }, { token: 'expired', expiresAt: Date.now() - 1000 },
    { token: 'valid', expiresAt: Date.now() + 60_000 }, { token: 'invalid-date', expiresAt: 'never' },
  ] });
  assert.deepEqual(JSON.parse(ui.run('JSON.stringify(loadTokens())')).map((item) => item.token), ['unlimited', 'valid']);
  ui.events.DOMContentLoaded();
  assert.equal(ui.elements.get('tokenList').children.length, 2);
});

test('token actions use token identity when stored entries change after rendering', () => {
  const ui = page({ tokens: [{ token: 'first', expiresAt: 0 }, { token: 'second', expiresAt: 0 }] });
  ui.run('renderTokenList()');
  const secondRow = ui.elements.get('tokenList').children[1];
  ui.storage.set('brawlstar_tokens', JSON.stringify([{ token: 'second', expiresAt: 0 }]));
  secondRow.children[0].onclick();
  assert.equal(ui.elements.get('tokenOutput').value, 'second');
  secondRow.children[3].onclick();
  assert.equal(JSON.parse(ui.storage.get('brawlstar_tokens')).length, 0);
  assert.equal(ui.elements.get('tokenOutput').value, '');
  assert.equal(ui.elements.get('copyToken').disabled, true);
});

test('storage disabled does not prevent consent UI or token generation', async () => {
  const ui = page({ blockedStorage: true });
  ui.events.DOMContentLoaded();
  assert.equal(ui.elements.get('cookieConsent').style.display, 'block');
  ui.run("saveConsent('declined')");
  assert.equal(ui.elements.get('cookieConsent').style.display, 'none');
  ui.elements.get('expires').value = '0';
  ui.context.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).expiresIn, 'never');
    return { ok: true, json: async () => ({ token: 'unlimited-token', expiresIn: 'never', expiresAt: 0 }) };
  };
  await ui.run('generateToken()');
  assert.equal(ui.elements.get('tokenOutput').value, 'unlimited-token');
  assert.equal(ui.elements.get('copyToken').disabled, false);
  assert.match(ui.elements.get('tokenStatus').textContent, /保存できません/);
});

test('failed generation keeps the usable token and presents errors separately', async () => {
  const ui = page();
  ui.elements.get('tokenOutput').value = 'previous-token';
  await ui.run('generateToken()');
  assert.equal(ui.elements.get('tokenOutput').value, 'previous-token');
  assert.match(ui.elements.get('tokenStatus').textContent, /Network unavailable/);
  assert.equal(ui.elements.get('generateToken').disabled, false);
});

test('clipboard errors select the token for manual copying', async () => {
  const ui = page();
  ui.elements.get('tokenOutput').value = 'selected-token';
  await ui.run('copyTokenToClipboard()');
  assert.equal(ui.elements.get('tokenOutput').selected, true);
  assert.match(ui.elements.get('tokenStatus').textContent, /手動でコピー/);
});
