const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  device: { type: String, default: 'Unknown device' },
  ipAddress: { type: String, default: '' },
  lastActiveAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

userSessionSchema.index({ userId: 1, isActive: 1, lastActiveAt: -1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
