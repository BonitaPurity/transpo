CREATE TABLE IF NOT EXISTS bus_fares (
  "busId" TEXT PRIMARY KEY REFERENCES buses(id) ON DELETE CASCADE,
  "fareAmount" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bus_fares_amount ON bus_fares ("fareAmount");
