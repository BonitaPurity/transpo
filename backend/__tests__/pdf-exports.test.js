const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

function makeTempDir() {
  const p = path.join(os.tmpdir(), `transpo-pdf-test-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function binaryParser(res, callback) {
  res.setEncoding('binary');
  res.data = '';
  res.on('data', (chunk) => {
    res.data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(res.data, 'binary'));
  });
}

describe('PDF export endpoints', () => {
  const storageDir = makeTempDir();
  process.env.JSON_STORAGE_DIR = storageDir;

  const db = require('../src/db-json');
  const app = require('../src/index');

  const sign = ({ id, role }) =>
    jwt.sign({ id, email: `${role}@test.local`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  let user;

  beforeAll(async () => {
    await db.initDb();

    const bus = await db.createBus({
      id: 'bus_pdf_1',
      tag: 'PDF-001',
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
      id: 'sch_pdf_1',
      hubId: 'hub_east',
      destination: 'Jinja',
      departureTime: '08:00 AM',
      status: 'On Time',
      price: 1000,
      busType: 'Standard',
      duration: '1 hr',
      seatsAvailable: 45,
    });

    const today = new Date().toISOString().slice(0, 10);
    const departure = await db.createDeparture({
      id: 'dep_pdf_1',
      scheduleId: schedule.id,
      busId: bus.id,
      travelDate: today,
      status: 'Scheduled',
      seatCapacity: 45,
    });

    user = await db.createUser({
      name: 'PDF User',
      email: `pdf.user.${Date.now()}@example.com`,
      phone: '+256700000010',
      password: 'Password123!',
      role: 'user',
    });

    await db.createBooking({
      scheduleId: schedule.id,
      departureId: departure.id,
      userId: user.id,
      passengerName: 'PDF Passenger',
      phoneNumber: '+256700000010',
      paymentStatus: 'Completed',
      totalAmount: 1000,
      travelDate: today,
    });
  });

  afterAll(async () => {
    await db.closePool();
    try {
      fs.rmSync(storageDir, { recursive: true, force: true });
    } catch {}
  });

  it('exports operational audit manifest as PDF', async () => {
    const token = sign({ id: 'admin_pdf', role: 'admin' });
    const resp = await request(app)
      .get('/api/admin/manifest/export?format=pdf')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binaryParser);

    expect(resp.status).toBe(200);
    expect(resp.headers['content-type']).toMatch(/application\/pdf/);
    expect(resp.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('exports admin bookings as PDF', async () => {
    const token = sign({ id: 'admin_pdf', role: 'admin' });
    const resp = await request(app)
      .get('/api/admin/bookings/export?format=pdf&paymentStatus=Completed')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binaryParser);

    expect(resp.status).toBe(200);
    expect(resp.headers['content-type']).toMatch(/application\/pdf/);
    expect(resp.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('exports user bookings as PDF for the authenticated user', async () => {
    const token = sign({ id: user.id, role: 'user' });
    const resp = await request(app)
      .get(`/api/bookings/user/${encodeURIComponent(user.id)}/export?format=pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binaryParser);

    expect(resp.status).toBe(200);
    expect(resp.headers['content-type']).toMatch(/application\/pdf/);
    expect(resp.body.slice(0, 4).toString()).toBe('%PDF');
  });
});

