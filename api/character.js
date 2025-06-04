import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const CHARACTER_PATH = path.join(process.cwd(), 'character.json');

async function translateText(text, target) {
  if (target === 'ja') return text;

  const encodedText = encodeURIComponent(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=ja|${target}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (e) {
    console.error('Translation API error:', e);
  }

  return text;
}

export default async function handler(req, res) {
  const { token, lang = 'ja' } = req.query;

  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    jwt.verify(token, SECRET_KEY);
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const charactersRaw = fs.readFileSync(CHARACTER_PATH, 'utf8');
    const characters = JSON.parse(charactersRaw);
    const character = characters[Math.floor(Math.random() * characters.length)];

    const translatedRarity = await translateText(character.rarity, lang);
    const translatedRole = await translateText(character.role, lang);

    res.status(200).json({
      name: character.name,
      rarity: translatedRarity,
      role: translatedRole,
    });
  } catch (err) {
    console.error('Error reading or parsing character.json:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}