const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    const decoded = verifyAccessToken(token);
    let user;

    try {
      user = await User.findById(decoded.id);
    } catch {
      // Offline fallback handling
    }

    if (!user) {
      // Preserve the full in-memory profile (including avatar) when MongoDB
      // is unavailable, instead of rebuilding a partial user from the token.
      const { memoryUsers } = require('../controllers/authController');
      user = Array.from(memoryUsers.values()).find((candidate) =>
        String(candidate.id || candidate._id) === String(decoded.id) || candidate.email === decoded.email
      );
      if (!user) {
        user = {
          _id: decoded.id,
          id: decoded.id,
          name: decoded.name || 'User',
          email: decoded.email,
          role: decoded.role || 'participant',
          isBlocked: false,
          avatar: '',
          bio: '',
        };
      }
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended. Please contact platform support.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token.',
      error: error.message,
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user?.role || 'anonymous'}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
