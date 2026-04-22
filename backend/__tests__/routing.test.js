const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.OSRM_CACHE_MAX_ENTRIES = '2';
process.env.OSRM_CACHE_TTL_MS = String(60 * 60 * 1000);
process.env.OSRM_CACHE_COORD_PRECISION = '4';
process.env.OSRM_FETCH_TIMEOUT_MS = '2000';

const app = require('../src/index');

describe('Backend routing API', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [32.5825, 0.3476],
                [32.6000, 0.3500],
                [32.6490, 0.3521],
              ],
            },
          },
        ],
      }),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns a route as [lat,lng] tuples', async () => {
    const response = await request(app).get(
      '/api/routing?srcLat=0.3476&srcLng=32.5825&destLat=0.3521&destLng=32.6490'
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(Array.isArray(response.body.data[0])).toBe(true);
    expect(response.body.data[0].length).toBe(2);
    expect(typeof response.body.data[0][0]).toBe('number');
    expect(typeof response.body.data[0][1]).toBe('number');
  });

  it('bounds the OSRM cache size', async () => {
    await request(app).get('/api/routing?srcLat=0.1001&srcLng=32.1001&destLat=0.2001&destLng=32.2001');
    await request(app).get('/api/routing?srcLat=0.1002&srcLng=32.1002&destLat=0.2002&destLng=32.2002');
    await request(app).get('/api/routing?srcLat=0.1003&srcLng=32.1003&destLat=0.2003&destLng=32.2003');

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body?.osrm?.cache?.size).toBeLessThanOrEqual(2);
  });
});

