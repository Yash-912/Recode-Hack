const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dropzone-jwt-secret-dev';
const JWT_EXPIRY = '24h';

/**
 * Sign a JWT with the given payload.
 * @param {object} payload - e.g. { userId: '...' }
 * @returns {string} signed JWT
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {JsonWebTokenError} if invalid
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: authenticate via Bearer token.
 * Sets req.user = { userId } on success.
 * Returns 401 on missing/invalid token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token', message: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid or expired token' });
  }
}

/**
 * Express middleware: verify admin access via X-Admin-Token header.
 * Returns 403 on missing/incorrect token.
 */
function verifyAdmin(req, res, next) {
  const adminToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || 'dropzone-admin-secret';

  if (!adminToken || adminToken !== expectedToken) {
    return res.status(403).json({ error: 'forbidden', message: 'Invalid admin token' });
  }

  next();
}

module.exports = { signToken, verifyToken, authenticate, verifyAdmin };
