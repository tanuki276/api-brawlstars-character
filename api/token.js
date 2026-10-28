import { createToken } from '../lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, expiresIn } = createToken(req.body?.expiresIn);
    return res.status(200).json({ token, expiresIn });
  } catch (error) {
    console.error('Token API error:', error);
    return res.status(500).json({ error: 'Server authentication is not configured' });
  }
}
