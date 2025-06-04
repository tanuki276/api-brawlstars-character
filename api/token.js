import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { expiresIn } = req.body;

  let expires;
  if (expiresIn === 'never') {
    expires = '100y';
  } else if (typeof expiresIn === 'string') {
    expires = expiresIn;
  } else {
    expires = '1h';
  }

  const token = jwt.sign(
    { created: Date.now() },
    SECRET_KEY,
    { expiresIn: expires }
  );

  res.status(200).json({ token, expiresIn: expires });
    }
