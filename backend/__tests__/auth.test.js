const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';

const db = require('../src/db-json');
const app = require('../src/index');

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}

beforeAll(async () => {
  if (!testDbUrl) return;
  await db.initDb();
});

afterAll(async () => {
  if (!testDbUrl) return;
  await db.closePool();
});

describe(testDbUrl ? 'Backend auth API' : 'Backend auth API (skipped: no TEST_DATABASE_URL/DATABASE_URL)', () => {
  if (!testDbUrl) {
    it('skips because no database is configured for tests', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it('returns health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'OK' });
  });

  it('registers a new user and returns a JWT', async () => {
    const email = `test.user.${Date.now()}@example.com`;
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email,
        phone: '+256700000000',
        password: 'TestPass123!'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data.user).toMatchObject({ email, role: 'user' });
  });

  it('logins an existing user and returns a valid token', async () => {
    const email = `login.user.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Login User',
        email,
        phone: '+256700000001',
        password: 'LoginPass123!'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'LoginPass123!' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data).toHaveProperty('token');
    expect(loginResponse.body.data.user).toMatchObject({ email });

    const token = loginResponse.body.data.token;
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data).toMatchObject({ email, role: 'user' });
  });
});

