const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

/**
 * Robust Scoring Engine
 * Evaluates submitted user answers strictly on the server against correct database answers.
 * Guarantees zero correct answers leaked prior to final evaluation.
 */
class ScoringService {
  async evaluateAttempt(quiz, questions, answers, durationSeconds = 0) {
    let totalScore = 0;
    let totalPossible = 0;
    const evaluatedAnswers = [];

    const isNegativeMarking = quiz.settings?.negativeMarking || false;
    const penaltyPoints = quiz.settings?.negativeMarkPoints || 0;

    for (const question of questions) {
      const qPoints = question.points || 10;
      totalPossible += qPoints;

      const submitted = answers.find(
        (a) => String(a.questionId) === String(question._id || question.id)
      );

      let isCorrect = false;
      let pointsAwarded = 0;
      const selectedOptions = submitted?.selectedOptions || [];
      const textAnswer = submitted?.textAnswer?.trim() || '';

      if (['mcq_single', 'true_false'].includes(question.type)) {
        const correctOpt = question.options.find((o) => o.isCorrect);
        if (correctOpt && selectedOptions.includes(correctOpt.text)) {
          isCorrect = true;
          pointsAwarded = qPoints;
        } else if (selectedOptions.length > 0 && isNegativeMarking) {
          pointsAwarded = -penaltyPoints;
        }
      } else if (question.type === 'mcq_multiple') {
        const correctTexts = question.options.filter((o) => o.isCorrect).map((o) => o.text);
        const allCorrectSelected =
          correctTexts.length === selectedOptions.length &&
          correctTexts.every((t) => selectedOptions.includes(t));

        if (allCorrectSelected) {
          isCorrect = true;
          pointsAwarded = qPoints;
        } else if (selectedOptions.length > 0 && isNegativeMarking) {
          pointsAwarded = -penaltyPoints;
        }
      } else if (['short_answer', 'fill_blank'].includes(question.type)) {
        const accepted = (question.acceptedAnswers || []).map((a) => a.toLowerCase().trim());
        if (accepted.includes(textAnswer.toLowerCase())) {
          isCorrect = true;
          pointsAwarded = qPoints;
        }
      }

      totalScore += pointsAwarded;

      const correctOpt = question.options?.find((o) => o.isCorrect);

      evaluatedAnswers.push({
        questionId: question._id || question.id,
        questionTitle: question.title,
        selectedOptions,
        textAnswer,
        correctAnswer: correctOpt ? correctOpt.text : (question.acceptedAnswers || []).join(', '),
        explanation: question.explanation || '',
        isCorrect,
        pointsAwarded,
        timeSpentSeconds: submitted?.timeSpentSeconds || 0,
        flaggedForReview: submitted?.flaggedForReview || false,
      });
    }

    if (totalScore < 0) totalScore = 0;

    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
    const passingThreshold = quiz.settings?.passingScorePercent || 60;
    const passed = percentage >= passingThreshold;

    return {
      score: totalScore,
      percentage,
      totalPointsPossible: totalPossible,
      passed,
      evaluatedAnswers,
    };
  }
}

module.exports = new ScoringService();
