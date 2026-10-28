import jwt from 'jsonwebtoken';

export function getSecretKey() {
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error('SECRET_KEY is not configured');
  }
  return secret;
}

export function extractToken(req) {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const queryToken = Array.isArray(req.query?.token)
    ? req.query.token[0]
    : req.query?.token;

  return typeof queryToken === 'string' && queryToken.trim()
    ? queryToken.trim()
    : null;
}

export function verifyToken(token) {
  return jwt.verify(token, getSecretKey());
}

export function createToken(expiresIn) {
  const payload = { created: Date.now() };
  const secret = getSecretKey();

  if (expiresIn === 0 || expiresIn === 'never') {
    return { token: jwt.sign(payload, secret), expiresIn: 'never' };
  }

  let normalizedExpiresIn;
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    normalizedExpiresIn = `${Math.floor(expiresIn)}s`;
  } else if (typeof expiresIn === 'string' && expiresIn.trim()) {
    normalizedExpiresIn = expiresIn.trim();
  } else {
    normalizedExpiresIn = '1h';
  }

  return {
    token: jwt.sign(payload, secret, { expiresIn: normalizedExpiresIn }),
    expiresIn: normalizedExpiresIn,
  };
}
