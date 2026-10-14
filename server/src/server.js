require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.enable('trust proxy');
const server = http.createServer(app);

// Initialize Socket.io
const clientOrigin = process.env.CLIENT_SERVICE_URL || process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Attach socket io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.CLIENT_SERVICE_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during local development
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Quizese API Server is operational',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/attempts', attemptRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.originalUrl} not found`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

// Socket.io Live multiplayer session manager
const liveSocketManager = require('./sockets/liveSocket');
liveSocketManager.init(io);

const PORT = process.env.PORT || 5000;

// Graceful listen handler
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [PORT IN USE] Port ${PORT} is already in use by another running instance.`);
    console.error(`👉 Run this in PowerShell to free port ${PORT}:`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    console.error('[Server Error]', err);
  }
});

// Connect DB and start only when this file is run directly. Vercel imports the
// Express application instead of opening its own listening port.
if (require.main === module) connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Quizese Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api/v1`);
  });
});
else {
  // Serverless hosts import the app; establish the shared MongoDB connection
  // without opening a listening port.
  connectDB();
}

// Export the HTTP server so Vercel can handle Socket.IO WebSocket upgrades.
// The Express app remains available to local tools through `.app`.
module.exports = server;
module.exports.app = app;
module.exports.server = server;
module.exports.io = io;
