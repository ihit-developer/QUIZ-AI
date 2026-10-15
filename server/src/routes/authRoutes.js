const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refreshToken,
  logout,
  getSessions,
  getMe,
  updateProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  googleLogin,
  googleCallback,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema, emailSchema, otpSchema, resetPasswordSchema,
  validate,
} = require('../validators/authValidator');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.post('/verify-email', validate(otpSchema), verifyEmail);
router.post('/resend-verification', validate(emailSchema), resendVerification);
router.post('/forgot-password', validate(emailSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.get('/sessions', authenticate, getSessions);
router.put('/profile', authenticate, validate(updateProfileSchema), updateProfile);
router.put('/change-password', authenticate, validate(changePasswordSchema), changePassword);

module.exports = router;
