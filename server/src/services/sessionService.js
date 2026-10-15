const crypto = require('crypto');
const UserSession = require('../models/UserSession');

const deviceName = (req) => {
  const agent = String(req.get?.('user-agent') || '');
  if (/iphone/i.test(agent)) return 'iPhone';
  if (/ipad/i.test(agent)) return 'iPad';
  if (/android/i.test(agent)) return /mobile/i.test(agent) ? 'Android phone' : 'Android tablet';
  if (/windows/i.test(agent)) return 'Windows computer';
  if (/macintosh|mac os/i.test(agent)) return 'Mac computer';
  if (/linux/i.test(agent)) return 'Linux computer';
  return 'Unknown device';
};

const clientIp = (req) => String(req.ip || req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();

const createSession = async (user, req) => {
  const sessionId = crypto.randomUUID();
  try {
    await UserSession.create({ userId: user._id || user.id, sessionId, device: deviceName(req), ipAddress: clientIp(req) });
  } catch (error) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw error;
  }
  return sessionId;
};

const refreshSession = async (sessionId) => {
  if (!sessionId) return;
  try { await UserSession.updateOne({ sessionId, isActive: true }, { $set: { lastActiveAt: new Date() } }); } catch {}
};

const deactivateSession = async (sessionId) => {
  if (!sessionId) return;
  try { await UserSession.updateOne({ sessionId }, { $set: { isActive: false } }); } catch {}
};

module.exports = { createSession, refreshSession, deactivateSession };
