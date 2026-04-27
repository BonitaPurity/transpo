const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.ADMIN_BYPASS_AUTH_ENABLED = 'false';

const db = require('../src/db-json');
const app = require('../src/index');

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('Backend fleet soft delete', () => {
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!testDbUrl) {
    it('skips because no database is configured for tests', () => {
      expect(true).toBe(true);
    });
    return;
  }

  let adminToken;
  let createdBusId;

  beforeAll(async () => {
    await db.initDb();
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@transpo.ug', password: 'admin123' });
    expect(login.status).toBe(200);
    adminToken = login.body.data.token;
    expect(adminToken).toBeTruthy();
  });

  afterAll(async () => {
    await db.closePool();
  });

  it('creates a bus and returns it in fleet listing', async () => {
    const tag = `SOFT-${Date.now().toString().slice(-6)}`;
    const create = await request(app)
      .post('/api/fleet')
      .set(authHeader(adminToken))
      .send({ tag, hubId: 'hub_east', destination: 'Jinja', seatCapacity: 45 });

    expect(create.status).toBe(201);
    expect(create.body.success).toBe(true);
    createdBusId = create.body.data.id;
    expect(createdBusId).toBeTruthy();

    const list = await request(app).get('/api/fleet?hubId=hub_east').set(authHeader(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
    expect(list.body.data.some((b) => b.id === createdBusId)).toBe(true);
  });

  it('soft deletes a bus and removes it from fleet and bus fares', async () => {
    const del = await request(app)
      .delete(`/api/fleet/${encodeURIComponent(createdBusId)}`)
      .set(authHeader(adminToken))
      .send({ reason: 'retired' });

    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);
    expect(del.body.data.deletedAt).toBeTruthy();
    expect(del.body.data.approved).toBe(false);

    const list = await request(app).get('/api/fleet?hubId=hub_east').set(authHeader(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.data.some((b) => b.id === createdBusId)).toBe(false);

    const fares = await request(app).get('/api/admin/bus-fares').set(authHeader(adminToken));
    expect(fares.status).toBe(200);
    expect(fares.body.success).toBe(true);
    expect(fares.body.data.some((r) => r.busId === createdBusId)).toBe(false);
  });

  it('rejects updating a deleted bus', async () => {
    const upd = await request(app)
      .put(`/api/fleet/${encodeURIComponent(createdBusId)}`)
      .set(authHeader(adminToken))
      .send({ destination: 'Kampala' });
    expect(upd.status).toBe(400);
    expect(upd.body.success).toBe(false);
  });
});

