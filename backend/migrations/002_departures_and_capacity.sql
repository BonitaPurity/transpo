ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS "seatCapacity" INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS departures (
  id TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  "busId" TEXT NOT NULL REFERENCES buses(id) ON DELETE RESTRICT,
  "travelDate" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS "departureId" TEXT REFERENCES departures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departures_date ON departures ("travelDate");
CREATE INDEX IF NOT EXISTS idx_departures_schedule ON departures ("scheduleId");
CREATE INDEX IF NOT EXISTS idx_bookings_departure ON bookings ("departureId");

