import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import tokenHandler from '../api/token.js';
import characterHandler from '../api/character.js';
import cookieHandler from '../api/cookie.js';
import { createToken, extractToken, verifyToken } from '../lib/auth.js';
import { loadCharacters, selectCharacters } from '../lib/characters.js';

const originalSecret = process.env.SECRET_KEY;
process.env.SECRET_KEY = 'test-only-secret';
afterEach(() => { mock.restoreAll(); process.env.SECRET_KEY = 'test-only-secret'; });
test.after(() => {
  if (originalSecret === undefined) delete process.env.SECRET_KEY;
  else process.env.SECRET_KEY = originalSecret;
});

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('finite expiry uses seconds consistently and returns the signed expiry', () => {
  for (const [input, seconds] of [[undefined, 3600], [3600, 3600], ['3600', 3600], ['1h', 3600], ['7d', 604800], ['1.5h', 5400]]) {
    const data = createToken(input);
    const payload = verifyToken(data.token);
    assert.equal(payload.exp - payload.iat, seconds);
    assert.equal(data.expiresAt, payload.exp * 1000);
    assert.equal(data.expiresIn, `${seconds}s`);
  }
});

test('unlimited tokens remain available without an exp claim', () => {
  for (const expiresIn of [0, '0', 'never']) {
    const res = response();
    tokenHandler({ method: 'POST', body: { expiresIn } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.expiresIn, 'never');
    assert.equal(res.body.expiresAt, 0);
    assert.equal(verifyToken(res.body.token).exp, undefined);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('invalid expiry returns 400, missing server secret returns 500', () => {
  for (const expiresIn of [-1, 0.1, null, true, {}, [], '', 'invalid', '-1h', '0.1s', Number.MAX_SAFE_INTEGER]) {
    const res = response();
    tokenHandler({ method: 'POST', body: { expiresIn } }, res);
    assert.equal(res.statusCode, 400, String(expiresIn));
  }
  const badBody = response();
  tokenHandler({ method: 'POST', body: 'not-json' }, badBody);
  assert.equal(badBody.statusCode, 400);
  delete process.env.SECRET_KEY;
  mock.method(console, 'error', () => {});
  const res = response();
  tokenHandler({ method: 'POST', body: {} }, res);
  assert.equal(res.statusCode, 500);
});

test('bearer scheme is case insensitive and query tokens remain compatible', () => {
  assert.equal(extractToken({ headers: { authorization: 'bearer abc' }, query: { token: 'fallback' } }), 'abc');
  assert.equal(extractToken({ headers: {}, query: { token: [' abc ', 'other'] } }), 'abc');
  assert.equal(extractToken({}), null);
});

test('verification rejects unsigned, expired, and unexpected algorithm tokens', () => {
  for (const token of [
    jwt.sign({}, '', { algorithm: 'none' }),
    jwt.sign({}, process.env.SECRET_KEY, { algorithm: 'HS384' }),
    jwt.sign({}, process.env.SECRET_KEY, { expiresIn: -1 }),
  ]) assert.throws(() => verifyToken(token));
});

test('all endpoints provide Allow and disable caching on method errors', async () => {
  for (const [handler, allow] of [[tokenHandler, 'POST'], [characterHandler, 'GET'], [cookieHandler, 'POST']]) {
    const res = response();
    await handler({ method: 'DELETE' }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, allow);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('character authentication rejects missing and invalid tokens', async () => {
  for (const [headers, expected] of [[{}, 400], [{ authorization: 'Bearer invalid' }, 401]]) {
    const res = response();
    await characterHandler({ method: 'GET', headers }, res);
    assert.equal(res.statusCode, expected);
  }
});

test('invalid character parameters are rejected before external requests', async () => {
  const fetch = mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch'); });
  for (const query of [
    { count: '2x' }, { count: '-1' }, { count: '1.5' }, { count: '0' },
    { level: '12' }, { level: '2x' }, { lang: 'ja|en' }, { blockedIds: 'abc' },
  ]) {
    const res = response();
    await characterHandler({ method: 'GET', headers: { authorization: `Bearer ${createToken('never').token}` }, query }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(query));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

const characterCsv = 'Name,InstanceID,Type,WeaponSkill,Hitpoints,Speed\nstring,int,string,string,int,int\nShelly,,Hero,Shotgun,3900,800\n';
const skillCsv = 'Name,Damage,RechargeTime,MaxCharge,CastingRange,NumBulletsInOneAttack\nstring,int,int,int,int,int\nShotgun,300,1500,3,23,5\n';
function externalData(url) {
  if (String(url).endsWith('characters.csv')) return new Response(characterCsv);
  if (String(url).endsWith('skills.csv')) return new Response(skillCsv);
  if (String(url).includes('brawlapi.com')) return Response.json({ list: [{
    id: 16000000, rarity: { name: 'Starting Brawler' }, class: { name: 'Damage Dealer' },
    description: 'Original description', gadgets: [], starPowers: [],
  }] });
  if (String(url).includes('mymemory')) return Response.json({ responseStatus: 429, responseData: { translatedText: 'Quota exceeded' } });
  throw new Error(`Unexpected URL ${url}`);
}

test('multi-count stays an array when filtering leaves one character, with scaled stats', async () => {
  const fetch = mock.method(globalThis, 'fetch', (url, options) => {
    assert.ok(options.signal);
    return Promise.resolve(externalData(url));
  });
  const res = response();
  await characterHandler({
    method: 'GET', headers: { authorization: `Bearer ${createToken('never').token}` },
    query: { count: '2', lang: 'EN', level: '11', blockedIds: loadCharacters().filter((item) => Number(item.id) !== 16000000).map((item) => item.id).join(',') },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].stats.health, 7800);
  assert.equal(res.body[0].stats.attackDamage, 600);
  assert.equal(res.body[0].rarity, '初期');
  assert.equal(res.body[0].role, 'アタッカー');
  assert.equal(fetch.mock.callCount(), 5); // Three data sources and two translations (which fall back).
});

test('translation errors are retried and successful translations are cached', async () => {
  const translations = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).includes('mymemory')) return externalData(url);
    assert.ok(options.signal);
    translations.push(String(url));
    return Response.json({ responseStatus: 200, responseData: { translatedText: `translated: ${url.searchParams.get('q')}` } });
  });
  const request = {
    method: 'GET', headers: { authorization: `Bearer ${createToken('never').token}` },
    query: { lang: 'en', blockedIds: loadCharacters().filter((item) => Number(item.id) !== 16000000).map((item) => item.id).join(',') },
  };
  const first = response();
  await characterHandler(request, first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.rarity, 'translated: 初期');
  assert.equal(translations.length, 2);
  const second = response();
  await characterHandler(request, second);
  assert.equal(second.statusCode, 200);
  assert.equal(translations.length, 2);
});

test('selection blocks IDs without changing the catalog or returning duplicates', () => {
  const characters = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const selected = selectCharacters(characters, { blockedIds: ['2'], count: 10 });
  assert.deepEqual(selected.map((item) => item.id).sort(), [1, 3]);
  assert.equal(characters.length, 3);
  assert.throws(() => selectCharacters(characters, { count: '2junk' }), RangeError);
});

test('external source failures preserve stale data and retry after 30 seconds', async () => {
  let now = 1000;
  mock.method(Date, 'now', () => now);
  let fail = false;
  mock.method(console, 'error', () => {});
  const fetch = mock.method(globalThis, 'fetch', async (url) => {
    if (fail) throw new Error('Offline');
    return externalData(url);
  });
  const { enrichCharacters } = await import('../lib/brawl-data.js?stale-test');
  const catalog = [{ id: 16000000 }];
  const initial = await enrichCharacters(catalog);
  assert.equal(initial[0].stats.health, 7800);
  now += 16 * 60 * 1000;
  fail = true;
  const stale = await enrichCharacters(catalog);
  assert.deepEqual(stale, initial);
  assert.equal(fetch.mock.callCount(), 6);
  now += 31_000;
  fail = false;
  await enrichCharacters(catalog);
  assert.equal(fetch.mock.callCount(), 9);
});

test('invalid cookie timestamps never call the configured webhook', async () => {
  const previous = process.env.DISCORD_WEBHOOK_URL;
  process.env.DISCORD_WEBHOOK_URL = 'https://example.invalid/webhook';
  try {
    const fetch = mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected webhook'); });
    for (const timestamp of [true, 1, [], 'not-a-date']) {
      const res = response();
      await cookieHandler({ method: 'POST', body: { consent: 'accepted', timestamp } }, res);
      assert.equal(res.statusCode, 400);
    }
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    if (previous === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = previous;
  }
});
