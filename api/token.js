import { createToken, InvalidExpiryError } from '../lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    return res.status(200).json(createToken(req.body?.expiresIn));
  } catch (error) {
    if (error instanceof InvalidExpiryError) return res.status(400).json({ error: error.message });
    console.error('Token API error:', error);
    return res.status(500).json({ error: 'Server authentication is not configured' });
  }
}
