const jwt = require('jsonwebtoken');

const signAccessToken = (user, sessionId = undefined) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      sid: sessionId,
    },
    process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_123',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

const signRefreshToken = (user, sessionId = undefined) => {
  return jwt.sign(
    { id: user._id || user.id, sid: sessionId },
    process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_123',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_123');
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_123');
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
