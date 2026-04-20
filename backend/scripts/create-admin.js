const db = require('../src/db-json');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

(async () => {
  await db.initDb();

  const email = requireEnv('ADMIN_EMAIL').trim().toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const name = (process.env.ADMIN_NAME || 'Admin').trim();
  const phone = (process.env.ADMIN_PHONE || '').trim();
  const role = (process.env.ADMIN_ROLE || 'admin').trim();

  const existing = await db.findUserByEmail(email);
  if (existing) {
    console.log(`Admin already exists: ${email}. Updating password...`);
    await db.updateUserPassword(existing.id, password);
    console.log(`Password updated for ${email}`);
    await db.closePool();
    process.exit(0);
  }

  await db.createUser({
    name,
    email,
    phone,
    password,
    role,
  });

  console.log(`Created ${role}: ${email}`);
  await db.closePool();
})().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  try {
    await db.closePool();
  } catch {}
  process.exit(1);
});

