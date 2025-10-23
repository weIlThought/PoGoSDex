
import request from "supertest";
import { createServer } from "../server/server.js";
import { jest } from "@jest/globals";

describe("GET /status/uptime", () => {
  const originalKey = process.env.UPTIMEROBOT_API_KEY;

  afterEach(() => {
    if (originalKey) {
      process.env.UPTIMEROBOT_API_KEY = originalKey;
    } else {
      delete process.env.UPTIMEROBOT_API_KEY;
    }
    jest.resetModules();
  });

  it("returns 501 when no API key is configured", async () => {
    delete process.env.UPTIMEROBOT_API_KEY;
    process.env.UPTIMEROBOT_API_KEY = "";

    const { app } = await createServer();
    const res = await request(app)
      .get("/status/uptime")
      .set("user-agent", "Mozilla/5.0");

    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
  });

  it("returns sanitized payload when API is reachable (real API call)", async () => {
    process.env.UPTIMEROBOT_API_KEY = originalKey; 

    const { app } = await createServer();
    const res = await request(app)
      .get("/status/uptime")
      .set("user-agent", "Mozilla/5.0");

    expect([200, 502]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toMatchObject({
        state: expect.any(String),
        statusCode: expect.any(Number),
      });
    } else {
      expect(res.body).toHaveProperty("error");
    }
  });
});
