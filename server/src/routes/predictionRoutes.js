const express = require('express');
const router = express.Router();
const {
  getStudentPredictions,
  getCohortInsights,
} = require('../controllers/predictionController');

const { authenticate } = require('../middleware/auth');

router.get('/student', authenticate, getStudentPredictions);
router.get('/cohort/:quizId', authenticate, getCohortInsights);

module.exports = router;
