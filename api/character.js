import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const DATA_PATH = path.join(process.cwd(), 'data.json');

export default async function handler(req, res) {
  const { token, query } = req.query;

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

  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  try {
    const rawData = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(rawData);
    const keywords = data.keywords;
    const defaultResponse = data.default_response;

    let response = defaultResponse;

    for (const key of Object.keys(keywords)) {
      if (query === key) {
        response = keywords[key];
        break;
      }
      if (query.startsWith(key) && query.length > key.length) {
        response = keywords[key];
        break;
      }
      if (query.includes(key)) {
        response = keywords[key];
        break;
      }
    }

    res.status(200).json({ response });
  } catch (err) {
    console.error('Error reading or parsing data.json:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}