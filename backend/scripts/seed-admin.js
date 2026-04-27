/**
 * TRANSPO HUB — One-time admin seed script
 * Run this on Render via Shell to create/reset admin accounts
 *
 * Usage (in Render Shell):
 *   node scripts/seed-admin.js
 *
 * Or to reset a specific admin password:
 *   ADMIN_EMAIL=admin@transpo.ug ADMIN_PASSWORD=NewPassword123 node scripts/seed-admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { createStore } = require('../src/storage/store');

const store = createStore({ logger: console });

const ADMINS = [
  { email: 'admin@transpo.ug',    password: process.env.ADMIN_PASSWORD || 'admin123',   name: 'Admin',    role: 'admin' },
  { email: 'ops@transpo.ug',      password: 'ops2024',      name: 'Ops',      role: 'admin' },
  { email: 'dispatch@transpo.ug', password: 'dispatch1',    name: 'Dispatch', role: 'admin' },
];

function nowIso() { return new Date().toISOString(); }
function randomId() { return `usr_${Math.floor(Math.random() * 900000 + 100000)}`; }

async function run() {
  console.log('Initializing store...');
  if (typeof store.init === 'function') await store.init();
  await store.ensureEntities(['users']);

  const targetEmail = process.env.ADMIN_EMAIL;
  const targetPassword = process.env.ADMIN_PASSWORD;

  if (targetEmail && targetPassword) {
    // Reset mode: update a specific admin's password
    console.log(`\nResetting password for ${targetEmail}...`);
    const users = await store.readAll('users');
    const user = users.find(u => u.email === targetEmail);
    if (!user) {
      console.error(`User ${targetEmail} not found. Run without ADMIN_EMAIL to seed all admins.`);
      process.exit(1);
    }
    const hash = bcrypt.hashSync(targetPassword, 10);
    await store.updateById('users', user.id, (u) => ({ ...u, password: hash, updatedAt: nowIso() }));
    console.log(`✅ Password reset for ${targetEmail}`);
    process.exit(0);
  }

  // Seed mode: create all admins if they don't exist
  console.log('\nSeeding admin accounts...');
  const users = await store.readAll('users');

  for (const admin of ADMINS) {
    const existing = users.find(u => String(u.email).toLowerCase() === admin.email.toLowerCase());
    if (existing) {
      console.log(`  SKIP  ${admin.email} already exists (id: ${existing.id})`);
      continue;
    }
    const hash = bcrypt.hashSync(admin.password, 10);
    const record = {
      id: randomId(),
      name: admin.name,
      email: admin.email,
      phone: 'N/A',
      password: hash,
      role: admin.role,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      accessCount: 0,
      lastAccessAt: null,
    };
    await store.create('users', record);
    console.log(`  ✅    Created ${admin.email} (id: ${record.id})`);
  }

  console.log('\nDone. You can now log in with:');
  console.log('  Email:    admin@transpo.ug');
  console.log('  Password: admin123');
  console.log('\nChange the password immediately after first login!');
  process.exit(0);
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
