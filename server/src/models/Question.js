const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['mcq_single', 'mcq_multiple', 'true_false', 'short_answer', 'fill_blank'],
      default: 'mcq_single',
    },
    options: [
      {
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
        explanation: { type: String, default: '' },
      },
    ],
    // For short answer or fill in blank
    acceptedAnswers: [
      {
        type: String,
        trim: true,
      },
    ],
    points: {
      type: Number,
      default: 10,
      min: 1,
    },
    timeLimitSeconds: {
      type: Number,
      default: 30, // 0 = follow quiz timer
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    topicTag: {
      type: String,
      default: 'General',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    explanation: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Question', questionSchema);
