const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quizese', {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 20000,
      maxPoolSize: 10,
    });
    isConnected = db.connections[0].readyState === 1;
    console.log(`[Database] MongoDB Connected: ${db.connection.host}`);
    return isConnected;
  } catch (error) {
    isConnected = false;
    // Do not print the connection string: it contains database credentials.
    console.warn(`[Database Warning] Could not connect to MongoDB: ${error.message}`);
    console.warn('[Database Warning] Continuing in development/offline-fallback mode if DB is unavailable.');
    return false;
  }
};

module.exports = connectDB;
