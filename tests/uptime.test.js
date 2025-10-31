import request from 'supertest';
import { jest } from '@jest/globals';

// Helper to spin up the app with a mocked fetch and optional API key
async function makeServerWithMock({ mockResponses = [], apiKey = 'test-key' } = {}) {
  // Each call resets module registry and env
  jest.resetModules();

  // Prepare a fetch mock which consumes mockResponses in order
  const fetchMock = jest.fn(async () => {
    if (mockResponses.length === 0) {
      throw new Error('No mockResponses left for fetch');
    }
    const next = mockResponses.shift();
    if (next instanceof Error) throw next;
    return next;
  });

  // Mock node-fetch before importing server
  const { default: mockedFetch } = await jest.unstable_mockModule('node-fetch', () => ({
    default: fetchMock,
  }));
  // Silence unused var lint
  void mockedFetch;

  // Configure env
  if (apiKey === null) {
    // Ensure dotenv does not repopulate from .env by keeping the var defined
    process.env.UPTIMEROBOT_API_KEY = '';
  } else {
    process.env.UPTIMEROBOT_API_KEY = apiKey;
  }

  const { createServer } = await import('../server/server.js');
  const { app } = await createServer();
  return { app, fetchMock };
}

function mkOkResponse(json) {
  return {
    ok: true,
    status: 200,
    async json() {
      return json;
    },
  };
}

function mkBadResponse(status = 500) {
  return {
    ok: false,
    status,
    async json() {
      return { error: 'upstream error' };
    },
  };
}

describe('GET /status/uptime', () => {
  test('returns 501 when no API key configured', async () => {
    const { app } = await makeServerWithMock({ apiKey: null, mockResponses: [] });
    const res = await request(app).get('/status/uptime');
    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: 'Uptime monitoring not configured' });
  });

  test('maps upstream status=2 to state "up" and caches result', async () => {
    const nowTs = 1_690_000_000;
    const { app, fetchMock } = await makeServerWithMock({
      mockResponses: [
        mkOkResponse({
          stat: 'ok',
          monitors: [{ status: 2, all_time_uptime_ratio: '99.99', create_datetime: nowTs }],
        }),
      ],
    });

    const first = await request(app).get('/status/uptime');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      state: 'up',
      statusCode: 2,
      uptimeRatio: 99.99,
      checkedAt: nowTs * 1000,
    });

    const second = await request(app).get('/status/uptime');
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from cache
  });

  test('maps status 9 -> degraded, 0/1/8 -> down', async () => {
    const { app } = await makeServerWithMock({
      mockResponses: [
        mkOkResponse({
          stat: 'ok',
          monitors: [{ status: 9, all_time_uptime_ratio: '80', create_datetime: 1700000000 }],
        }),
      ],
    });
    const res1 = await request(app).get('/status/uptime');
    expect(res1.status).toBe(200);
    expect(res1.body.state).toBe('degraded');

    // New server instance for next mapping
    const { app: app2 } = await makeServerWithMock({
      mockResponses: [
        mkOkResponse({
          stat: 'ok',
          monitors: [{ status: 0, all_time_uptime_ratio: '75', create_datetime: 1700000000 }],
        }),
      ],
    });
    const res2 = await request(app2).get('/status/uptime');
    expect(res2.status).toBe(200);
    expect(res2.body.state).toBe('down');
  });

  test('returns 502 on upstream HTTP error', async () => {
    const { app } = await makeServerWithMock({ mockResponses: [mkBadResponse(503)] });
    const res = await request(app).get('/status/uptime');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch uptime status' });
  });

  test('returns 502 on invalid payload', async () => {
    const { app } = await makeServerWithMock({ mockResponses: [mkOkResponse({ stat: 'fail' })] });
    const res = await request(app).get('/status/uptime');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch uptime status' });
  });
});

describe('GET /api/uptime', () => {
  test('returns parsed numeric uptime when available', async () => {
    const { app } = await makeServerWithMock({
      mockResponses: [mkOkResponse({ monitors: [{ all_time_uptime_ratio: '97.42' }] })],
    });

    const res = await request(app).get('/api/uptime');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uptime: 97.42 });
  });

  test('returns null when uptime missing or on error', async () => {
    const { app } = await makeServerWithMock({ mockResponses: [mkOkResponse({ monitors: [] })] });
    const res1 = await request(app).get('/api/uptime');
    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({ uptime: null });

    const { app: app2 } = await makeServerWithMock({ mockResponses: [mkBadResponse(500)] });
    const res2 = await request(app2).get('/api/uptime');
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ uptime: null });
  });
});
