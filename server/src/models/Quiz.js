const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      default: 'General Knowledge',
      trim: true,
    },
    language: {
      type: String,
      enum: ['English', 'Urdu'],
      default: 'English',
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    joinCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      sparse: true,
    },
    qrCodeDataUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'archived'],
      default: 'draft',
      index: true,
    },
    mode: {
      type: String,
      enum: ['self_paced', 'live'],
      default: 'self_paced',
    },
    settings: {
      timeLimitMinutes: { type: Number, default: 15 },
      perQuestionTimer: { type: Boolean, default: false },
      shuffleQuestions: { type: Boolean, default: false },
      shuffleOptions: { type: Boolean, default: false },
      attemptsAllowed: { type: Number, default: 1 }, // 0 = unlimited
      passingScorePercent: { type: Number, default: 60 },
      negativeMarking: { type: Boolean, default: false },
      negativeMarkPoints: { type: Number, default: 2 },
      allowGuests: { type: Boolean, default: true },
      requireLogin: { type: Boolean, default: false },
      showResultsImmediately: { type: Boolean, default: true },
      showCorrectAnswersAfterSubmit: { type: Boolean, default: true },
      passwordProtection: { type: String, default: '' },
      antiCheat: {
        enforceFullscreen: { type: Boolean, default: false },
        detectTabSwitch: { type: Boolean, default: true },
        disableCopyPaste: { type: Boolean, default: true },
        maxViolationsAllowed: { type: Number, default: 3 },
      },
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    schedule: {
      startsAt: { type: Date, default: null },
      endsAt: { type: Date, default: null },
    },
    tags: [{ type: String, trim: true }],
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

quizSchema.index({ hostId: 1, createdAt: -1 });
quizSchema.index({ status: 1, joinCode: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
