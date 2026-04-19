ALTER TABLE departures
  ADD COLUMN IF NOT EXISTS "seatCapacity" INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS "occupiedSeats" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_departures_schedule_date ON departures ("scheduleId", "travelDate");
