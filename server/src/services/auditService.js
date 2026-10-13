const AuditLog = require('../models/AuditLog');

// Keeps the audit trail usable during local development when MongoDB is offline.
// Database entries are always preferred whenever the connection is available.
const memoryAuditLogs = [];

const getActorId = (user) => user?._id || user?.id || null;

const getRequestDetails = (req) => ({
  ipAddress: req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || '',
  userAgent: req?.get?.('user-agent') || req?.headers?.['user-agent'] || '',
});

const writeAuditLog = async ({ user, action, resource, resourceId = null, details = {}, req }) => {
  const actor = user
    ? { id: String(getActorId(user) || ''), name: user.name || 'Unknown user', email: user.email || '' }
    : null;
  const entry = {
    userId: getActorId(user),
    action,
    resource,
    resourceId: resourceId ? String(resourceId) : null,
    details,
    ...getRequestDetails(req),
  };

  try {
    return await AuditLog.create(entry);
  } catch {
    const fallback = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...entry,
      actor,
      createdAt: new Date(),
    };
    memoryAuditLogs.unshift(fallback);
    return fallback;
  }
};

const getMemoryAuditLogs = () => memoryAuditLogs;

module.exports = { writeAuditLog, getMemoryAuditLogs };
