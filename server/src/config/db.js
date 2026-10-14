const mongoose = require('mongoose');

let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  // Serverless requests can arrive together after a cold start. Reuse one
  // connection attempt so every request does not wait for its own handshake.
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
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
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

module.exports = connectDB;
