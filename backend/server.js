require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const analyzeRoutes = require('./routes/analyze');
const voiceRoutes = require('./routes/voice');

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Security: Set security HTTP headers
app.use(helmet());

// 2. Security: Rate limiting to prevent brute-force & DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Apply the rate limiting middleware to all API calls
app.use('/api/', apiLimiter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup API routes
app.use('/api', analyzeRoutes);
app.use('/api/voice', voiceRoutes);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`NyayaCheck Backend listening on port ${PORT}`);
  });
}

module.exports = app;
