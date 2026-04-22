const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_BYPASS_AUTH_ENABLED = 'true';
process.env.ADMIN_BYPASS_AUTH_ALLOW_IN_PROD = 'false';
process.env.NODE_ENV = 'test';

jest.mock('../src/db-json', () => ({
  getBuses: jest.fn(async () => []),
  createBus: jest.fn(async (bus) => ({ ...bus })),
  getBusById: jest.fn(async (id) => ({ id, approved: true, seatCapacity: 45, tag: 'UNIT-1', status: 'Active', battery: 100, gpsLat: 0, gpsLng: 0 })),
  updateBus: jest.fn(async (id, updates) => ({ id, ...updates })),
  createAlert: jest.fn(async () => ({ ok: true })),

  getScheduleById: jest.fn(async (id) => ({ id, hubId: 'hub_east', destination: 'Kampala', departureTime: '08:00 AM' })),
  createDeparture: jest.fn(async (dep) => ({ ...dep })),
  getDepartureById: jest.fn(async () => null),
  updateDeparture: jest.fn(async () => null),
  canDeleteDeparture: jest.fn(async () => true),
  deleteDeparture: jest.fn(async () => true),
  findScheduleByHubDestinationTime: jest.fn(async () => null),
  createSchedule: jest.fn(async (s) => ({ ...s })),

  updatePricingRoute: jest.fn(async (id, updates) => ({ id, ...updates })),
  getPricingRoutes: jest.fn(async () => []),

  listBusFares: jest.fn(async () => []),
  upsertBusFare: jest.fn(async (busId, fareAmount) => ({ busId, fareAmount })),

  listDeliveryFees: jest.fn(async () => []),
  upsertDeliveryFee: jest.fn(async (busId, feeAmount) => ({ busId, feeAmount })),

  listDeliveries: jest.fn(async () => []),
  markDeliveryArrived: jest.fn(async () => null),
  getDeliveryByTrackingCode: jest.fn(async () => null),
  getDeliveryContacts: jest.fn(async () => []),
  listDeliveryAuditLogs: jest.fn(async () => []),
  getDeliveryContactLookup: jest.fn(async () => null),
  updateDeliveryReceivedState: jest.fn(async () => null),
  updateDeliveryStatus: jest.fn(async () => null),
  createDeliveryAuditLog: jest.fn(async () => ({})),
  createDelivery: jest.fn(async (d) => ({ ...d, trackingCode: 'D-TEST' })),
  markDeliveryPaid: jest.fn(async (id) => ({ id, trackingCode: 'D-TEST', status: 'Pending', received: false })),

  initDb: jest.fn(async () => true),
  getDbMode: jest.fn(() => 'mock'),
  closePool: jest.fn(async () => true),
  archivePastDepartures: jest.fn(async () => true),
  computeExpectedArrivalAt: jest.fn(() => null),
  countOccupiedSeats: jest.fn(async () => 0),
  getDeparturesBetween: jest.fn(async () => []),
  getArrivalsBetween: jest.fn(async () => []),
  getArrivalById: jest.fn(async () => null),
  getTelemetryLogs: jest.fn(async () => []),
  logTelemetry: jest.fn(async () => true),
  resetOperationalData: jest.fn(async () => ({})),
  backupData: jest.fn(async () => ({})),
  recoverEntity: jest.fn(async () => true),
  listDeliveriesByUser: jest.fn(async () => []),
  listActiveDeliveriesByBus: jest.fn(async () => []),
  markDeliveryArrived: jest.fn(async () => null),
  createDeliveryAuditLog: jest.fn(async () => ({})),
}));

const app = require('../src/index');

describe('Admin bypass auth (whitelisted routes)', () => {
  it('allows bus creation without Authorization header when bypass is enabled', async () => {
    const res = await request(app)
      .post('/api/fleet')
      .send({ tag: 'UNIT-99', hubId: 'hub_east', seatCapacity: 45 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tag).toBe('UNIT-99');
  });

  it('allows departure creation without Authorization header when bypass is enabled', async () => {
    const res = await request(app)
      .post('/api/departures')
      .send({ scheduleId: 'sch_01', busId: 'bus_1', travelDate: '2026-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.busId).toBe('bus_1');
  });

  it('allows fare matrix updates without Authorization header when bypass is enabled', async () => {
    const res = await request(app)
      .put('/api/pricing/route_1')
      .send({ currentPrice: 50000 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('route_1');
  });

  it('does not bypass non-whitelisted admin endpoints', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

