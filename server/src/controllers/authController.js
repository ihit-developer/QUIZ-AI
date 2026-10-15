const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const crypto = require('crypto');
const connectDB = require('../config/db');
const { sendOtpEmail, sendLoginAlert } = require('../services/emailService');
const { writeAuditLog } = require('../services/auditService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/token');
const isProductionDeployment = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// Cookie options for production and dev
const cookieOptions = {
  httpOnly: true,
  secure: isProductionDeployment,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// In-memory demo store fallback when MongoDB is not currently running locally
const memoryUsers = new Map();
const pendingRegistrations = new Map();
const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const otpExpiry = () => new Date(Date.now() + 10 * 60 * 1000);
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
const googleStateSecret = () => process.env.JWT_ACCESS_SECRET || 'development-google-state-secret';
const createGoogleState = (role) => {
  const payload = Buffer.from(JSON.stringify({ role, expiresAt: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', googleStateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};
const readGoogleStateRole = (state) => {
  if (!state || typeof state !== 'string') return 'participant';
  const [payload, signature] = state.split('.');
  const expected = crypto.createHmac('sha256', googleStateSecret()).update(payload || '').digest('base64url');
  if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return 'participant';
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.expiresAt > Date.now() && ['host', 'participant'].includes(data.role) ? data.role : 'participant';
  } catch { return 'participant'; }
};
const requirePersistentAuthDatabase = async () => {
  const available = await connectDB();
  if (isProductionDeployment && !available) {
    const error = new Error('Account service is temporarily unavailable. Please try again shortly.');
    error.statusCode = 503;
    throw error;
  }
  return available;
};
const findUserByEmail = async (email, select = '') => {
  const normalizedEmail = normalizeEmail(email);
  try { return await User.findOne({ email: normalizedEmail }).select(select); }
  catch (error) {
    if (isProductionDeployment) throw error;
    return memoryUsers.get(normalizedEmail);
  }
};
const publicUser = (user) => ({ id: user._id || user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || '', bio: user.bio || '' });
const publicAppUrl = (req) => `${req.protocol}://${req.get('host')}`;
const googleRedirectUri = (req) => {
  const requestCallback = `${publicAppUrl(req)}/api/v1/auth/google/callback`;
  return isProductionDeployment
    ? (process.env.GOOGLE_REDIRECT_URI || requestCallback)
    : requestCallback;
};

// Helper to seed initial admin account
const initDemoUsers = async () => {
  if (memoryUsers.size === 0) {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash('password123', 10);
    memoryUsers.set('admin@quizese.com', {
      id: 'admin_id_001',
      _id: 'admin_id_001',
      name: 'System Administrator',
      email: 'admin@quizese.com',
      password: hashed,
      role: 'admin',
      isBlocked: false,
      isEmailVerified: true,
      bio: 'Platform superuser and administrator',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    });
  }
};
initDemoUsers();

const register = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const { name, password, role } = req.body;
    const email = normalizeEmail(req.body.email);

    let existingUser = null;
    try {
      existingUser = await User.findOne({ email });
    } catch (error) {
      if (isProductionDeployment) throw error;
      existingUser = memoryUsers.get(email);
    }

    // Clean up accounts created by the earlier pre-verification flow so the
    // person can restart registration and receive a pending OTP instead.
    if (existingUser && !existingUser.isEmailVerified) {
      try { await User.deleteOne({ _id: existingUser._id }); } catch { memoryUsers.delete(email); }
      existingUser = null;
    }
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const code = createOtp();
    const pending = { name, email, passwordHash: await require('bcryptjs').hash(password, 10), role: role || 'participant', code, expiresAt: otpExpiry() };
    try {
      await PendingRegistration.findOneAndUpdate({ email }, pending, { upsert: true, new: true, setDefaultsOnInsert: true });
    } catch (error) {
      if (isProductionDeployment) throw error;
      pendingRegistrations.set(email, pending);
    }
    await sendOtpEmail({ email, code, purpose: 'verification', name });

    res.status(201).json({
      success: true,
      message: 'Verification code sent to your email.',
      data: { requiresVerification: true, email },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    let user = null;

    try {
      user = await User.findOne({ email }).select('+password');
    } catch (error) {
      if (isProductionDeployment) throw error;
      user = memoryUsers.get(email);
    }

    if (!user && !isProductionDeployment) {
      user = memoryUsers.get(email);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
      });
    }

    // Administrators must remain recoverable and cannot be locked out by the
    // user-management screen. Repair legacy admin records that were blocked.
    if (user.role === 'admin' && user.isBlocked) {
      user.isBlocked = false;
      if (user.save) await user.save();
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by an administrator.',
      });
    }
    if (!user.isEmailVerified) return res.status(403).json({ success: false, message: 'Verify your email before signing in.', requiresVerification: true });

    const bcrypt = require('bcryptjs');
    let isMatch = false;
    if (typeof user.comparePassword === 'function') {
      isMatch = await user.comparePassword(password);
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie('refreshToken', refreshToken, cookieOptions);
    sendLoginAlert({ email: user.email, name: user.name }).catch((error) => console.error('Login email failed:', error.message));
    await writeAuditLog({ user, action: 'USER_SIGNED_IN', resource: 'Account sign-in', details: { method: 'password' }, req });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found.',
      });
    }

    const decoded = verifyRefreshToken(token);
    let user = null;

    try {
      user = await User.findById(decoded.id);
    } catch {
      for (const u of memoryUsers.values()) {
        if (u.id === decoded.id || u._id === decoded.id) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists or session expired.',
      });
    }

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
      error: error.message,
    });
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const { code } = req.body;
    const email = normalizeEmail(req.body.email);
    let pending;
    try { pending = await PendingRegistration.findOne({ email }).select('+passwordHash +code'); }
    catch (error) {
      if (isProductionDeployment) throw error;
      pending = pendingRegistrations.get(email);
    }
    if (!pending || pending.code !== code || new Date(pending.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This verification code is invalid or expired.' });
    }
    let user;
    try {
      if (pending.googleId) {
        user = await User.findOne({ $or: [{ googleId: pending.googleId }, { email: pending.email }] });
        if (!user) {
          user = await User.create({ name: pending.name, email: pending.email, password: `google-${createOtp()}-${Date.now()}`, role: pending.role, googleId: pending.googleId, isEmailVerified: true, avatar: pending.avatar || '' });
        } else {
          user.googleId = pending.googleId;
          user.isEmailVerified = true;
          if (pending.avatar && !user.avatar) user.avatar = pending.avatar;
          await user.save();
        }
      } else {
        // Store the verified password hash atomically. The old temporary-password
        // flow could leave a temporary password in MongoDB after a partial error.
        user = await User.create({ name: pending.name, email: pending.email, password: pending.passwordHash, role: pending.role, isEmailVerified: true });
      }
      // Deleting the consumed OTP is cleanup only. A cleanup failure must never
      // replace a real saved user with an in-memory user.
      try { await PendingRegistration.deleteOne({ _id: pending._id }); }
      catch (cleanupError) { console.error('[Auth] Unable to remove consumed verification code:', cleanupError.message); }
    } catch (error) {
      if (isProductionDeployment) throw error;
      user = { id: 'user_' + Date.now(), _id: 'user_' + Date.now(), name: pending.name, email: pending.email, password: pending.passwordHash || '', role: pending.role, googleId: pending.googleId || '', isEmailVerified: true, bio: '', avatar: pending.avatar || '' };
      memoryUsers.set(email, user); pendingRegistrations.delete(email);
    }
    const accessToken = signAccessToken(user);
    res.cookie('refreshToken', signRefreshToken(user), cookieOptions);
    if (pending.googleId) {
      sendLoginAlert({ email: user.email, name: user.name }).catch(() => {});
      await writeAuditLog({ user, action: 'USER_SIGNED_IN', resource: 'Account sign-in', details: { method: 'google_otp' }, req });
    }
    res.status(200).json({ success: true, data: { user: publicUser(user), accessToken } });
  } catch (error) { next(error); }
};

const resendVerification = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const email = normalizeEmail(req.body.email);
    let pending;
    try { pending = await PendingRegistration.findOne({ email }).select('+code'); } catch { pending = pendingRegistrations.get(email); }
    if (!pending) return res.status(404).json({ success: false, message: 'No pending registration exists for that email.' });
    const code = createOtp(); pending.code = code; pending.expiresAt = otpExpiry(); if (pending.save) await pending.save();
    await sendOtpEmail({ email: pending.email, code, purpose: 'verification', name: pending.name });
    res.json({ success: true, message: 'A new verification code was sent.' });
  } catch (error) { next(error); }
};

const forgotPassword = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const user = await findUserByEmail(normalizeEmail(req.body.email), '+passwordResetCode +passwordResetExpires');
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
    const code = createOtp(); user.passwordResetCode = code; user.passwordResetExpires = otpExpiry();
    if (user.save) await user.save();
    await sendOtpEmail({ email: user.email, code, purpose: 'reset', name: user.name });
    res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
  } catch (error) { next(error); }
};

const resetPassword = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const { code, newPassword } = req.body;
    const email = normalizeEmail(req.body.email);
    const user = await findUserByEmail(email, '+password +passwordResetCode +passwordResetExpires');
    if (!user || user.passwordResetCode !== code || !user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) return res.status(400).json({ success: false, message: 'This reset code is invalid or expired.' });
    if (user.save) { user.password = newPassword; user.passwordResetCode = undefined; user.passwordResetExpires = undefined; await user.save(); }
    else { user.password = await require('bcryptjs').hash(newPassword, 10); user.passwordResetCode = undefined; user.passwordResetExpires = undefined; }
    res.json({ success: true, message: 'Password reset successfully. Please sign in.' });
  } catch (error) { next(error); }
};

const changePassword = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    const { currentPassword, newPassword } = req.body;
    let user = await findUserByEmail(req.user.email, '+password');
    const bcrypt = require('bcryptjs');
    const valid = user && (user.comparePassword ? await user.comparePassword(currentPassword) : await bcrypt.compare(currentPassword, user.password));
    if (!valid) return res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
    if (user.save) { user.password = newPassword; await user.save(); } else user.password = await bcrypt.hash(newPassword, 10);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) { next(error); }
};

const googleLogin = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ success: false, message: 'Google sign-in has not been configured yet.' });
  const redirectUri = googleRedirectUri(req);
  const requestedRole = ['host', 'participant'].includes(req.query.role) ? req.query.role : 'participant';
  const query = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', access_type: 'online', prompt: 'select_account', state: createGoogleState(requestedRole) });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
};

const googleCallback = async (req, res, next) => {
  try {
    await requirePersistentAuthDatabase();
    // Locally the React app (5173) and API (5000) are separate. On Vercel
    // they intentionally share one public domain.
    const clientUrl = isProductionDeployment
      ? publicAppUrl(req)
      : (process.env.CLIENT_URL || 'http://localhost:5173');
    const redirectUri = googleRedirectUri(req);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code || '', client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Google token exchange failed');
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email_verified) throw new Error('Google did not provide a verified email address');
    const requestedRole = readGoogleStateRole(req.query.state);
    let existingUser;
    try { existingUser = await User.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email }] }); } catch { existingUser = memoryUsers.get(profile.email); }
    const email = normalizeEmail(profile.email);
    const pending = {
      name: profile.name || existingUser?.name || email.split('@')[0],
      email,
      role: existingUser?.role === 'host' ? 'host' : requestedRole,
      googleId: profile.sub,
      avatar: profile.picture || '',
      code: createOtp(),
      expiresAt: otpExpiry(),
    };
    try {
      await PendingRegistration.findOneAndUpdate({ email }, pending, { upsert: true, new: true, setDefaultsOnInsert: true });
    } catch (error) {
      if (isProductionDeployment) throw error;
      pendingRegistrations.set(email, pending);
    }
    await sendOtpEmail({ email, code: pending.code, purpose: 'verification', name: pending.name });
    res.redirect(`${clientUrl}/register?googleVerification=1&email=${encodeURIComponent(email)}`);
  } catch (error) { next(error); }
};

const logout = async (req, res) => {
  res.clearCookie('refreshToken', cookieOptions);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    let user = req.user;

    try {
      user = await User.findByIdAndUpdate(
        user._id || user.id,
        { name, bio, avatar },
        { new: true, runValidators: true }
      );
    } catch {
      if (memoryUsers.has(user.email)) {
        const existing = memoryUsers.get(user.email);
        if (name) existing.name = name;
        if (bio !== undefined) existing.bio = bio;
        if (avatar !== undefined) existing.avatar = avatar;
        user = existing;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || '',
          bio: user.bio || '',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  memoryUsers,
  verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword,
  googleLogin, googleCallback,
};
