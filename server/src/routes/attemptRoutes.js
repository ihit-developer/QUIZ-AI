const express = require('express');
const router = express.Router();
const {
  startAttempt,
  autosaveAttempt,
  submitAttempt,
  getAttemptById,
} = require('../controllers/attemptController');

// Optional auth: allows guests or logged-in users
const optionalAuth = (req, res, next) => {
  const token =
    req.headers.authorization?.startsWith('Bearer')
      ? req.headers.authorization.split(' ')[1]
      : req.cookies?.accessToken;

  if (token) {
    try {
      const { verifyAccessToken } = require('../utils/token');
      req.user = verifyAccessToken(token);
    } catch {
      // Guest fallback
    }
  }
  next();
};

router.post('/start', optionalAuth, startAttempt);
router.put('/:attemptId/autosave', autosaveAttempt);
router.post('/:attemptId/submit', submitAttempt);
router.get('/:attemptId', getAttemptById);

module.exports = router;
