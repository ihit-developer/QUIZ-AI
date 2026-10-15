const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: function () { return !this.googleId; }, select: false },
  role: { type: String, enum: ['host', 'participant'], default: 'participant' },
  googleId: { type: String, default: '' },
  avatar: { type: String, default: '' },
  code: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
