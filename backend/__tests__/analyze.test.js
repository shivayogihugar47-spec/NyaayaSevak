const request = require("supertest");
const app = require("../server");
const { sessionStore } = require("../services/sessionStore");
const ragService = require("../services/ragService");

jest.mock("../services/ragService");

describe("Analyze API endpoints", () => {
  beforeEach(() => {
    Object.keys(sessionStore).forEach((key) => delete sessionStore[key]);
    jest.clearAllMocks();
  });

  test("POST /api/upload handles text correctly", async () => {
    ragService.analyzeDocumentLevelRisks.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/upload")
      .send({ text: "Sample rental agreement text", userId: "user_123" });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.clauses.length).toBeGreaterThan(0);
    expect(sessionStore[res.body.sessionId].userId).toBe("user_123");
  });

  test("POST /api/analyze-clause handles analysis correctly", async () => {
    const sessionId = "test_session_1";
    sessionStore[sessionId] = {
      userId: "user_123",
      clauses: [{ id: "clause_1", text: "Penalty of 5000 Rs" }],
      flags: {},
    };

    ragService.processClause.mockResolvedValue({
      category: "Penalty",
      risk_level: "High",
    });

    const res = await request(app)
      .post("/api/analyze-clause")
      .send({ sessionId, clauseId: "clause_1" });

    expect(res.status).toBe(200);
    expect(res.body.analysis.risk_level).toBe("High");
  });

  test("POST /api/chat responds properly", async () => {
    const sessionId = "test_session_1";
    sessionStore[sessionId] = {
      userId: "user_123",
      clauses: [{ id: "clause_1", text: "Rent is 15000" }],
      flags: {},
    };

    ragService.generateChatResponse.mockResolvedValue({
      answer: "The rent is 15000.",
      sources: [],
    });

    const res = await request(app)
      .post("/api/chat")
      .send({ sessionId, question: "What is the rent?" });

    expect(res.status).toBe(200);
    expect(res.body.answer).toContain("15000");
  });
});
