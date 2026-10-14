const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const { generateJoinCode } = require('../utils/codeGenerator');
const { generateQRCodeDataUrl } = require('../services/qrService');
const aiService = require('../services/aiService');

// In-memory fallback repository for quizzes when MongoDB is offline
const memoryQuizzes = new Map();
const memoryQuestions = new Map();
const publicAppUrl = (req) => `${req.protocol}://${req.get('host')}`;

// Helper to seed initial demo quiz
const seedDemoQuiz = async () => {
  if (memoryQuizzes.size === 0) {
    const demoCode = 'JS8821';
    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const joinUrl = `${clientBaseUrl}/join/${demoCode}`;
    const qrCode = await generateQRCodeDataUrl(joinUrl);

    const quiz = {
      id: 'demo_quiz_1',
      _id: 'demo_quiz_1',
      title: 'JavaScript Fundamentals & ES6+ Mastery',
      description: 'Test your understanding of closures, event loop, promises, and modern ES2024 features.',
      category: 'Computer Science',
      hostId: 'host_id_002',
      joinCode: demoCode,
      qrCodeDataUrl: qrCode,
      status: 'published',
      mode: 'self_paced',
      totalPoints: 30,
      totalQuestions: 3,
      settings: {
        timeLimitMinutes: 10,
        perQuestionTimer: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        attemptsAllowed: 1,
        passingScorePercent: 60,
        negativeMarking: false,
        allowGuests: true,
        requireLogin: false,
        showResultsImmediately: true,
        showCorrectAnswersAfterSubmit: true,
        antiCheat: {
          enforceFullscreen: false,
          detectTabSwitch: true,
          disableCopyPaste: true,
          maxViolationsAllowed: 3,
        },
      },
      createdAt: new Date(),
    };
    memoryQuizzes.set(demoCode, quiz);

    const questions = [
      {
        id: 'q1',
        _id: 'q1',
        quizId: 'demo_quiz_1',
        title: 'Which output is produced by `console.log(typeof NaN)` in JavaScript?',
        type: 'mcq_single',
        difficulty: 'easy',
        topicTag: 'JavaScript Basics',
        points: 10,
        timeLimitSeconds: 30,
        explanation: 'In JavaScript, NaN is a numeric value representing Not-a-Number, so typeof NaN is "number".',
        options: [
          { text: '"number"', isCorrect: true },
          { text: '"undefined"', isCorrect: false },
          { text: '"nan"', isCorrect: false },
          { text: '"object"', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        _id: 'q2',
        quizId: 'demo_quiz_1',
        title: 'Which microtask queue mechanism executes before the next event loop macro-task?',
        type: 'mcq_single',
        difficulty: 'medium',
        topicTag: 'Event Loop',
        points: 10,
        timeLimitSeconds: 30,
        explanation: 'Promise.then callbacks and process.nextTick reside in microtask queues executed immediately after stack clearance.',
        options: [
          { text: 'Promise.then handlers', isCorrect: true },
          { text: 'setTimeout(..., 0)', isCorrect: false },
          { text: 'setImmediate', isCorrect: false },
          { text: 'requestAnimationFrame', isCorrect: false },
        ],
      },
      {
        id: 'q3',
        _id: 'q3',
        quizId: 'demo_quiz_1',
        title: 'What is the key benefit of WeakMap over standard Map in memory management?',
        type: 'mcq_single',
        difficulty: 'hard',
        topicTag: 'Memory & Garbage Collection',
        points: 10,
        timeLimitSeconds: 45,
        explanation: 'Keys in WeakMap are weakly referenced, enabling automatic garbage collection when no other references exist.',
        options: [
          { text: 'Keys are weakly referenced allowing garbage collection of unused objects', isCorrect: true },
          { text: 'It can store primitive integers as keys with zero hashing cost', isCorrect: false },
          { text: 'It allows deterministic ordering of keys during iteration', isCorrect: false },
          { text: 'It synchronizes state across Web Workers automatically', isCorrect: false },
        ],
      },
    ];
    memoryQuestions.set('demo_quiz_1', questions);
  }
};
seedDemoQuiz();

// 1. Create or Draft Quiz
const createQuiz = async (req, res, next) => {
  try {
    const { title, description, category, mode, settings, schedule, questions, tags } = req.body;
    const hostId = req.user._id || req.user.id;

    // Generate unique 6-character join code
    let joinCode = generateJoinCode(6);
    const clientBaseUrl = publicAppUrl(req);
    const joinUrl = `${clientBaseUrl}/join/${joinCode}`;
    const qrCodeDataUrl = await generateQRCodeDataUrl(joinUrl);

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);

    let createdQuiz;
    try {
      createdQuiz = await Quiz.create({
        title,
        description,
        category,
        hostId,
        joinCode,
        qrCodeDataUrl,
        status: 'published',
        mode: mode || 'self_paced',
        settings,
        schedule,
        totalPoints,
        totalQuestions: questions.length,
        tags: tags || [],
      });

      // Save questions in DB
      const questionDocs = questions.map((q, idx) => ({
        ...q,
        quizId: createdQuiz._id,
        order: idx,
      }));
      await Question.insertMany(questionDocs);
    } catch {
      // Memory fallback
      const qId = 'quiz_' + Date.now();
      createdQuiz = {
        id: qId,
        _id: qId,
        title,
        description,
        category,
        hostId,
        joinCode,
        qrCodeDataUrl,
        status: 'published',
        mode: mode || 'self_paced',
        settings,
        schedule,
        totalPoints,
        totalQuestions: questions.length,
        tags: tags || [],
        createdAt: new Date(),
      };
      memoryQuizzes.set(joinCode, createdQuiz);
      memoryQuestions.set(qId, questions.map((q, idx) => ({ ...q, id: `q_${qId}_${idx}`, _id: `q_${qId}_${idx}`, quizId: qId })));
    }

    res.status(201).json({
      success: true,
      message: 'Quiz created and published successfully!',
      data: {
        quiz: createdQuiz,
        joinCode,
        joinUrl,
        qrCodeDataUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Quizzes by Host or Participant
const getMyQuizzes = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    let quizzes = [];

    if (req.user.role === 'participant') {
      try {
        const Attempt = require('../models/Attempt');
        const attempts = await Attempt.find({ userId }).populate('quizId');
        quizzes = attempts
          .filter((a) => a.quizId)
          .map((a) => ({
            ...a.quizId.toObject(),
            attemptScore: a.score,
            attemptPercentage: a.percentage,
            attemptPassed: a.passed,
            attemptStatus: a.status,
          }));
      } catch {
        quizzes = [];
      }
    } else {
      try {
        quizzes = await Quiz.find({ hostId: userId }).sort({ createdAt: -1 });
      } catch {
        quizzes = Array.from(memoryQuizzes.values()).filter(
          (q) => String(q.hostId) === String(userId)
        );
      }
    }

    res.status(200).json({
      success: true,
      data: { quizzes },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Single Quiz by Join Code (Public for participants/lobby)
const getQuizByCode = async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    let quiz = null;

    try {
      quiz = await Quiz.findOne({ joinCode: code });
    } catch {
      quiz = memoryQuizzes.get(code);
    }

    if (!quiz) {
      quiz = memoryQuizzes.get(code);
    }

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: `Quiz with code "${code}" not found. Please verify the code.`,
      });
    }

    // Never leak answers in the public lobby endpoint
    let questions = [];
    try {
      const docs = await Question.find({ quizId: quiz._id || quiz.id }).select('-options.isCorrect -acceptedAnswers -explanation');
      questions = docs;
    } catch {
      const memDocs = memoryQuestions.get(quiz.id || quiz._id) || [];
      questions = memDocs.map((q) => ({
        ...q,
        options: q.options.map((opt) => ({ text: opt.text })),
        explanation: undefined,
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        quiz: {
          id: quiz._id || quiz.id,
          title: quiz.title,
          description: quiz.description,
          category: quiz.category,
          status: quiz.status,
          mode: quiz.mode,
          settings: quiz.settings,
          totalPoints: quiz.totalPoints,
          totalQuestions: quiz.totalQuestions,
          hostId: quiz.hostId,
          joinCode: quiz.joinCode,
          qrCodeDataUrl: quiz.qrCodeDataUrl,
        },
        questionsCount: questions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAvailableSelfPacedQuizzes = async (req, res, next) => {
  try {
    const now = new Date();
    let quizzes = [];
    try {
      quizzes = await Quiz.find({
        status: 'published',
        mode: 'self_paced',
        $or: [{ 'schedule.endsAt': null }, { 'schedule.endsAt': { $gt: now } }],
      }).sort({ createdAt: -1 }).select('title description category joinCode totalQuestions settings.timeLimitMinutes schedule.endsAt');
    } catch {
      quizzes = Array.from(memoryQuizzes.values()).filter((quiz) =>
        quiz.status === 'published' && quiz.mode === 'self_paced' &&
        (!quiz.schedule?.endsAt || new Date(quiz.schedule.endsAt) > now)
      );
    }
    res.status(200).json({ success: true, data: { quizzes } });
  } catch (error) {
    next(error);
  }
};

// 4. AI Question Generation Endpoint
const generateAIQuestions = async (req, res, next) => {
  try {
    const { topic, difficulty, count, contextText } = req.body;
    const questions = await aiService.generateQuestions({
      topic,
      difficulty,
      count: Number(count) || 5,
      contextText,
    });

    res.status(200).json({
      success: true,
      message: `Generated ${questions.length} questions on topic: ${topic}`,
      data: { questions },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get Quiz with Full Questions (Host Edit/View)
const getQuizById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    let quiz = null;
    try {
      quiz = await Quiz.findById(id);
    } catch {
      quiz = Array.from(memoryQuizzes.values()).find((q) => String(q.id || q._id) === String(id));
    }

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (String(quiz.hostId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view full quiz configuration' });
    }

    let questions = [];
    try {
      questions = await Question.find({ quizId: quiz._id || quiz.id }).sort({ order: 1 });
    } catch {
      questions = memoryQuestions.get(String(quiz.id || quiz._id)) || [];
    }

    res.status(200).json({
      success: true,
      data: { quiz, questions },
    });
  } catch (error) {
    next(error);
  }
};

// 6. Update Quiz (Host Edit)
const updateQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, mode, settings, schedule, questions, status } = req.body;
    const userId = req.user._id || req.user.id;

    let quiz = null;
    try {
      quiz = await Quiz.findById(id);
    } catch {
      quiz = Array.from(memoryQuizzes.values()).find((q) => String(q.id || q._id) === String(id));
    }

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (String(quiz.hostId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this quiz' });
    }

    const totalPoints = questions ? questions.reduce((sum, q) => sum + (q.points || 10), 0) : quiz.totalPoints;
    const totalQuestions = questions ? questions.length : quiz.totalQuestions;

    try {
      quiz = await Quiz.findByIdAndUpdate(
        id,
        {
          title: title || quiz.title,
          description: description !== undefined ? description : quiz.description,
          category: category || quiz.category,
          mode: mode || quiz.mode,
          settings: settings || quiz.settings,
          schedule: schedule || quiz.schedule,
          status: status || quiz.status,
          totalPoints,
          totalQuestions,
        },
        { new: true, runValidators: true }
      );

      if (questions && Array.isArray(questions)) {
        await Question.deleteMany({ quizId: quiz._id });
        const questionDocs = questions.map((q, idx) => ({
          ...q,
          quizId: quiz._id,
          order: idx,
        }));
        await Question.insertMany(questionDocs);
      }
    } catch {
      // Memory update
      if (title) quiz.title = title;
      if (description !== undefined) quiz.description = description;
      if (category) quiz.category = category;
      if (mode) quiz.mode = mode;
      if (settings) quiz.settings = settings;
      if (schedule) quiz.schedule = schedule;
      if (status) quiz.status = status;
      quiz.totalPoints = totalPoints;
      quiz.totalQuestions = totalQuestions;
      if (questions) {
        memoryQuestions.set(String(quiz.id || quiz._id), questions);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Quiz updated successfully!',
      data: { quiz },
    });
  } catch (error) {
    next(error);
  }
};

// 7. Delete Quiz (Host or Admin Delete)
const deleteQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    let quiz = null;
    try {
      quiz = await Quiz.findById(id);
    } catch {
      quiz = Array.from(memoryQuizzes.values()).find((q) => String(q.id || q._id) === String(id));
    }

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (String(quiz.hostId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this quiz' });
    }

    try {
      await Quiz.findByIdAndDelete(id);
      await Question.deleteMany({ quizId: id });
      const Attempt = require('../models/Attempt');
      await Attempt.deleteMany({ quizId: id });
    } catch {
      memoryQuizzes.delete(quiz.joinCode);
      memoryQuestions.delete(String(quiz.id || quiz._id));
    }

    res.status(200).json({
      success: true,
      message: 'Quiz and all associated questions/records deleted successfully!',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuiz,
  getMyQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  getQuizByCode,
  getAvailableSelfPacedQuizzes,
  generateAIQuestions,
  memoryQuizzes,
  memoryQuestions,
};
