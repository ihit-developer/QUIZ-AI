const predictionEngine = require('./predictionEngine');
const Attempt = require('../../models/Attempt');
const Question = require('../../models/Question');
const Quiz = require('../../models/Quiz');

/**
 * Prediction Service combining real MongoDB/attempt telemetry with statistical regression
 */
class PredictionService {
  async getStudentPrediction(userId) {
    let historicalScores = [];
    let topicMap = {};
    let totalAttemptsCount = 0;
    let totalDurationSeconds = 0;

    try {
      // Find real student submitted attempts
      const filter = userId && userId !== 'demo_student' ? { userId, status: 'submitted' } : { status: 'submitted' };
      const attempts = await Attempt.find(filter)
        .sort({ createdAt: 1 })
        .populate('quizId');

      totalAttemptsCount = attempts.length;

      if (attempts.length > 0) {
        historicalScores = attempts.map((a) => Math.round(a.percentage || 0));
        const questionIds = attempts.flatMap((attempt) => (attempt.answers || []).map((answer) => answer.questionId).filter(Boolean));
        const questions = questionIds.length ? await Question.find({ _id: { $in: questionIds } }).select('topicTag') : [];
        const topicByQuestionId = new Map(questions.map((question) => [String(question._id), question.topicTag || 'Core Knowledge']));
        attempts.forEach((a) => {
          totalDurationSeconds += a.durationSeconds || 0;
          if (a.answers && Array.isArray(a.answers)) {
            a.answers.forEach((ans) => {
              const topic = topicByQuestionId.get(String(ans.questionId)) || 'Core Knowledge';
              if (!topicMap[topic]) topicMap[topic] = { attempts: 0, correct: 0 };
              topicMap[topic].attempts += 1;
              if (ans.isCorrect) topicMap[topic].correct += 1;
            });
          }
        });
      }
    } catch (err) {
      console.error('Error fetching real student attempts:', err.message);
    }

    const hasAttemptData = historicalScores.length > 0;
    const stats = predictionEngine.predictStudentFutureScore(historicalScores);

    // Convert topic map to array
    const topicStats = Object.keys(topicMap).length > 0
      ? Object.keys(topicMap).map((k) => ({
          topic: k,
          attempts: topicMap[k].attempts,
          correct: topicMap[k].correct,
        }))
      : [];

    const weakTopics = predictionEngine.detectWeakTopics(topicStats);

    const avgPace = totalAttemptsCount > 0 ? Math.round(totalDurationSeconds / totalAttemptsCount) : null;
    const avgScore = historicalScores.length > 0 ? Math.round(historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length) : null;

    return {
      hasAttemptData,
      historicalScores,
      ...stats,
      weakTopics,
      recommendations: [stats.recommendation],
      totalAttemptsCount,
      avgPace,
      avgScore,
    };
  }

  async getHostCohortInsights(quizId) {
    let attempts = [];
    let atRiskCount = 0;
    let totalScoreSum = 0;

    try {
      const cleanId = quizId ? String(quizId).trim() : '';
      let query = {};
      if (cleanId && cleanId.match(/^[0-9a-fA-F]{24}$/)) {
        query = { quizId: cleanId };
      }
      attempts = await Attempt.find(query).sort({ score: -1 });

      attempts.forEach((a) => {
        const pct = Math.round(a.percentage || 0);
        totalScoreSum += pct;
        if (pct < 60) atRiskCount++;
      });
    } catch (err) {
      console.error('Error fetching cohort attempts:', err.message);
    }

    const totalCount = attempts.length || 1;
    const cohortReadinessScore = attempts.length > 0 ? Math.round(totalScoreSum / totalCount) : 82;

    const formattedAttempts = attempts.map((a) => ({ totalScore: a.score || 0 }));
    const psychometrics = predictionEngine.calculateQuestionPsychometrics(formattedAttempts);

    const aiExecutiveSummary = attempts.length > 0
      ? `Based on ${attempts.length} live submissions, cohort readiness is currently ${cohortReadinessScore}%. ${atRiskCount} candidate(s) are currently scoring below the 60% certification passing mark.`
      : `Real-time readiness telemetry active. Awaiting candidate submissions for live cohort psychometrics.`;

    return {
      psychometrics,
      aiExecutiveSummary,
      atRiskCount,
      cohortReadinessScore,
    };
  }
}

module.exports = new PredictionService();
