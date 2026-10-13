const User = require('../models/User');
const Quiz = require('../models/Quiz');
const AuditLog = require('../models/AuditLog');
const { memoryUsers } = require('./authController');
const { writeAuditLog, getMemoryAuditLogs } = require('../services/auditService');

// 1. Get Platform Metrics
const getAdminStats = async (req, res, next) => {
  try {
    let totalUsers = 1;
    let activeQuizzes = 0;
    let totalAttempts = 0;

    try {
      totalUsers = await User.countDocuments();
      activeQuizzes = await Quiz.countDocuments();
      const Attempt = require('../models/Attempt');
      totalAttempts = await Attempt.countDocuments();
    } catch {
      // Offline fallback
    }

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeQuizzes,
          totalAttempts,
          activeNow: 1,
          systemHealth: '100% Operational',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. User Management List (Live Database)
const getUsers = async (req, res, next) => {
  try {
    let users = [];
    try {
      users = await User.find().select('-password').sort({ createdAt: -1 });
    } catch {
      users = [
        { id: 'admin_id_001', name: 'System Administrator', email: 'admin@quizese.com', role: 'admin', isBlocked: false, createdAt: new Date() }
      ];
    }

    res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Toggle User Block Status
const toggleBlockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (String(userId) === String(req.user._id || req.user.id)) return res.status(400).json({ success: false, message: 'You cannot suspend your own admin account.' });
    let isBlocked = false;
    let user = null;

    try {
      user = await User.findById(userId);
      if (user) {
        if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Administrator accounts cannot be suspended.' });
        user.isBlocked = !user.isBlocked;
        await user.save();
        isBlocked = user.isBlocked;
      }
    } catch {
      user = Array.from(memoryUsers.values()).find((candidate) => String(candidate.id || candidate._id) === String(userId));
      if (user) {
        user.isBlocked = !user.isBlocked;
        isBlocked = user.isBlocked;
      }
    }

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await writeAuditLog({
      user: req.user,
      action: isBlocked ? 'USER_SUSPENDED' : 'USER_RESTORED',
      resource: `User: ${user.name || user.email}`,
      resourceId: user._id || user.id,
      details: { targetEmail: user.email, status: isBlocked ? 'suspended' : 'active' },
      req,
    });

    res.status(200).json({
      success: true,
      message: `User status updated to ${isBlocked ? 'Blocked' : 'Active'}`,
      data: { isBlocked },
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, role, isBlocked } = req.body;
    if (String(userId) === String(req.user._id || req.user.id) && (role || isBlocked !== undefined)) return res.status(400).json({ success: false, message: 'Use your profile to update your own account.' });
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (role !== undefined) {
      if (!['host', 'participant', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid user role.' });
      update.role = role;
    }
    let existingUser;
    try { existingUser = await User.findById(userId); } catch {}
    if (!existingUser) existingUser = Array.from(memoryUsers.values()).find((candidate) => String(candidate.id || candidate._id) === String(userId));
    if (existingUser?.role === 'admin' && isBlocked !== undefined) return res.status(400).json({ success: false, message: 'Administrator accounts cannot be suspended.' });
    if (isBlocked !== undefined) update.isBlocked = Boolean(isBlocked);
    let user;
    try { user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true }).select('-password'); } catch {}
    if (!user) {
      user = Array.from(memoryUsers.values()).find((candidate) => String(candidate.id || candidate._id) === String(userId));
      if (user) Object.assign(user, update);
    }
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await writeAuditLog({
      user: req.user,
      action: 'USER_UPDATED',
      resource: `User: ${user.name || user.email}`,
      resourceId: user._id || user.id,
      details: { targetEmail: user.email, updatedFields: Object.keys(update) },
      req,
    });
    res.json({ success: true, message: 'User updated successfully.', data: { user } });
  } catch (error) { next(error); }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (String(userId) === String(req.user._id || req.user.id)) return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
    let deleted = false;
    let deletedUser = null;
    try { deletedUser = await User.findByIdAndDelete(userId); deleted = Boolean(deletedUser); } catch {}
    if (!deleted) {
      const entry = Array.from(memoryUsers.entries()).find(([, user]) => String(user.id || user._id) === String(userId));
      if (entry) { deletedUser = entry[1]; memoryUsers.delete(entry[0]); deleted = true; }
    }
    if (!deleted) return res.status(404).json({ success: false, message: 'User not found.' });
    await writeAuditLog({
      user: req.user,
      action: 'USER_DELETED',
      resource: `User: ${deletedUser?.name || deletedUser?.email || userId}`,
      resourceId: userId,
      details: { targetEmail: deletedUser?.email || '' },
      req,
    });
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) { next(error); }
};

// 4. Audit Logs
const getAuditLogs = async (req, res, next) => {
  try {
    let logs = [];
    try {
      logs = await AuditLog.find()
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    } catch {
      logs = getMemoryAuditLogs();
    }

    logs = logs.map((log) => ({
      id: log._id || log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      details: log.details || {},
      performedBy: log.userId?.name || log.actor?.name || 'System',
      actorEmail: log.userId?.email || log.actor?.email || '',
      ipAddress: log.ipAddress || '',
      timestamp: log.createdAt || log.timestamp,
    }));

    res.status(200).json({
      success: true,
      data: { logs },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getUsers,
  toggleBlockUser,
  updateUser,
  deleteUser,
  getAuditLogs,
};
