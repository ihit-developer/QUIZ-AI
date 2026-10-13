const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const scoringService = require('../services/scoringService');

// In-memory attempts map for fallback
const memoryAttempts = new Map();

// Helper to find a quiz in DB or memory
const findQuizByCodeOrId = async (identifier) => {
  let quiz = null;
  const cleanId = String(identifier).trim();
  try {
    quiz = await Quiz.findOne({
      $or: [
        { joinCode: cleanId.toUpperCase() },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null },
      ].filter(Boolean),
    });
  } catch (err) {
    console.error('Quiz lookup error:', err.message);
  }

  if (!quiz) {
    const { memoryQuizzes } = require('./quizController');
    quiz = memoryQuizzes?.get(cleanId.toUpperCase()) || memoryQuizzes?.get(cleanId);
  }
  return quiz;
};

// 1. Start or Resume Attempt
const startAttempt = async (req, res, next) => {
  try {
    const { joinCode, guestName } = req.body;
    const userId = req.user?._id || req.user?.id || null;

    if (!userId && !guestName) {
      return res.status(400).json({
        success: false,
        message: 'Must either be logged in or provide guest display name.',
      });
    }

    const quiz = await findQuizByCodeOrId(joinCode);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: `Quiz with code ${joinCode} not found`,
      });
    }

    if (quiz.status === 'draft') {
      return res.status(403).json({
        success: false,
        message: 'This quiz has not been published yet by the host.',
      });
    }

    if (quiz.status === 'closed' || quiz.status === 'archived') {
      return res.status(403).json({
        success: false,
        message: 'This quiz is closed and no longer accepting submissions.',
      });
    }

    if (quiz.mode === 'self_paced' && quiz.schedule?.endsAt && new Date() > new Date(quiz.schedule.endsAt)) {
      return res.status(403).json({
        success: false,
        message: 'The due date for this self-paced quiz has passed.',
      });
    }

    if (quiz.mode === 'live') {
      return res.status(400).json({
        success: false,
        isLiveRoom: true,
        liveUrl: `/live/${quiz.joinCode}`,
        message: 'This is a Live Multiplayer Quiz. Please enter the Live Arena waiting lobby!',
      });
    }

    if (quiz.settings?.requireLogin && !userId) {
      return res.status(403).json({
        success: false,
        message: 'This quiz strictly requires logging into an account.',
      });
    }

    const attemptId = 'att_' + Date.now();
    const startedAt = new Date();
    // Self-paced assessments are timed on the server as well as in the UI.
    // This prevents a delayed client submission from bypassing the limit.
    const expiresAt = quiz.mode === 'self_paced'
      ? new Date(startedAt.getTime() + (Number(quiz.settings?.timeLimitMinutes || 15) * 60 * 1000))
      : null;
    const guestSession = userId
      ? null
      : { name: guestName, guestId: 'guest_' + Math.random().toString(36).substring(2, 9) };

    let attempt;
    try {
      attempt = await Attempt.create({
        quizId: quiz._id || quiz.id,
        userId,
        guestSession,
        answers: [],
        status: 'in_progress',
        startedAt,
        expiresAt,
      });
    } catch {
      attempt = {
        id: attemptId,
        _id: attemptId,
        quizId: quiz._id || quiz.id,
        userId,
        guestSession,
        answers: [],
        violations: [],
        status: 'in_progress',
        startedAt,
        expiresAt,
      };
      memoryAttempts.set(attemptId, attempt);
    }

    // Retrieve real questions from database for this specific quiz
    let rawQuestions = [];
    try {
      rawQuestions = await Question.find({ quizId: quiz._id || quiz.id })
        .sort({ order: 1 })
        .select('-options.isCorrect -acceptedAnswers -explanation');
    } catch (err) {
      console.error('Error fetching questions:', err.message);
    }

    if (!rawQuestions || rawQuestions.length === 0) {
      const { memoryQuestions } = require('./quizController');
      const mem = memoryQuestions?.get(String(quiz._id || quiz.id)) || [];
      rawQuestions = mem.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ text: o.text })),
      }));
    }

    res.status(201).json({
      success: true,
      data: {
        attemptId: attempt._id || attempt.id,
        quiz: {
          id: quiz._id || quiz.id,
          title: quiz.title,
          settings: quiz.settings,
        },
        questions: rawQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Autosave answers & Record anti-cheat violation
const autosaveAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { answers, violation } = req.body;

    let attempt;
    try {
      attempt = await Attempt.findById(attemptId);
      if (attempt) {
        if (answers) attempt.answers = answers;
        if (violation) attempt.violations.push(violation);
        await attempt.save();
      }
    } catch {
      attempt = memoryAttempts.get(attemptId);
      if (attempt) {
        if (answers) attempt.answers = answers;
        if (violation) attempt.violations.push(violation);
      }
    }

    res.status(200).json({
      success: true,
      message: 'State autosaved successfully',
    });
  } catch (error) {
    next(error);
  }
};

// 3. Submit Attempt & Grade
const submitAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { answers, durationSeconds } = req.body;

    let attempt;
    try {
      attempt = await Attempt.findById(attemptId).populate('quizId');
    } catch {
      attempt = memoryAttempts.get(attemptId);
    }

    if (!attempt) {
      attempt = memoryAttempts.get(attemptId) || {
        id: attemptId,
        _id: attemptId,
        quizId: {
          id: 'demo_quiz_1',
          settings: { passingScorePercent: 60 },
        },
        violations: [],
      };
    }

    // Load actual quiz questions with correct answers for grading
    let fullQuestions = [];
    const targetQuizId = String(attempt.quizId?._id || attempt.quizId);
    try {
      fullQuestions = await Question.find({ quizId: targetQuizId });
    } catch (err) {
      console.error('Error fetching full questions:', err.message);
    }

    if (!fullQuestions || fullQuestions.length === 0) {
      const { memoryQuestions } = require('./quizController');
      fullQuestions = memoryQuestions?.get(targetQuizId) || [];
    }

    let quiz = attempt.quizId || { settings: { passingScorePercent: 60 } };
    if (typeof quiz === 'string') quiz = await findQuizByCodeOrId(quiz) || { settings: { passingScorePercent: 60 } };
    const submittedAt = new Date();
    const hasExpired = quiz.mode === 'self_paced' && attempt.expiresAt && submittedAt > new Date(attempt.expiresAt);
    const grading = await scoringService.evaluateAttempt(
      quiz,
      fullQuestions,
      answers || attempt.answers || [],
      durationSeconds
    );

    // Save final graded attempt
    try {
      if (attempt.save) {
        attempt.answers = grading.evaluatedAnswers;
        attempt.score = grading.score;
        attempt.percentage = grading.percentage;
        attempt.totalPointsPossible = grading.totalPointsPossible;
        attempt.passed = grading.passed;
        attempt.status = hasExpired ? 'timed_out' : 'submitted';
        attempt.submittedAt = submittedAt;
        attempt.durationSeconds = durationSeconds || 0;
        await attempt.save();
      }
    } catch {
      attempt.answers = grading.evaluatedAnswers;
      attempt.score = grading.score;
      attempt.percentage = grading.percentage;
      attempt.totalPointsPossible = grading.totalPointsPossible;
      attempt.passed = grading.passed;
      attempt.status = hasExpired ? 'timed_out' : 'submitted';
      attempt.submittedAt = submittedAt;
      attempt.durationSeconds = durationSeconds || 0;
      memoryAttempts.set(attemptId, attempt);
    }

    res.status(200).json({
      success: true,
      message: hasExpired ? 'Time limit reached. Your saved answers were submitted.' : 'Quiz submitted and graded successfully!',
      data: {
        score: grading.score,
        percentage: grading.percentage,
        totalPointsPossible: grading.totalPointsPossible,
        passed: grading.passed,
        durationSeconds,
        status: hasExpired ? 'timed_out' : 'submitted',
        evaluatedAnswers: grading.evaluatedAnswers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get Single Attempt Result by ID
const getAttemptById = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    let attempt;
    try {
      attempt = await Attempt.findById(attemptId).populate('quizId');
    } catch {
      attempt = memoryAttempts.get(attemptId);
    }

    if (!attempt) {
      attempt = memoryAttempts.get(attemptId);
    }

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        attempt,
        quiz: attempt.quizId,
        result: {
          score: attempt.score,
          percentage: attempt.percentage,
          totalPointsPossible: attempt.totalPointsPossible,
          passed: attempt.passed,
          durationSeconds: attempt.durationSeconds,
          status: attempt.status,
          evaluatedAnswers: attempt.answers || [],
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startAttempt,
  autosaveAttempt,
  submitAttempt,
  getAttemptById,
  memoryAttempts,
};
