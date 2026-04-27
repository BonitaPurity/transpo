const request = require('supertest');
const os = require('os');
const path = require('path');
const fs = require('fs');

jest.setTimeout(20000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_MODE = 'json';
process.env.JSON_SEED_DEMO_DATA = 'true';
process.env.SEED_BASE_DATA = 'true';
process.env.ADMIN_BYPASS_AUTH_ENABLED = 'false';

process.env.JSON_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'transpo-it-'));

const db = require('../src/db-json');
const app = require('../src/index');

describe('Admin/user module integration', () => {
  let adminToken;
  let userToken;
  let userId;
  let schedule;
  let departure;

  beforeAll(async () => {
    await db.initDb();

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@transpo.ug', password: 'admin123' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.token;

    const email = `integration.user.${Date.now()}@example.com`;
    const userRegister = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Integration User',
        email,
        phone: '+256700111222',
        password: 'PassWord123!',
      });
    expect(userRegister.status).toBe(201);
    userToken = userRegister.body.data.token;
    userId = userRegister.body.data.user.id;

    const schedulesRes = await request(app).get('/api/schedules');
    expect(schedulesRes.status).toBe(200);
    schedule = schedulesRes.body.data.find((s) => s.id === 'sch_01') || schedulesRes.body.data[0];
    expect(schedule).toBeTruthy();

    const fleetRes = await request(app)
      .get('/api/fleet')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fleetRes.status).toBe(200);
    const bus = fleetRes.body.data.find((b) => b.approved !== false) || fleetRes.body.data[0];
    expect(bus).toBeTruthy();

    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();

    const createdDeparture = await request(app)
      .post('/api/departures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scheduleId: schedule.id, busId: bus.id, travelDate: tomorrow });
    expect(createdDeparture.status).toBe(201);
    departure = createdDeparture.body.data;
    expect(departure).toBeTruthy();
  });

  afterAll(async () => {
    await db.closePool();
  });

  it('syncs fare matrix (bus fare) -> user bookings pricing', async () => {
    const fareAmount = 12345;
    const updateFare = await request(app)
      .put(`/api/admin/bus-fares/${encodeURIComponent(departure.busId)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fareAmount });
    expect(updateFare.status).toBe(200);
    expect(updateFare.body.success).toBe(true);

    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scheduleId: departure.scheduleId,
        departureId: departure.id,
        passengerName: 'Integration User',
        phoneNumber: '+256700111222',
        travelDate: departure.travelDate,
      });
    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.success).toBe(true);
    expect(bookingRes.body.data.totalAmount).toBe(fareAmount);

    const listRes = await request(app)
      .get(`/api/bookings/user/${encodeURIComponent(userId)}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.status).toBe(200);
    const created = listRes.body.data.find((b) => b.id === bookingRes.body.data.id);
    expect(created).toBeTruthy();
    expect(created).toHaveProperty('destination');
    expect(created).toHaveProperty('departureTime');
  });

  it('syncs user delivery -> payment -> admin ops -> user tracking + my deliveries', async () => {
    const createDelivery = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        departureId: departure.id,
        description: 'Integration parcel',
        receiverName: 'Receiver',
        receiverPhone: '+256700333444',
      });
    expect(createDelivery.status).toBe(201);
    expect(createDelivery.body.success).toBe(true);
    const deliveryId = createDelivery.body.data.deliveryId;
    const trackingCode = createDelivery.body.data.trackingCode;
    expect(deliveryId).toBeTruthy();
    expect(trackingCode).toBeTruthy();

    const pay = await request(app)
      .post('/api/payments/mobile-money')
      .send({ deliveryId, phoneNumber: '+256700111222', provider: 'MTN' });
    expect(pay.status).toBe(200);
    expect(pay.body.success).toBe(true);

    const trackedBefore = await request(app).get(`/api/deliveries/${encodeURIComponent(trackingCode)}`);
    expect(trackedBefore.status).toBe(200);
    expect(trackedBefore.body.success).toBe(true);

    const adminList = await request(app)
      .get('/api/admin/deliveries')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    const adminRow = adminList.body.data.find((d) => d.trackingCode === trackingCode);
    expect(adminRow).toBeTruthy();

    const updateStatus = await request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(trackingCode)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'In Transit' });
    expect(updateStatus.status).toBe(200);
    expect(updateStatus.body.success).toBe(true);

    const trackedAfter = await request(app).get(`/api/deliveries/${encodeURIComponent(trackingCode)}`);
    expect(trackedAfter.status).toBe(200);
    expect(trackedAfter.body.data.status).toBe('In Transit');

    const mine = await request(app)
      .get('/api/deliveries/mine')
      .set('Authorization', `Bearer ${userToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.some((d) => d.trackingCode === trackingCode)).toBe(true);
  });

  it('exposes fleet positions for user live tracking (authenticated)', async () => {
    const live = await request(app)
      .get('/api/fleet/live')
      .set('Authorization', `Bearer ${userToken}`);
    expect(live.status).toBe(200);
    expect(live.body.success).toBe(true);
    expect(Array.isArray(live.body.data)).toBe(true);
    expect(live.body.data.length).toBeGreaterThan(0);
    expect(live.body.data[0]).toHaveProperty('gpsLat');
    expect(live.body.data[0]).toHaveProperty('gpsLng');
  });

  it('keeps ops intelligence metrics consistent with new activity', async () => {
    const metrics = await request(app)
      .get('/api/metrics/detailed')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.success).toBe(true);
    expect(metrics.body.data.todayBookings).toBeGreaterThanOrEqual(1);
    expect(metrics.body.data).toHaveProperty('challenges');
  });
});
