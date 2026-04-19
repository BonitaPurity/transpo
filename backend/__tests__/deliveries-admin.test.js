const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

function makeTempDir() {
  const p = path.join(os.tmpdir(), `transpo-test-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

describe('Admin Deliveries tab (tracking + received toggle + contact lookup + arrival)', () => {
  const storageDir = makeTempDir();
  process.env.JSON_STORAGE_DIR = storageDir;

  const db = require('../src/db-json');
  const app = require('../src/index');

  const sign = (role = 'admin') =>
    jwt.sign({ id: 'u_admin_test', email: 'admin@test.local', role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  let created;

  beforeAll(async () => {
    await db.initDb();

    const bus = await db.createBus({
      id: 'bus_test_1',
      tag: 'TST-001',
      hubId: 'hub_east',
      destination: 'Jinja',
      status: 'Active',
      speed: 40,
      battery: 90,
      gpsLat: 0.0,
      gpsLng: 0.0,
      seatCapacity: 45,
      approved: true,
    });

    const schedule = await db.createSchedule({
      id: 'sch_test_1',
      hubId: 'hub_east',
      destination: 'Jinja',
      departureTime: '08:00 AM',
      status: 'Active',
      price: 1000,
      busType: 'Standard',
      duration: '1 hr',
      seatsAvailable: 45,
    });

    const today = new Date().toISOString().slice(0, 10);
    const departure = await db.createDeparture({
      id: 'dep_test_1',
      scheduleId: schedule.id,
      busId: bus.id,
      travelDate: today,
      status: 'Scheduled',
      seatCapacity: 45,
    });

    const user = await db.createUser({
      name: 'Delivery User',
      email: `delivery.user.${Date.now()}@example.com`,
      phone: '+256700000009',
      password: 'Password123!',
      role: 'user',
    });

    const out = await db.createUserDeliveryRequest({
      userId: user.id,
      departureId: departure.id,
      senderName: 'Sender',
      senderPhone: '+256700000111',
      receiverName: 'Receiver Name',
      receiverPhone: '+256700000222',
      description: 'Test parcel',
      contacts: [{ name: 'Alt Contact', phone: '+256700000333' }],
    });

    expect(out).toHaveProperty('delivery');
    const paid = await db.markDeliveryPaid(out.delivery.id);
    created = { paid, bus };
  });

  afterAll(async () => {
    await db.closePool();
    try {
      fs.rmSync(storageDir, { recursive: true, force: true });
    } catch {}
  });

  it('returns receiver contact lookup by tracking code', async () => {
    const token = sign('admin');
    const resp = await request(app)
      .get(`/api/admin/deliveries/${encodeURIComponent(created.paid.trackingCode)}/contact`)
      .set('Authorization', `Bearer ${token}`);

    expect(resp.status).toBe(200);
    expect(resp.body.success).toBe(true);
    expect(resp.body.data).toMatchObject({
      trackingCode: created.paid.trackingCode,
      receiverName: 'Receiver Name',
      receiverPhone: '+256700000222',
      alternatePhone: '+256700000333',
    });
  });

  it('enforces undo requirement when reverting a received parcel', async () => {
    const token = sign('admin');
    const tc = created.paid.trackingCode;

    const setReceived = await request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(tc)}/received`)
      .set('Authorization', `Bearer ${token}`)
      .send({ received: true });
    expect(setReceived.status).toBe(200);
    expect(setReceived.body.success).toBe(true);
    expect(setReceived.body.data.received).toBe(true);

    const revertWithoutUndo = await request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(tc)}/received`)
      .set('Authorization', `Bearer ${token}`)
      .send({ received: false });
    expect(revertWithoutUndo.status).toBe(409);
    expect(revertWithoutUndo.body.success).toBe(false);

    const revertWithUndo = await request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(tc)}/received`)
      .set('Authorization', `Bearer ${token}`)
      .send({ received: false, undo: true });
    expect(revertWithUndo.status).toBe(200);
    expect(revertWithUndo.body.success).toBe(true);
    expect(revertWithUndo.body.data.received).toBe(false);
  });

  it('marks parcels as Arrived when bus is within geofence and exposes timestamp to user tracking', async () => {
    const token = sign('logistics_operator');
    const tc = created.paid.trackingCode;

    await db.updateBusPosition(created.bus.id, { gpsLat: 0.4479, gpsLng: 33.2032, status: 'Arrived', speed: 0, battery: 88 });

    const adminList = await request(app)
      .get('/api/admin/deliveries')
      .set('Authorization', `Bearer ${token}`);

    expect(adminList.status).toBe(200);
    expect(adminList.body.success).toBe(true);

    const row = (adminList.body.data || []).find((x) => x.trackingCode === tc);
    expect(row).toBeTruthy();
    expect(row.enRouteStatus).toBe('Arrived');
    expect(row.arrivedAt).toBeTruthy();

    const publicTrack = await request(app).get(`/api/deliveries/${encodeURIComponent(tc)}`);
    expect(publicTrack.status).toBe(200);
    expect(publicTrack.body.success).toBe(true);
    expect(publicTrack.body.data.arrivedAt).toBeTruthy();
  });
});
