const request = require("supertest");
const express = require("express");

// Import the app instance for testing
const app = require("../server");

describe("Health Check API Endpoint", () => {
  it("should return a 200 OK status for GET /api/health", async () => {
    const res = await request(app).get("/api/health");

    // Testing - validation of functionality
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("should apply security headers (helmet)", async () => {
    const res = await request(app).get("/api/health");

    // Security - ensuring safe and responsible implementation
    expect(res.headers).toHaveProperty("x-xss-protection");
    expect(res.headers["x-powered-by"]).toBeUndefined(); // Helmet removes this
  });
});
