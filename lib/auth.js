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
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(\S+)\s*$/i);
    if (match) return match[1];
  }

  const queryToken = Array.isArray(req.query?.token)
    ? req.query.token[0]
    : req.query?.token;

  return typeof queryToken === 'string' && queryToken.trim()
    ? queryToken.trim()
    : null;
}

export function verifyToken(token) {
  return jwt.verify(token, getSecretKey(), { algorithms: ['HS256'] });
}

export class InvalidExpiryError extends Error {}

function expirySeconds(value) {
  if (value === undefined) return 3600;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|w|y)?$/i);
    if (match) {
      const multiplier = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31557600 };
      const seconds = Number(match[1]) * (multiplier[match[2]?.toLowerCase()] || 1);
      if (Number.isSafeInteger(seconds) && seconds > 0) return seconds;
    }
  }
  throw new InvalidExpiryError('expiresIn must be positive whole seconds, a duration such as 1h or 7d, 0, or never');
}

export function createToken(expiresIn) {
  const payload = { created: Date.now() };
  if (expiresIn === 0 || expiresIn === '0' || expiresIn === 'never') {
    return { token: jwt.sign(payload, getSecretKey(), { algorithm: 'HS256' }), expiresIn: 'never', expiresAt: 0 };
  }

  const seconds = expirySeconds(expiresIn);
  if (!Number.isSafeInteger(seconds + Math.floor(Date.now() / 1000)) ||
      seconds + Math.floor(Date.now() / 1000) > 8.64e12) {
    throw new InvalidExpiryError('expiresIn is too large');
  }
  const token = jwt.sign(payload, getSecretKey(), { algorithm: 'HS256', expiresIn: seconds });
  return {
    token,
    expiresIn: `${seconds}s`,
    expiresAt: jwt.decode(token).exp * 1000,
  };
}
