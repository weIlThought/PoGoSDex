const request = require("supertest");

describe("GET /status/uptime", () => {
  const originalKey = process.env.UPTIMEROBOT_API_KEY;
  let originalFetch;

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
    if (originalFetch) {
      global.fetch = originalFetch;
      originalFetch = undefined;
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

  it("returns sanitized payload when API is reachable", async () => {
    process.env.UPTIMEROBOT_API_KEY = "dummy";
    const apiResponse = {
      stat: "ok",
      monitors: [
        {
          status: 2,
          all_time_uptime_ratio: "99.95",
          create_datetime: 1_700_000_000,
        },
      ],
    };

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => apiResponse,
    });

    const { app } = await loadServer();
    const res = await request(app)
      .get("/status/uptime")
      .set("user-agent", "Mozilla/5.0");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: "up",
      statusCode: 2,
      uptimeRatio: 99.95,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.uptimerobot.com/v2/getMonitors",
      expect.objectContaining({ method: "POST" })
    );
  });
});
