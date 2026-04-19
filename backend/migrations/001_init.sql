CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','admin'))
);

CREATE TABLE IF NOT EXISTS hubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  capacity TEXT,
  lat REAL,
  lng REAL,
  color TEXT,
  code TEXT
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  "hubId" TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  destination TEXT,
  "departureTime" TEXT,
  status TEXT,
  price INTEGER,
  "busType" TEXT,
  duration TEXT,
  "seatsAvailable" INTEGER
);

CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  "hubId" TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  destination TEXT,
  status TEXT,
  speed INTEGER,
  battery INTEGER,
  "gpsLat" REAL,
  "gpsLng" REAL,
  "lastSeen" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id SERIAL PRIMARY KEY,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  "isRead" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry_logs (
  id SERIAL PRIMARY KEY,
  "busId" TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  battery INTEGER,
  speed INTEGER,
  "gpsLat" REAL,
  "gpsLng" REAL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  "userId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "passengerName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL,
  "totalAmount" INTEGER,
  "travelDate" TEXT DEFAULT 'Today',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  metric TEXT NOT NULL,
  solution TEXT,
  impact TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_routes (
  id TEXT PRIMARY KEY,
  tag TEXT,
  hub TEXT,
  "hubCode" TEXT,
  destination TEXT,
  distance TEXT,
  "currentPrice" INTEGER,
  "basePrice" INTEGER,
  "peakSurcharge" INTEGER,
  "isPeak" BOOLEAN,
  color TEXT
);
