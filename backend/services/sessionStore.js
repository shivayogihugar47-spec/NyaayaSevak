const { queryWithRetry } = require("./db");

// Helper to get session from Postgres
async function getSession(sessionId) {
  try {
    const res = await queryWithRetry(
      "SELECT data FROM sessions WHERE id = $1",
      [sessionId],
    );
    if (res.rows.length > 0) {
      return res.rows[0].data;
    }
  } catch (err) {
    console.error("getSession error:", err);
  }
  return null;
}

// Helper to save session to Postgres
async function saveSession(sessionId, sessionData) {
  try {
    await queryWithRetry(
      "INSERT INTO sessions (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
      [sessionId, JSON.stringify(sessionData)],
    );
  } catch (err) {
    console.error("saveSession error:", err);
  }
}

// In-memory fallback for legacy code (will be overwritten if accessed directly, but we will patch the routes to use get/save)
const sessionStore = {};
const voiceSourcesStore = {};

module.exports = {
  sessionStore,
  voiceSourcesStore,
  getSession,
  saveSession,
};
