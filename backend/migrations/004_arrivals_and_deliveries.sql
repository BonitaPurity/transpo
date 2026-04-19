CREATE TABLE IF NOT EXISTS arrivals (
  id TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL,
  "busId" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  destination TEXT NOT NULL,
  "travelDate" TEXT NOT NULL,
  "departureTime" TEXT NOT NULL,
  "expectedArrivalAt" TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'En Route',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arrivals_date ON arrivals ("travelDate");

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  "trackingCode" TEXT NOT NULL UNIQUE,
  "tripId" TEXT,
  "travelDate" TEXT,
  destination TEXT,
  "senderName" TEXT,
  "senderPhone" TEXT,
  "receiverName" TEXT NOT NULL,
  "receiverPhone" TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_trip ON deliveries ("tripId");
CREATE INDEX IF NOT EXISTS idx_deliveries_receiver_phone ON deliveries ("receiverPhone");
