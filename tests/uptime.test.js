const request = require("supertest");

describe("GET /status/uptime", () => {
  const originalKey = process.env.UPTIMEROBOT_API_KEY;

  const loadServer = async () => {
    const { createServer } = await import("../server/server.js");
    return createServer();
  };

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
    const { createServer } = await import("../server/server.js");
    process.env.UPTIMEROBOT_API_KEY = "";
    const { app } = await createServer();

    const res = await request(app)
      .get("/status/uptime")
      .set("user-agent", "Mozilla/5.0");
    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
  });

  it("returns sanitized payload when API is reachable (real API call)", async () => {
    process.env.UPTIMEROBOT_API_KEY = originalKey; // Setze hier deinen echten Key!
    const { app } = await loadServer();
    const res = await request(app)
      .get("/status/uptime")
      .set("user-agent", "Mozilla/5.0");

    // Akzeptiere 200 (Erfolg) oder 502 (API unreachable)
    expect([200, 502]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toMatchObject({
        state: "up",
        statusCode: 2,
        uptimeRatio: expect.any(Number),
      });
    } else {
      expect(res.body).toHaveProperty("error");
    }
  });
});
