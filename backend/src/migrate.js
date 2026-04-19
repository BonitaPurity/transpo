const dotenv = require('dotenv');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(__dirname, '..', `.env.${env}`) });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = require('./db-json');

async function main() {
  await db.initDb();
  await db.closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


