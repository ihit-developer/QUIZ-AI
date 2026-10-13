const { Parser } = require('json2csv');
const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const certificateService = require('../services/certificateService');
const { memoryQuizzes, memoryQuestions } = require('./quizController');
const { memoryAttempts } = require('./attemptController');

// 1. Get Host Quiz Analytics & Stats with Real Attempts & Real Leaderboard
const getQuizAnalytics = async (req, res, next) => {
  try {
    const { quizId } = req.params;

    let quiz;
    let questions;
    let attempts;
    const loadMemoryData = () => {
      quiz = Array.from(memoryQuizzes.values()).find((item) => String(item.id || item._id) === String(quizId));
      questions = memoryQuestions.get(String(quiz?.id || quiz?._id)) || [];
      attempts = Array.from(memoryAttempts.values())
        .filter((item) => String(item.quizId?._id || item.quizId?.id || item.quizId) === String(quizId))
        .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.durationSeconds || 0) - (b.durationSeconds || 0));
    };
    if (mongoose.connection.readyState !== 1) {
      loadMemoryData();
    } else {
      try {
        quiz = await Quiz.findById(quizId);
        questions = await Question.find({ quizId }).sort({ order: 1 });
        attempts = await Attempt.find({ quizId }).populate('userId').sort({ score: -1, durationSeconds: 1 });
        if (!quiz) loadMemoryData();
      } catch {
        loadMemoryData();
      }
    }
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });
    const requesterId = String(req.user?._id || req.user?.id || '');
    if (req.user?.role !== 'admin' && String(quiz.hostId) !== requesterId) {
      return res.status(403).json({ success: false, message: 'You can only view analytics for your own quizzes.' });
    }
    const totalAttempts = attempts.length;
    const completedAttempts = attempts.filter((attempt) => attempt.status !== 'in_progress');
    let completionRate = 0;
    let averageScore = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let passingRate = 0;

    const passingPercent = quiz?.settings?.passingScorePercent || 60;

    const scoreDistribution = [
      { range: '0-20%', count: 0 },
      { range: '21-40%', count: 0 },
      { range: '41-60%', count: 0 },
      { range: '61-80%', count: 0 },
      { range: '81-100%', count: 0 },
    ];

    let passedCount = 0;
    let totalScoreSum = 0;

    const leaderboard = completedAttempts.map((att, idx) => {
      const studentName = att.userId?.name || att.guestSession?.name || 'Anonymous Student';
      const pct = Math.round(att.percentage || 0);

      totalScoreSum += pct;
      if (pct >= passingPercent || att.passed) passedCount++;

      if (pct <= 20) scoreDistribution[0].count++;
      else if (pct <= 40) scoreDistribution[1].count++;
      else if (pct <= 60) scoreDistribution[2].count++;
      else if (pct <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;

      return {
        rank: idx + 1,
        name: studentName,
        score: att.score || 0,
        percentage: pct,
        durationSeconds: att.durationSeconds || 0,
        status: att.status || 'submitted',
        violationsCount: att.violations?.length || 0,
        date: att.createdAt ? new Date(att.createdAt).toISOString().split('T')[0] : 'Today',
      };
    });

    if (completedAttempts.length > 0) {
      averageScore = Math.round(totalScoreSum / completedAttempts.length);
      highestScore = Math.max(...completedAttempts.map((a) => Math.round(a.percentage || 0)));
      lowestScore = Math.min(...completedAttempts.map((a) => Math.round(a.percentage || 0)));
      passingRate = Math.round((passedCount / completedAttempts.length) * 100);
      completionRate = Math.round((completedAttempts.length / totalAttempts) * 100);
    }

    // Question Accuracy Stats based on real attempt answers
    const questionStats = questions.map((q) => {
      let correctAttempts = 0;
      let totalAnswers = 0;

      completedAttempts.forEach((att) => {
        const ans = att.answers?.find((a) => String(a.questionId) === String(q._id));
        if (ans) {
          totalAnswers++;
          if (ans.isCorrect) correctAttempts++;
        }
      });

      const answerTimes = completedAttempts
        .map((att) => att.answers?.find((a) => String(a.questionId) === String(q._id))?.timeSpentSeconds)
        .filter((seconds) => Number.isFinite(seconds) && seconds >= 0);
      return {
        questionTitle: q.title,
        accuracy: totalAnswers > 0 ? Math.round((correctAttempts / totalAnswers) * 100) : 0,
        avgTimeSec: answerTimes.length ? Math.round(answerTimes.reduce((sum, seconds) => sum + seconds, 0) / answerTimes.length) : 0,
      };
    });

    const analytics = {
      quizTitle: quiz?.title || 'Quiz Analytics',
      totalAttempts,
      completedAttempts: completedAttempts.length,
      completionRate,
      averageScore,
      highestScore,
      lowestScore,
      passingRate,
      scoreDistribution,
      questionStats,
      leaderboard,
    };

    res.status(200).json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Export Quiz Attempts to CSV
const exportAttemptsCSV = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });
    const requesterId = String(req.user?._id || req.user?.id || '');
    if (req.user?.role !== 'admin' && String(quiz.hostId) !== requesterId) {
      return res.status(403).json({ success: false, message: 'You can only export results for your own quizzes.' });
    }
    const attempts = await Attempt.find({ quizId }).populate('userId').sort({ score: -1, durationSeconds: 1 });

    const rows = attempts.map((att, idx) => ({
      rank: idx + 1,
      name: att.userId?.name || att.guestSession?.name || 'Anonymous Student',
      email: att.userId?.email || 'N/A',
      score: att.score || 0,
      percentage: Math.round(att.percentage || 0),
      durationSeconds: att.durationSeconds || 0,
      status: att.status || 'submitted',
      violations: att.violations?.length || 0,
      date: att.createdAt ? new Date(att.createdAt).toISOString() : '',
    }));

    const fields = ['rank', 'name', 'email', 'score', 'percentage', 'durationSeconds', 'status', 'violations', 'date'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`quiz-${quizId}-results.csv`);
    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

// 3. Generate & Download Certificate (PDF)
const downloadCertificate = async (req, res, next) => {
  try {
    const { studentName = 'Alex Rivera', quizTitle = 'Advanced Full Stack Web Architecture Quiz', percentage = 90 } = req.query;

    const pdfBuffer = await certificateService.generateCertificateBuffer({
      studentName,
      quizTitle,
      percentage,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=certificate-${encodeURIComponent(studentName)}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuizAnalytics,
  exportAttemptsCSV,
  downloadCertificate,
};
