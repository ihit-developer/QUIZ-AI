const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50)
    .regex(/^[\p{L}][\p{L}\s'-]*$/u, 'Enter your name using letters only.'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'host', 'participant']).optional().default('participant'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(300).optional(),
  avatar: z.string().max(7 * 1024 * 1024, 'Profile image is too large. Please choose an image up to 5 MB.').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});
const emailSchema = z.object({ email: z.string().email('Please enter a valid email address') });
const otpSchema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });
const resetPasswordSchema = otpSchema.extend({ newPassword: z.string().min(6, 'Password must be at least 6 characters') });

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError || error.issues || error.errors) {
      const issueList = error.issues || error.errors || [];
      return res.status(400).json({
        success: false,
        message: issueList[0]?.message || 'Validation failed',
        errors: issueList.map((e) => ({
          field: Array.isArray(e.path) ? e.path.join('.') : '',
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  emailSchema,
  otpSchema,
  resetPasswordSchema,
  validate,
};
