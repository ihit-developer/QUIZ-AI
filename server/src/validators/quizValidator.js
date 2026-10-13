const { z } = require('zod');

const questionOptionSchema = z.object({
  text: z.string().min(1, 'Option text is required'),
  isCorrect: z.boolean().default(false),
  explanation: z.string().optional().default(''),
});

const questionSchema = z.object({
  title: z.string().min(3, 'Question prompt must be at least 3 characters'),
  type: z.enum(['mcq_single', 'mcq_multiple', 'true_false', 'short_answer', 'fill_blank']).default('mcq_single'),
  options: z.array(questionOptionSchema).min(2, 'At least 2 options required'),
  acceptedAnswers: z.array(z.string()).optional().default([]),
  points: z.number().min(1).default(10),
  timeLimitSeconds: z.number().min(5).default(30),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  topicTag: z.string().optional().default('General'),
  explanation: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
});

const quizSchema = z.object({
  title: z.string().min(3, 'Quiz title must be at least 3 characters').max(120),
  description: z.string().max(1000).optional().default(''),
  category: z.string().optional().default('General Knowledge'),
  mode: z.enum(['self_paced', 'live']).default('self_paced'),
  settings: z.object({
    timeLimitMinutes: z.number().min(1).default(15),
    perQuestionTimer: z.boolean().default(false),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    attemptsAllowed: z.number().min(0).default(1),
    passingScorePercent: z.number().min(0).max(100).default(60),
    negativeMarking: z.boolean().default(false),
    negativeMarkPoints: z.number().min(0).default(2),
    allowGuests: z.boolean().default(true),
    requireLogin: z.boolean().default(false),
    showResultsImmediately: z.boolean().default(true),
    showCorrectAnswersAfterSubmit: z.boolean().default(true),
    passwordProtection: z.string().optional().default(''),
    antiCheat: z.object({
      enforceFullscreen: z.boolean().default(false),
      detectTabSwitch: z.boolean().default(true),
      disableCopyPaste: z.boolean().default(true),
      maxViolationsAllowed: z.number().default(3),
    }).optional().default({}),
  }).optional().default({}),
  schedule: z.object({
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  }).optional().default({}),
  questions: z.array(questionSchema).min(1, 'Quiz must have at least 1 question'),
  tags: z.array(z.string()).optional().default([]),
});

const generateAISchema = z.object({
  topic: z.string().min(2, 'Topic must be at least 2 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  count: z.number().min(1).max(20).default(5),
  contextText: z.string().optional().default(''),
});

module.exports = {
  quizSchema,
  questionSchema,
  generateAISchema,
};
