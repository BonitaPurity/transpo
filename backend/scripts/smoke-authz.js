const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const app = require('../src/index');
const db = require('../src/db-json');

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function expectStatus(results, label, req, expected) {
  const res = await req;
  results.push({
    label,
    got: res.status,
    expected,
    ok: res.status === expected,
  });
  return res;
}

(async () => {
  await db.initDb();
  const results = [];

  const user = await db.createUser({
    name: 'Role User',
    email: `role.user.${Date.now()}@ex.com`,
    phone: '+256700100100',
    password: 'Pass123456!',
    role: 'user',
  });
  const admin = await db.createUser({
    name: 'Role Admin',
    email: `role.admin.${Date.now()}@ex.com`,
    phone: '+256700100101',
    password: 'Pass123456!',
    role: 'admin',
  });
  const logistics = await db.createUser({
    name: 'Role Logistics',
    email: `role.log.${Date.now()}@ex.com`,
    phone: '+256700100102',
    password: 'Pass123456!',
    role: 'logistics_operator',
  });

  const userToken = sign(user);
  const adminToken = sign(admin);
  const logToken = sign(logistics);

  await expectStatus(
    results,
    'USER blocked /api/metrics/detailed',
    request(app).get('/api/metrics/detailed').set('Authorization', `Bearer ${userToken}`),
    403
  );
  await expectStatus(
    results,
    'ADMIN allowed /api/metrics/detailed',
    request(app).get('/api/metrics/detailed').set('Authorization', `Bearer ${adminToken}`),
    200
  );
  await expectStatus(
    results,
    'LOGISTICS blocked /api/metrics/detailed',
    request(app).get('/api/metrics/detailed').set('Authorization', `Bearer ${logToken}`),
    403
  );

  await expectStatus(
    results,
    'USER blocked /api/admin/deliveries',
    request(app).get('/api/admin/deliveries').set('Authorization', `Bearer ${userToken}`),
    403
  );
  await expectStatus(
    results,
    'ADMIN allowed /api/admin/deliveries',
    request(app).get('/api/admin/deliveries').set('Authorization', `Bearer ${adminToken}`),
    200
  );
  await expectStatus(
    results,
    'LOGISTICS allowed /api/admin/deliveries',
    request(app).get('/api/admin/deliveries').set('Authorization', `Bearer ${logToken}`),
    200
  );

  const bus = await db.createBus({
    id: 'bus_authz_1',
    tag: 'AUTHZ-001',
    hubId: 'hub_east',
    destination: 'Jinja',
    status: 'Active',
    speed: 40,
    battery: 90,
    gpsLat: 0,
    gpsLng: 0,
    seatCapacity: 45,
    approved: true,
  });
  const schedule = await db.createSchedule({
    id: 'sch_authz_1',
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
  const dep = await db.createDeparture({
    id: 'dep_authz_1',
    scheduleId: schedule.id,
    busId: bus.id,
    travelDate: today,
    status: 'Scheduled',
    seatCapacity: 45,
  });
  const created = await db.createUserDeliveryRequest({
    userId: user.id,
    departureId: dep.id,
    senderName: 'S',
    senderPhone: '+256700200200',
    receiverName: 'R',
    receiverPhone: '+256700200201',
    description: 'Authz parcel',
    contacts: [{ name: 'Alt', phone: '+256700200202' }],
  });
  const paid = await db.markDeliveryPaid(created.delivery.id);
  const tc = paid.trackingCode;

  await expectStatus(
    results,
    'LOGISTICS contact lookup',
    request(app).get(`/api/admin/deliveries/${encodeURIComponent(tc)}/contact`).set('Authorization', `Bearer ${logToken}`),
    200
  );
  await expectStatus(
    results,
    'USER blocked contact lookup',
    request(app).get(`/api/admin/deliveries/${encodeURIComponent(tc)}/contact`).set('Authorization', `Bearer ${userToken}`),
    403
  );

  await expectStatus(
    results,
    'LOGISTICS set received true',
    request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(tc)}/received`)
      .set('Authorization', `Bearer ${logToken}`)
      .send({ received: true }),
    200
  );
  await expectStatus(
    results,
    'LOGISTICS revert without undo',
    request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(tc)}/received`)
      .set('Authorization', `Bearer ${logToken}`)
      .send({ received: false }),
    409
  );
  await expectStatus(
    results,
    'LOGISTICS undo revert',
    request(app)
      .put(`/api/admin/deliveries/${encodeURIComponent(tc)}/received`)
      .set('Authorization', `Bearer ${logToken}`)
      .send({ received: false, undo: true }),
    200
  );

  const pdf = await request(app)
    .get('/api/admin/manifest/export?format=pdf')
    .set('Authorization', `Bearer ${adminToken}`);
  results.push({
    label: 'ADMIN manifest pdf content-type',
    got: pdf.headers['content-type'],
    expected: 'application/pdf',
    ok: String(pdf.headers['content-type'] || '').includes('application/pdf'),
  });

  console.log('\nEXTENDED AUTHZ/ENDPOINT RESULTS');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.label} | got=${r.got} expected=${r.expected}`);
  }

  await db.closePool();
})().catch(async (e) => {
  console.error(e);
  try {
    await db.closePool();
  } catch {}
  process.exit(1);
});

