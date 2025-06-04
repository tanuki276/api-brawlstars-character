import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const CHARACTER_PATH = path.join(process.cwd(), 'character.json');

app.use(express.json());

app.post('/api/token', (req, res) => {
  const { expiresIn } = req.body;
  let expires;
  if (expiresIn === 'never' || expiresIn === 0) {
    expires = '100y';
  } else if (typeof expiresIn === 'string') {
    expires = expiresIn;
  } else if (typeof expiresIn === 'number') {
    expires = `${expiresIn}s`;
  } else {
    expires = '1h';
  }

  const token = jwt.sign({ created: Date.now() }, SECRET_KEY, { expiresIn: expires });
  res.json({ token, expiresIn: expires });
});

async function translateText(text, target) {
  if (target === 'ja') return text;
  const encodedText = encodeURIComponent(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=ja|${target}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (e) {
    console.error('Translation API error:', e);
  }
  return text;
}

app.get('/api/character', async (req, res) => {
  const { token, lang = 'ja' } = req.query;
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    jwt.verify(token, SECRET_KEY);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const charactersRaw = fs.readFileSync(CHARACTER_PATH, 'utf8');
    const characters = JSON.parse(charactersRaw);
    const character = characters[Math.floor(Math.random() * characters.length)];
    const translatedRarity = await translateText(character.rarity, lang);
    const translatedRole = await translateText(character.role, lang);

    res.json({
      name: character.name,
      rarity: translatedRarity,
      role: translatedRole,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});