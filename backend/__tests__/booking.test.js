const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';

const db = require('../src/db-json');
const app = require('../src/index');

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}

describe(testDbUrl ? 'Backend booking API' : 'Backend booking API (skipped: no TEST_DATABASE_URL/DATABASE_URL)', () => {
  if (!testDbUrl) {
    it('skips because no database is configured for tests', () => {
      expect(true).toBe(true);
    });
    return;
  }

  let userToken;
  let adminToken;
  let userId;

  beforeAll(async () => {
    await db.initDb();
    
    // Register a user to test duplicate bookings
    const email = `booking.user.${Date.now()}@example.com`;
    const resUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Booking User',
        email,
        phone: '+256700000002',
        password: 'PassWord123!'
      });
    userToken = resUser.body.data.token;
    userId = resUser.body.data.user.id;

    // Login default admin
    const resAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@transpo.ug', password: 'admin123' });
    adminToken = resAdmin.body.data.token;
  });

  afterAll(async () => {
    await db.closePool();
  });

  it('creates a booking successfully', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scheduleId: 'sch_01',
        passengerName: 'John Doe',
        phoneNumber: '+256770000001',
        totalAmount: 40000
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.scheduleId).toBe('sch_01');
    expect(response.body.data.passengerName).toBe('John Doe');
    expect(response.body.data.paymentStatus).toBe('Pending');
  });

  it('prevents user from double booking the same schedule', async () => {
    // First booking
    await request(app)
      .post('/api/bookings')
      .send({
        scheduleId: 'sch_02',
        userId: userId,
        passengerName: 'Booking User',
        phoneNumber: '+256700000002',
        totalAmount: 50000
      });

    // Attempt second booking
    const response = await request(app)
      .post('/api/bookings')
      .send({
        scheduleId: 'sch_02',
        userId: userId,
        passengerName: 'Booking User',
        phoneNumber: '+256700000002',
        totalAmount: 50000
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/active booking/i);
  });

  it('allows admin to list all bookings', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

