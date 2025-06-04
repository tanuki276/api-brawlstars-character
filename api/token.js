import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { expiresIn } = req.body;

  let signOptions = {};

  if (expiresIn === 'never') {
    signOptions = {};
  } else if (typeof expiresIn === 'string') {
    signOptions = { expiresIn };
  } else {
    signOptions = { expiresIn: '1h' };
  }

  const token = jwt.sign(
    { created: Date.now() },
    SECRET_KEY,
    signOptions
  );

  res.status(200).json({ token, expiresIn: signOptions.expiresIn || 'never' });
}