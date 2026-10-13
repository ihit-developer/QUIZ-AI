const express = require('express');
const router = express.Router();
const {
  getQuizAnalytics,
  exportAttemptsCSV,
  downloadCertificate,
} = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/export/certificate', downloadCertificate);
router.use(authenticate, authorize('host', 'admin'));
router.get('/:quizId/export/csv', exportAttemptsCSV);
router.get('/:quizId', getQuizAnalytics);

module.exports = router;
