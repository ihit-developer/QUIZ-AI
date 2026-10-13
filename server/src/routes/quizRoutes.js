const express = require('express');
const router = express.Router();
const {
  createQuiz,
  getMyQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  getQuizByCode,
  getAvailableSelfPacedQuizzes,
  generateAIQuestions,
} = require('../controllers/quizController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  quizSchema,
  generateAISchema,
} = require('../validators/quizValidator');
const { validate } = require('../validators/authValidator');

// Public route for participants/guests to get quiz info via 6-digit code
router.get('/join/:code', getQuizByCode);
router.get('/available', getAvailableSelfPacedQuizzes);

// AI Question Generator for hosts and admins
router.post(
  '/ai/generate-questions',
  authenticate,
  authorize('host'),
  validate(generateAISchema),
  generateAIQuestions
);

// Quiz creation & host management
router.post(
  '/',
  authenticate,
  authorize('host'),
  validate(quizSchema),
  createQuiz
);

router.get('/my-quizzes', authenticate, getMyQuizzes);

// CRUD routes by ID
router.get('/:id', authenticate, getQuizById);
router.put('/:id', authenticate, authorize('host'), updateQuiz);
router.delete('/:id', authenticate, authorize('host'), deleteQuiz);

module.exports = router;
