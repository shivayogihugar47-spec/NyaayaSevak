require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyzeRoutes = require('./routes/analyze');
const voiceRoutes = require('./routes/voice');

const app = express();
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
  console.log(`NyayaCheck Backend listening on port ${PORT}`);
});
