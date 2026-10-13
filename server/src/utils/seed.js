require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedAdminOnly = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quizese';
    console.log(`Connecting to MongoDB at: ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('Clearing existing test users...');
    await User.deleteMany({ email: { $in: ['teacher@quizese.com', 'student@quizese.com'] } });

    const existingAdmin = await User.findOne({ email: 'admin@quizese.com' });
    if (!existingAdmin) {
      const admin = await User.create({
        name: 'System Administrator',
        email: 'admin@quizese.com',
        password: 'password123',
        role: 'admin',
        isEmailVerified: true,
        isBlocked: false,
        bio: 'Platform superuser and administrator',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      });
      console.log('✓ Successfully created Administrator account:', admin.email);
    } else {
      console.log('✓ Administrator account already exists:', existingAdmin.email);
    }

    console.log('Database initialized clean. Ready for real user registrations!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
};

seedAdminOnly();
