const predictionService = require('../services/prediction/predictionService');

// 1. Student Personal AI Predictions & Weak Topics
const getStudentPredictions = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id || 'demo_student';
    const data = await predictionService.getStudentPrediction(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Host Cohort AI Insights & Psychometrics
const getCohortInsights = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const data = await predictionService.getHostCohortInsights(quizId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentPredictions,
  getCohortInsights,
};
