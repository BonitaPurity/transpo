const bcrypt = require('bcryptjs');
const { createStore } = require('./storage/store');

const store = createStore({ logger: console });

const ENTITIES = [
  'users',
  'hubs',
  'schedules',
  'buses',
  'departures',
  'arrivals',
  'bookings',
  'system_alerts',
  'telemetry_logs',
  'challenges',
  'pricing_routes',
  'bus_fares',
  'delivery_fees',
  'deliveries',
  'delivery_contacts',
  'delivery_audit_logs',
];

const OPERATIONAL_ENTITIES = [
  'schedules',
  'buses',
  'departures',
  'arrivals',
  'bookings',
  'system_alerts',
  'telemetry_logs',
  'challenges',
  'pricing_routes',
  'bus_fares',
  'delivery_fees',
  'deliveries',
  'delivery_contacts',
  'delivery_audit_logs',
];

function nowIso() {
  return new Date().toISOString();
}

function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(value);
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asInt(value, fallback = 0) {
  return Math.round(asNumber(value, fallback));
}

function normalizePhone(value) {
  return String(value || '').trim();
}

function normalizeIdPrefix(prefix) {
  return `${prefix}_${Math.floor(Math.random() * 900000 + 100000)}`;
}

function randomTrackingCode() {
  return `D-${Math.floor(Math.random() * 900000 + 100000)}`;
}

async function withEntityDoc(entity, fn) {
  return store.withLock(entity, async () => {
    const doc = await store._readEntityUnsafe(entity);
    const out = await fn(doc);
    if (out && out.__write) {
      await store._writeEntityUnsafe(entity, doc);
      return out.value;
    }
    return out && Object.prototype.hasOwnProperty.call(out, 'value') ? out.value : out;
  });
}

function parseDepartureTimeToMinutes(timeStr) {
  const depTime = String(timeStr || '').trim();
  const match = depTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ap = match[3].toUpperCase();
  let hour24 = hh % 12;
  if (ap === 'PM') hour24 += 12;
  return hour24 * 60 + mm;
}

function parseDurationToMinutes(durationStr) {
  const raw = String(durationStr || '').trim().toLowerCase();
  const hrs = raw.match(/(\d+(?:\.\d+)?)\s*h/);
  const mins = raw.match(/(\d+)\s*m/);
  const h = hrs ? Number(hrs[1]) : 0;
  const m = mins ? Number(mins[1]) : 0;
  const total = Math.round(h * 60 + m);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function computeExpectedArrivalAt(travelDate, departureTime, durationStr) {
  const minsFromMidnight = parseDepartureTimeToMinutes(departureTime);
  const durationMins = parseDurationToMinutes(durationStr);
  if (minsFromMidnight === null || durationMins === null) return null;

  const parts = String(travelDate || '').split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const dt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  if (isNaN(dt.getTime())) return null;
  dt.setMinutes(minsFromMidnight + durationMins);
  return dt.toISOString();
}

async function syncFleetHubFare() {
  const [buses, hubs, fares, routes] = await Promise.all([
    store.readAll('buses'),
    store.readAll('hubs'),
    store.readAll('bus_fares'),
    store.readAll('pricing_routes'),
  ]);

  let changedFares = false;
  let changedRoutes = false;

  // 1. Ensure each approved bus has a fare record
  for (const bus of buses) {
    if (bus.approved === false) continue;
    const existingFare = fares.find((f) => f.busId === bus.id);
    if (!existingFare) {
      fares.push({
        id: normalizeIdPrefix('fare'),
        busId: bus.id,
        fareAmount: 15000, // Default baseline
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      changedFares = true;
    }
  }

  // 2. Sync pricing_routes with current hubs and buses if possible
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    const hub = hubs.find((h) => h.code === r.hubCode || h.id === r.hubId || h.name.includes(r.hub));
    if (hub && (r.color !== hub.color || r.hubCode !== hub.code)) {
      routes[i] = { ...r, color: hub.color, hubCode: hub.code, hub: hub.name.split(' ')[0] };
      changedRoutes = true;
    }
  }

  if (changedFares) await store.replaceAll('bus_fares', fares);
  if (changedRoutes) await store.replaceAll('pricing_routes', routes);

  return { changedFares, changedRoutes };
}

async function initDb() {
  if (typeof store.init === 'function') {
    await store.init();
  }
  await store.ensureEntities(ENTITIES);
  const seedDemo = process.env.JSON_SEED_DEMO_DATA === 'true';
  const seedBase = process.env.SEED_BASE_DATA === 'true' || seedDemo;

  // Always ensure hubs exist even if seedBase is false
  const hubSeeds = [
    ['hub_east', 'Namanve Hub (East)', 'East/Jinja Route', '150 buses/day', 0.3521, 32.5915, '#facc15', 'NMV'],
    ['hub_west', 'Busega Hub (West)', 'West/Mbarara Route', '200 buses/day', -0.3127, 31.7138, '#38bdf8', 'BSG'],
    ['hub_north', 'Kawempe Hub (North)', 'North/Gulu Route', '120 buses/day', 0.4502, 33.1998, '#fb923c', 'KWP'],
  ];
  await withEntityDoc('hubs', async (doc) => {
    let changed = false;
    for (const h of hubSeeds) {
      if (doc.records.some((x) => x.id === h[0])) continue;
      doc.records.push({ id: h[0], name: h[1], region: h[2], capacity: h[3], lat: h[4], lng: h[5], color: h[6], code: h[7] });
      changed = true;
    }
    return changed ? { __write: true, value: true } : { value: true };
  });

  // Always seed admin accounts regardless of seedDemo/seedBase flags
  const adminSeeds = [
    { email: 'admin@transpo.ug', password: 'admin123' },
    { email: 'ops@transpo.ug', password: 'ops2024' },
    { email: 'dispatch@transpo.ug', password: 'dispatch1' },
  ];
  for (const admin of adminSeeds) {
    const existing = await findUserByEmail(admin.email);
    if (!existing) {
      const name = admin.email.split('@')[0].replace(/^\w/, (c) => c.toUpperCase());
      await createUser({
        name,
        email: admin.email,
        phone: 'N/A',
        password: admin.password,
        role: 'admin',
      });
      console.log(`[Seed] Created admin account: ${admin.email}`);
    }
  }

  if (seedDemo) {
  const scheduleSeeds = [
    ['sch_01', 'hub_west', 'Mbarara', '08:00 AM', 'On Time', 40000, 'Kayoola EVS (Electric)', '4 hrs', 45],
    ['sch_02', 'hub_west', 'Kabale', '08:30 AM', 'On Time', 50000, 'Standard', '7 hrs', 12],
    ['sch_03', 'hub_east', 'Jinja', '09:00 AM', 'On Time', 20000, 'Kayoola EVS (Electric)', '1.5 hrs', 50],
    ['sch_04', 'hub_east', 'Mbale', '09:15 AM', 'Delayed', 35000, 'Standard', '4.5 hrs', 8],
    ['sch_05', 'hub_north', 'Gulu', '08:00 AM', 'On Time', 60000, 'Standard', '6 hrs', 25],
    ['sch_06', 'hub_north', 'Arua', '09:30 AM', 'On Time', 75000, 'Standard', '8 hrs', 40],
  ];
  await withEntityDoc('schedules', async (doc) => {
    for (const s of scheduleSeeds) {
      if (doc.records.some((x) => x.id === s[0])) continue;
      doc.records.push({
        id: s[0],
        hubId: s[1],
        destination: s[2],
        departureTime: s[3],
        status: s[4],
        price: s[5],
        busType: s[6],
        duration: s[7],
        seatsAvailable: s[8],
      });
    }
    return { __write: true, value: true };
  });

  const busSeeds = [
    ['bus_1', 'NMV-001', 'hub_east', 'Entebbe', 'Active', 65, 78, 0.3521, 32.5915],
    ['bus_2', 'NMV-014', 'hub_east', 'Jinja', 'En Route', 72, 55, 0.4502, 33.1998],
    ['bus_3', 'NMV-028', 'hub_east', 'Mbale', 'Active', 55, 90, 1.0827, 34.1750],
    ['bus_4', 'BSG-003', 'hub_west', 'Masaka', 'En Route', 68, 62, -0.3127, 31.7138],
    ['bus_5', 'BSG-011', 'hub_west', 'Mbarara', 'Active', 80, 75, -0.6000, 30.6500],
    ['bus_6', 'BSG-022', 'hub_west', 'Fort Portal', 'Charging', 0, 18, 0.6672, 30.2745],
    ['bus_7', 'KWP-007', 'hub_north', 'Gulu', 'Active', 78, 88, 2.7667, 32.3050],
    ['bus_8', 'KWP-015', 'hub_north', 'Arua', 'En Route', 62, 45, 3.0191, 30.9237],
    ['bus_9', 'KWP-031', 'hub_north', 'Hoima', 'Active', 50, 70, 1.4356, 31.3436],
  ];
  await withEntityDoc('buses', async (doc) => {
    for (const b of busSeeds) {
      if (doc.records.some((x) => x.id === b[0])) continue;
      doc.records.push({
        id: b[0],
        tag: b[1],
        hubId: b[2],
        destination: b[3],
        status: b[4],
        speed: b[5],
        battery: b[6],
        gpsLat: b[7],
        gpsLng: b[8],
        lastSeen: nowIso(),
        seatCapacity: 45,
        approved: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    return { __write: true, value: true };
  });

  const challengeSeeds = [
    ['c1', 'critical', 'Busega Hub Near Capacity', 'BSG hub is at 92% load. 8 of 10 bays occupied.', '92% load', 'Activate overflow routing.', '-35% congestion', 'action_required'],
    ['c2', 'warning', 'BSG-022 Battery Critical', 'Bus BSG-022 returned with 18% battery.', '18% battery', 'Reroute passengers.', 'Delay reduced to 45 min', 'in_progress'],
    ['c3', 'info', 'Peak Demand on Gulu Route', 'Route currently at 95% passenger load.', '95% load', 'Enable peak surcharge.', '+15% revenue', 'monitoring'],
    ['c4', 'info', 'Kawempe Bay 7 Maintenance', 'Bay 7 at KWP Hub offline.', '-1 bay', 'Operations continue normally.', 'No service impact', 'resolved'],
  ];
  await withEntityDoc('challenges', async (doc) => {
    for (const c of challengeSeeds) {
      if (doc.records.some((x) => x.id === c[0])) continue;
      doc.records.push({ id: c[0], severity: c[1], title: c[2], detail: c[3], metric: c[4], solution: c[5], impact: c[6], status: c[7] });
    }
    return { __write: true, value: true };
  });

  const pricingSeeds = [
    ['r1', 'NMV-001', 'Namanve', 'NMV', 'Entebbe', '45 km', 15000, 15000, 3000, false, '#facc15'],
    ['r2', 'NMV-014', 'Namanve', 'NMV', 'Jinja', '80 km', 25000, 22000, 5000, true, '#facc15'],
    ['r3', 'NMV-028', 'Namanve', 'NMV', 'Mbale', '230 km', 45000, 40000, 10000, false, '#facc15'],
    ['r4', 'BSG-003', 'Busega', 'BSG', 'Masaka', '135 km', 35000, 30000, 7000, false, '#38bdf8'],
    ['r5', 'BSG-011', 'Busega', 'BSG', 'Mbarara', '270 km', 45000, 42000, 8000, true, '#38bdf8'],
    ['r6', 'BSG-022', 'Busega', 'BSG', 'Fort Portal', '320 km', 55000, 50000, 12000, false, '#38bdf8'],
    ['r7', 'KWP-007', 'Kawempe', 'KWP', 'Gulu', '340 km', 55000, 50000, 10000, true, '#fb923c'],
    ['r8', 'KWP-015', 'Kawempe', 'KWP', 'Arua', '490 km', 75000, 70000, 15000, false, '#fb923c'],
    ['r9', 'KWP-031', 'Kawempe', 'KWP', 'Hoima', '220 km', 40000, 36000, 8000, false, '#fb923c'],
  ];
  await withEntityDoc('pricing_routes', async (doc) => {
    for (const p of pricingSeeds) {
      if (doc.records.some((x) => x.id === p[0])) continue;
      doc.records.push({
        id: p[0], tag: p[1], hub: p[2], hubCode: p[3], destination: p[4], distance: p[5],
        currentPrice: p[6], basePrice: p[7], peakSurcharge: p[8], isPeak: !!p[9], color: p[10],
      });
    }
    return { __write: true, value: true };
  });

  const dateStr = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const travelDates = [0, 1, 2].map((i) => {
    const dd = new Date(today);
    dd.setDate(dd.getDate() + i);
    return dateStr(dd);
  });
  const scheduleToBus = {
    sch_01: 'bus_5',
    sch_02: 'bus_6',
    sch_03: 'bus_2',
    sch_04: 'bus_3',
    sch_05: 'bus_7',
    sch_06: 'bus_8',
  };
  await withEntityDoc('departures', async (doc) => {
    for (const tDate of travelDates) {
      for (const [scheduleId, busId] of Object.entries(scheduleToBus)) {
        const id = `dep_${scheduleId}_${tDate}`;
        if (doc.records.some((x) => x.id === id)) continue;
        doc.records.push({
          id,
          scheduleId,
          busId,
          travelDate: tDate,
          status: 'Scheduled',
          seatCapacity: 45,
          occupiedSeats: 0,
          createdAt: nowIso(),
        });
      }
    }
    return { __write: true, value: true };
  });
  }

  // Always run sync after init
  await syncFleetHubFare();
}

async function resetOperationalData() {
  for (const entity of OPERATIONAL_ENTITIES) {
    await store.replaceAll(entity, []);
  }
  return { cleared: OPERATIONAL_ENTITIES };
}

async function closePool() {
  if (typeof store.close === 'function') {
    await store.close();
  }
  return true;
}

function getDbMode() {
  return store.mode || 'json-files';
}

async function findUserByEmail(email) {
  if (!isValidEmail(email)) return null;
  const normalized = email.trim().toLowerCase();
  const users = await store.readAll('users');
  return users.find((u) => String(u.email).toLowerCase() === normalized) || null;
}

async function createUser({ name, email, phone, password, role = 'user' }) {
  if (!name || !isValidEmail(email)) throw new Error('Invalid user payload');
  const normalized = email.trim().toLowerCase();
  const hash = password ? bcrypt.hashSync(password, 10) : '';
  return withEntityDoc('users', async (doc) => {
    if (doc.records.some((u) => String(u.email).toLowerCase() === normalized)) {
      throw new Error('Email already exists');
    }
    const nextId = `usr_${Math.floor(Math.random() * 900000 + 100000)}`;
    const created = {
      id: nextId,
      name: String(name).trim(),
      email: normalized,
      phone: normalizePhone(phone),
      password: hash,
      role,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      accessCount: 0,
      lastAccessAt: null,
    };
    doc.records.push(created);
    return { __write: true, value: created };
  });
}

async function getUserById(userId) {
  return store.readById('users', userId);
}

async function updateUserPassword(userId, newPassword) {
  const hash = bcrypt.hashSync(String(newPassword), 10);
  return store.updateById('users', userId, (u) => ({
    ...u,
    password: hash,
    updatedAt: nowIso(),
  }));
}

async function incrementUserAccess(userId) {
  return store.updateById('users', userId, (u) => ({
    ...u,
    accessCount: asInt(u.accessCount, 0) + 1,
    lastAccessAt: nowIso(),
  }));
}

async function getUsersAdmin() {
  const [users, bookings] = await Promise.all([store.readAll('users'), store.readAll('bookings')]);
  return users
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      lastAccessAt: u.lastAccessAt ?? null,
      bookingCount: bookings.filter((b) => String(b.userId) === String(u.id)).length,
      accessCount: asInt(u.accessCount, 0),
    }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function getAdminUserDetails(userId) {
  const [user, bookings, schedules, departures, buses] = await Promise.all([
    store.readById('users', userId),
    store.readAll('bookings'),
    store.readAll('schedules'),
    store.readAll('departures'),
    store.readAll('buses'),
  ]);
  if (!user) return null;

  const userBookings = bookings
    .filter((b) => String(b.userId) === String(userId))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const completed = userBookings.filter((b) => b.paymentStatus === 'Completed').length;
  const pending = userBookings.filter((b) => b.paymentStatus === 'Pending').length;
  const cancelled = userBookings.filter((b) => b.paymentStatus === 'Cancelled').length;
  const lastBookingAt = userBookings.length > 0 ? (userBookings[0].createdAt || null) : null;

  const recentBookings = userBookings.slice(0, 20).map((b) => {
    const schedule = schedules.find((s) => s.id === b.scheduleId);
    const departure = b.departureId ? departures.find((d) => d.id === b.departureId) : null;
    const bus = departure ? buses.find((x) => x.id === departure.busId) : null;
    return {
      id: b.id,
      scheduleId: b.scheduleId,
      departureId: b.departureId || null,
      passengerName: b.passengerName,
      phoneNumber: b.phoneNumber,
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount,
      travelDate: b.travelDate,
      createdAt: b.createdAt,
      hubId: schedule?.hubId || null,
      destination: schedule?.destination || null,
      departureTime: schedule?.departureTime || null,
      busType: schedule?.busType || null,
      busTag: bus?.tag || null,
    };
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt || null,
      accessCount: asInt(user.accessCount, 0),
      lastAccessAt: user.lastAccessAt ?? null,
    },
    usage: {
      bookingCount: userBookings.length,
      completedBookings: completed,
      pendingBookings: pending,
      cancelledBookings: cancelled,
      lastBookingAt,
    },
    recentBookings,
  };
}

async function getHubs() {
  return store.readAll('hubs');
}

async function getSchedules(hubId) {
  const all = await store.readAll('schedules');
  return hubId ? all.filter((s) => s.hubId === hubId) : all;
}

async function getScheduleById(id) {
  return store.readById('schedules', id);
}

async function findScheduleByHubDestinationTime(hubId, destination, departureTime) {
  const schedules = await store.readAll('schedules');
  return schedules.find((s) =>
    s.hubId === hubId &&
    String(s.destination || '').toLowerCase() === String(destination || '').toLowerCase() &&
    s.departureTime === departureTime
  ) || null;
}

async function createSchedule({ id, hubId, destination, departureTime, status, price, busType, duration, seatsAvailable }) {
  let finalPrice = price;
  let finalBusType = busType;
  let finalDuration = duration;

  // Try to find a baseline from pricing_routes or existing schedules if not provided
  if (finalPrice === null || finalPrice === undefined) {
    const routes = await store.readAll('pricing_routes');
    const baseline = routes.find((r) => r.hubId === hubId && r.destination === destination);
    if (baseline) {
      finalPrice = baseline.currentPrice;
    } else {
      const existing = await store.readAll('schedules');
      const match = existing.find((s) => s.hubId === hubId && s.destination === destination && s.price);
      if (match) {
        finalPrice = match.price;
        finalBusType = match.busType;
        finalDuration = match.duration;
      }
    }
  }

  const record = {
    id: id || normalizeIdPrefix('sch'),
    hubId,
    destination: destination || null,
    departureTime: departureTime || null,
    status: status || 'Active',
    price: finalPrice ?? 15000,
    busType: finalBusType ?? 'Standard',
    duration: finalDuration ?? '4 hrs',
    seatsAvailable: seatsAvailable ?? 45,
  };
  await store.create('schedules', record);
  return record;
}

async function getBuses(hubId) {
  const [all, hubs] = await Promise.all([store.readAll('buses'), store.readAll('hubs')]);
  const hubsById = new Map(hubs.map((h) => [h.id, h]));
  const approved = all.filter((b) => b.approved !== false && !b.deletedAt);
  const filtered = hubId ? approved.filter((b) => b.hubId === hubId) : approved;
  return filtered.map((b) => {
    const lat = Number(b.gpsLat);
    const lng = Number(b.gpsLng);
    const needsHubGps = !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0);
    if (!needsHubGps) return b;
    const hub = hubsById.get(b.hubId);
    const hubLat = Number(hub?.lat);
    const hubLng = Number(hub?.lng);
    if (!Number.isFinite(hubLat) || !Number.isFinite(hubLng)) return b;
    return { ...b, gpsLat: hubLat, gpsLng: hubLng };
  });
}

async function softDeleteBus(id, actor = {}) {
  const existing = await store.readById('buses', id);
  if (!existing) return null;
  if (existing.deletedAt) return existing;
  const deletedAt = nowIso();
  const deletedBy = actor?.id || actor?.email || null;
  const updated = await store.updateById('buses', id, (b) => ({
    ...b,
    approved: false,
    status: 'Deleted',
    deletedAt,
    deletedBy,
    updatedAt: nowIso(),
  }));
  await syncFleetHubFare();
  return updated;
}

async function createAuditLog({ action, actor, entityType, entityId, details }) {
  const payload = {
    action,
    actor: actor || null,
    entityType,
    entityId,
    details: details || null,
    at: nowIso(),
  };
  await store.create('system_alerts', {
    id: normalizeIdPrefix('aud'),
    severity: 'audit',
    message: JSON.stringify(payload),
    isRead: true,
    createdAt: payload.at,
  });
}

async function listBusFares() {
  const [buses, fares] = await Promise.all([store.readAll('buses'), store.readAll('bus_fares')]);
  return buses
    .filter((b) => b.approved !== false && !b.deletedAt)
    .map((b) => {
      const fee = fares.find((f) => f.busId === b.id);
      return { busId: b.id, busTag: b.tag, hubId: b.hubId, destination: b.destination, fareAmount: fee ? Number(fee.fareAmount) : null };
    })
    .sort((a, b) => String(a.busTag).localeCompare(String(b.busTag)));
}

async function upsertBusFare(busId, fareAmount) {
  const amt = Math.max(0, Math.round(Number(fareAmount)));
  return store.upsert(
    'bus_fares',
    (r) => r.busId === busId,
    (existing) => ({
      ...(existing || { id: normalizeIdPrefix('fare'), busId, createdAt: nowIso() }),
      busId,
      fareAmount: amt,
      updatedAt: nowIso(),
    })
  );
}

async function getBusFare(busId) {
  const all = await store.readAll('bus_fares');
  const row = all.find((r) => r.busId === busId);
  return row ? Number(row.fareAmount) : null;
}

async function getBusByTag(tag) {
  const all = await store.readAll('buses');
  return all.find((b) => b.tag === tag) || null;
}

async function getDeparturesBetween(startDate, endDate, hubId) {
  const [departures, schedules, buses, fares] = await Promise.all([
    store.readAll('departures'),
    store.readAll('schedules'),
    store.readAll('buses'),
    store.readAll('bus_fares'),
  ]);

  return departures
    .filter((d) => d.travelDate >= startDate && d.travelDate <= endDate)
    .map((d) => {
      const s = schedules.find((x) => x.id === d.scheduleId);
      const b = buses.find((x) => x.id === d.busId);
      if (hubId && s && s.hubId !== hubId) return null;
      const busFare = fares.find((f) => f.busId === (b?.id || d.busId));

      return {
        ...d,
        hubId: s?.hubId || 'N/A',
        destination: s?.destination || 'N/A',
        departureTime: s?.departureTime || 'N/A',
        duration: s?.duration || 'N/A',
        price: s?.price || 0,
        scheduleStatus: s?.status || 'N/A',
        busType: s?.busType || 'N/A',
        busTag: b?.tag || 'N/A',
        busSeatCapacity: b?.seatCapacity || d.seatCapacity || 45,
        approved: b?.approved !== false,
        busFareAmount: busFare ? Number(busFare.fareAmount) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => `${a.travelDate}-${a.departureTime}`.localeCompare(`${b.travelDate}-${b.departureTime}`));
}

async function updateDeparture(id, { busId, status, travelDate }) {
  return store.updateById('departures', id, (d) => ({
    ...d,
    ...(busId !== undefined ? { busId } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(travelDate !== undefined ? { travelDate } : {}),
  }));
}

async function canDeleteDeparture(id) {
  const bookings = await store.readAll('bookings');
  return bookings.filter((b) => b.departureId === id && b.paymentStatus !== 'Cancelled').length === 0;
}

async function deleteDeparture(id) {
  return store.deleteById('departures', id);
}

async function countOccupiedSeats(departureId) {
  const bookings = await store.readAll('bookings');
  return bookings.filter((b) => b.departureId === departureId && b.paymentStatus !== 'Cancelled').length;
}

async function createDeparture({ id, scheduleId, busId, travelDate, status, seatCapacity }) {
  const record = {
    id: id || normalizeIdPrefix('dep'),
    scheduleId,
    busId,
    travelDate,
    status: status || 'Scheduled',
    seatCapacity: seatCapacity ?? 45,
    occupiedSeats: 0,
    createdAt: nowIso(),
  };
  await store.create('departures', record);
  return record;
}

async function tryReserveSeat(departureId) {
  return withEntityDoc('departures', async (doc) => {
    const idx = doc.records.findIndex((d) => d.id === departureId);
    if (idx < 0) return { value: null };
    const d = doc.records[idx];
    if (asInt(d.occupiedSeats, 0) >= asInt(d.seatCapacity, 45)) return { value: null };
    const occupiedSeats = asInt(d.occupiedSeats, 0) + 1;
    doc.records[idx] = { ...d, occupiedSeats };
    return {
      __write: true,
      value: {
        occupiedSeats,
        seatCapacity: asInt(d.seatCapacity, 45),
        seatsAvailable: Math.max(0, asInt(d.seatCapacity, 45) - occupiedSeats),
      },
    };
  });
}

async function archivePastDepartures(now = new Date()) {
  const todayKey = todayLocalYmd();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [departures, schedules] = await Promise.all([store.readAll('departures'), store.readAll('schedules')]);
  const expired = departures.filter((d) => {
    if (d.travelDate < todayKey) return true;
    if (d.travelDate > todayKey) return false;
    const schedule = schedules.find((s) => s.id === d.scheduleId);
    const depMins = parseDepartureTimeToMinutes(schedule?.departureTime);
    if (depMins === null) return false;
    return depMins <= nowMinutes;
  });

  if (expired.length === 0) return { archived: 0 };

  await withEntityDoc('arrivals', async (arrivalsDoc) => {
    for (const d of expired) {
      const schedule = schedules.find((s) => s.id === d.scheduleId);
      if (!schedule) continue;
      if (arrivalsDoc.records.some((a) => a.id === d.id)) continue;
      arrivalsDoc.records.push({
        id: d.id,
        scheduleId: d.scheduleId,
        busId: d.busId,
        hubId: schedule.hubId,
        destination: schedule.destination,
        travelDate: d.travelDate,
        departureTime: schedule.departureTime,
        expectedArrivalAt: computeExpectedArrivalAt(d.travelDate, schedule.departureTime, schedule.duration),
        status: 'En Route',
      });
    }
    return { __write: true, value: true };
  });
  await withEntityDoc('departures', async (depDoc) => {
    depDoc.records = depDoc.records.filter((d) => !expired.some((x) => x.id === d.id));
    return { __write: true, value: true };
  });
  return { archived: expired.length };
}

async function getArrivalsBetween(startDate, endDate, { hubId, destination } = {}) {
  const [arrivals, buses] = await Promise.all([store.readAll('arrivals'), store.readAll('buses')]);
  return arrivals
    .filter((a) => a.travelDate >= startDate && a.travelDate <= endDate)
    .filter((a) => (hubId ? a.hubId === hubId : true))
    .filter((a) => (destination ? String(a.destination || '').toLowerCase().includes(String(destination).toLowerCase()) : true))
    .map((a) => ({
      ...a,
      busTag: buses.find((b) => b.id === a.busId)?.tag || null,
    }))
    .sort((a, b) => `${a.travelDate}-${a.departureTime}`.localeCompare(`${b.travelDate}-${b.departureTime}`));
}

async function getArrivalById(id) {
  return store.readById('arrivals', id);
}

async function createDelivery({
  id,
  trackingCode,
  tripId,
  travelDate,
  destination,
  hubId,
  busId,
  senderName,
  senderPhone,
  receiverName,
  receiverPhone,
  description,
  status,
  paymentStatus,
  feeAmount,
  userId,
  arrived,
  arrivedAt,
  received,
  receivedAt,
  receivedBy,
}) {
  if (!receiverName || !receiverPhone) throw new Error('Invalid delivery payload');
  return withEntityDoc('deliveries', async (doc) => {
    const existingCodes = new Set(doc.records.map((r) => String(r.trackingCode)));
    let code = trackingCode ? String(trackingCode).trim() : '';
    if (!code) {
      for (let i = 0; i < 12; i += 1) {
        const candidate = randomTrackingCode();
        if (!existingCodes.has(candidate)) {
          code = candidate;
          break;
        }
      }
    }
    if (!code) throw new Error('Failed to generate tracking code');
    if (existingCodes.has(code)) throw new Error('Tracking code already exists');

    const row = {
      id: id || normalizeIdPrefix('del'),
      trackingCode: code,
      tripId: tripId || null,
      travelDate: travelDate || null,
      destination: destination || null,
      hubId: hubId || null,
      busId: busId || null,
      senderName: senderName || null,
      senderPhone: senderPhone || null,
      receiverName,
      receiverPhone,
      description: description || null,
      status: status || 'Pending',
      feeAmount: feeAmount !== undefined && feeAmount !== null ? Number(feeAmount) : 0,
      paymentStatus: paymentStatus || 'Pending',
      userId: userId || null,
      arrived: !!arrived,
      arrivedAt: arrivedAt || null,
      received: !!received,
      receivedAt: receivedAt || null,
      receivedBy: receivedBy || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    doc.records.push(row);
    return { __write: true, value: row };
  });
}

async function listDeliveries(limit = 200) {
  const all = await store.readAll('deliveries');
  return [...all].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, limit);
}

async function listDeliveriesByUser(userId, limit = 200) {
  const all = await store.readAll('deliveries');
  return all
    .filter((d) => String(d.userId) === String(userId))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
}

async function getDeliveryById(id) {
  return store.readById('deliveries', id);
}

async function getDeliveryByTrackingCode(trackingCode) {
  const all = await store.readAll('deliveries');
  return all.find((d) => d.trackingCode === trackingCode) || null;
}

async function getDeliveryContacts(deliveryId) {
  const all = await store.readAll('delivery_contacts');
  return all.filter((c) => c.deliveryId === deliveryId).map((c) => ({ name: c.name, phone: c.phone }));
}

async function addDeliveryContacts(deliveryId, contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return;
  await withEntityDoc('delivery_contacts', async (doc) => {
    for (const c of contacts) {
      const name = String(c?.name || '').trim();
      const phone = String(c?.phone || '').trim();
      if (!name || !phone) continue;
      doc.records.push({
        id: normalizeIdPrefix('dcon'),
        deliveryId,
        name,
        phone,
      });
    }
    return { __write: true, value: true };
  });
}

async function getDeliveryFeeByBus(busId) {
  const fees = await store.readAll('delivery_fees');
  const row = fees.find((f) => f.busId === busId);
  return row ? Number(row.feeAmount) : null;
}

async function upsertDeliveryFee(busId, feeAmount) {
  const amt = Math.max(0, Math.round(Number(feeAmount)));
  return store.upsert(
    'delivery_fees',
    (r) => r.busId === busId,
    (existing) => ({
      ...(existing || { id: normalizeIdPrefix('dfee'), busId, createdAt: nowIso() }),
      busId,
      feeAmount: amt,
      updatedAt: nowIso(),
    })
  );
}

async function listDeliveryFees() {
  const [fees, buses] = await Promise.all([store.readAll('delivery_fees'), store.readAll('buses')]);
  return fees
    .map((f) => {
      const bus = buses.find((b) => b.id === f.busId);
      return {
        busId: f.busId,
        feeAmount: f.feeAmount,
        busTag: bus?.tag || null,
        hubId: bus?.hubId || null,
      };
    })
    .sort((a, b) => String(a.busTag || '').localeCompare(String(b.busTag || '')));
}

async function createUserDeliveryRequest({ userId, departureId, senderName, senderPhone, receiverName, receiverPhone, description, contacts }) {
  const departure = await getDepartureById(departureId);
  if (!departure) return { error: 'Departure not found' };
  const bus = await getBusById(departure.busId);
  if (!bus || bus.approved === false) return { error: 'Bus is not approved for deliveries' };
  const fee = (await getDeliveryFeeByBus(bus.id)) ?? 10000;
  const schedule = await getScheduleById(departure.scheduleId);
  const delivery = await createDelivery({
    id: normalizeIdPrefix('del'),
    tripId: departureId,
    travelDate: departure.travelDate,
    destination: schedule?.destination || null,
    hubId: schedule?.hubId || departure.hubId || null,
    busId: departure.busId,
    senderName: senderName || null,
    senderPhone: senderPhone || null,
    receiverName,
    receiverPhone,
    description,
    status: 'Pending Payment',
    paymentStatus: 'Pending',
    feeAmount: fee,
    userId,
    arrived: false,
    received: false,
  });
  await addDeliveryContacts(delivery.id, contacts);
  return { delivery: await getDeliveryById(delivery.id) };
}

async function markDeliveryPaid(deliveryId) {
  return store.updateById('deliveries', deliveryId, (d) => ({
    ...d,
    paymentStatus: 'Completed',
    status: d.arrived === true ? 'Arrived' : 'In Transit',
    updatedAt: nowIso(),
  }));
}

async function updateDeliveryStatus(trackingCode, status) {
  return withEntityDoc('deliveries', async (doc) => {
    const idx = doc.records.findIndex((d) => d.trackingCode === trackingCode);
    if (idx < 0) return { value: null };
    doc.records[idx] = { ...doc.records[idx], status, updatedAt: nowIso() };
    return { __write: true, value: doc.records[idx] };
  });
}

async function updateDeliveryReceivedState(trackingCode, received, { receivedBy, undo = false } = {}) {
  return withEntityDoc('deliveries', async (doc) => {
    const idx = doc.records.findIndex((d) => d.trackingCode === trackingCode);
    if (idx < 0) return { value: null };
    const prev = doc.records[idx];
    const nextReceived = !!received;
    if (prev.received === true && nextReceived === false && undo !== true) {
      throw new Error('UNDO_REQUIRED');
    }
    doc.records[idx] = {
      ...doc.records[idx],
      received: nextReceived,
      receivedAt: nextReceived ? nowIso() : null,
      receivedBy: nextReceived ? (receivedBy || null) : null,
      status: nextReceived ? 'Received' : (doc.records[idx].arrived === true ? 'Arrived' : (doc.records[idx].paymentStatus === 'Completed' ? 'In Transit' : doc.records[idx].status)),
      updatedAt: nowIso(),
    };
    return { __write: true, value: doc.records[idx] };
  });
}

async function listActiveDeliveriesByBus(busId) {
  const all = await store.readAll('deliveries');
  return all.filter((d) => d.busId === busId && d.paymentStatus === 'Completed' && d.arrived !== true);
}

async function markDeliveryArrived(trackingCode, arrivedAtIso) {
  return withEntityDoc('deliveries', async (doc) => {
    const idx = doc.records.findIndex((d) => d.trackingCode === trackingCode);
    if (idx < 0) return { value: null };
    if (doc.records[idx].arrived === true) return { value: doc.records[idx] };
    doc.records[idx] = {
      ...doc.records[idx],
      arrived: true,
      arrivedAt: arrivedAtIso || nowIso(),
      status: doc.records[idx].paymentStatus === 'Completed' ? 'Arrived' : doc.records[idx].status,
      updatedAt: nowIso(),
    };
    return { __write: true, value: doc.records[idx] };
  });
}

async function getDeliveryContactLookup(trackingCode) {
  const delivery = await getDeliveryByTrackingCode(trackingCode);
  if (!delivery) return null;
  const contacts = await getDeliveryContacts(delivery.id);
  const alt = contacts.map((c) => c.phone).find((p) => p && String(p) !== String(delivery.receiverPhone)) || null;
  return {
    trackingCode: delivery.trackingCode,
    receiverName: delivery.receiverName,
    receiverPhone: delivery.receiverPhone,
    alternatePhone: alt,
  };
}

async function createDeliveryAuditLog({ trackingCode, deliveryId, actorId, actorRole, action, fromStatus, toStatus, fromReceived, toReceived, note, ip }) {
  const row = {
    id: normalizeIdPrefix('dlog'),
    trackingCode,
    deliveryId,
    actorId: actorId || null,
    actorRole: actorRole || null,
    action: action || 'update',
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    fromReceived: typeof fromReceived === 'boolean' ? fromReceived : null,
    toReceived: typeof toReceived === 'boolean' ? toReceived : null,
    note: note || null,
    ip: ip || null,
    createdAt: nowIso(),
  };
  await store.create('delivery_audit_logs', row);
  return row;
}

async function listDeliveryAuditLogs(trackingCode, limit = 50) {
  const logs = await store.query('delivery_audit_logs', {
    filter: (l) => l.trackingCode === trackingCode,
    sortBy: 'createdAt',
    sortDir: 'desc',
    limit,
  });
  return logs;
}

async function updateBusPosition(id, { gpsLat, gpsLng, battery, status, speed }) {
  const latNum = gpsLat === undefined || gpsLat === null ? null : Number(gpsLat);
  const lngNum = gpsLng === undefined || gpsLng === null ? null : Number(gpsLng);
  const batteryInt = battery === undefined || battery === null ? null : Math.max(0, Math.round(Number(battery)));
  const speedInt = speed === undefined || speed === null ? null : Math.max(0, Math.round(Number(speed)));
  return store.updateById('buses', id, (b) => ({
    ...b,
    gpsLat: latNum,
    gpsLng: lngNum,
    battery: batteryInt,
    status,
    speed: speedInt,
    updatedAt: nowIso(),
    lastSeen: nowIso(),
  }));
}

async function updateBusStatus(id, status, battery = null) {
  return store.updateById('buses', id, (b) => ({
    ...b,
    status,
    ...(battery !== null ? { battery: Math.max(0, Math.round(Number(battery))) } : {}),
    updatedAt: nowIso(),
  }));
}

async function getBusById(id) {
  const bus = await store.readById('buses', id);
  if (!bus) return null;
  const lat = Number(bus.gpsLat);
  const lng = Number(bus.gpsLng);
  const needsHubGps = !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0);
  if (!needsHubGps) return bus;
  const hub = await store.readById('hubs', bus.hubId);
  const hubLat = Number(hub?.lat);
  const hubLng = Number(hub?.lng);
  if (!Number.isFinite(hubLat) || !Number.isFinite(hubLng)) return bus;
  return { ...bus, gpsLat: hubLat, gpsLng: hubLng };
}

async function createBus({ id, tag, hubId, destination, status, speed, battery, gpsLat, gpsLng, seatCapacity, approved }) {
  if (!tag || !hubId) throw new Error('Missing required fields');
  const initialLat = Number(gpsLat);
  const initialLng = Number(gpsLng);
  let finalLat = Number.isFinite(initialLat) ? initialLat : 0;
  let finalLng = Number.isFinite(initialLng) ? initialLng : 0;
  if (finalLat === 0 && finalLng === 0) {
    const hub = await store.readById('hubs', hubId);
    const hubLat = Number(hub?.lat);
    const hubLng = Number(hub?.lng);
    if (Number.isFinite(hubLat) && Number.isFinite(hubLng)) {
      finalLat = hubLat;
      finalLng = hubLng;
    }
  }
  const record = {
    id: id || normalizeIdPrefix('bus'),
    tag,
    hubId,
    destination: destination || '',
    status: status || 'Active',
    speed: Math.max(0, asInt(speed, 0)),
    battery: Math.max(0, asInt(battery, 0)),
    gpsLat: finalLat,
    gpsLng: finalLng,
    lastSeen: nowIso(),
    seatCapacity: Math.max(1, asInt(seatCapacity, 45)),
    approved: approved === undefined || approved === null ? true : Boolean(approved),
    deletedAt: null,
    deletedBy: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.upsert('buses', (b) => b.id === record.id, () => record);
  await syncFleetHubFare(); // Ensure fare record exists
  return getBusById(record.id);
}

async function updateBus(id, updates) {
  if (!updates || Object.keys(updates).length === 0) return getBusById(id);
  const existing = await store.readById('buses', id);
  if (!existing) return null;
  if (existing.deletedAt) return null;
  const updated = await store.updateById('buses', id, (b) => ({ ...b, ...updates, updatedAt: nowIso() }));
  await syncFleetHubFare(); // Re-sync in case hub/approval changed
  return updated;
}

async function decrementSeat(scheduleId) {
  const updated = await store.updateById('schedules', scheduleId, (s) => ({
    ...s,
    seatsAvailable: Math.max(0, asInt(s.seatsAvailable, 0) - 1),
  }));
  return !!updated;
}

async function createBooking({ id, scheduleId, departureId, userId, passengerName, phoneNumber, paymentStatus, totalAmount, travelDate }) {
  const record = {
    id: id || `T-${Math.floor(Math.random() * 90000 + 10000)}`,
    scheduleId,
    departureId: departureId || null,
    userId: userId || null,
    passengerName,
    phoneNumber,
    paymentStatus,
    totalAmount,
    travelDate: travelDate || 'Today',
    createdAt: nowIso(),
  };
  await store.create('bookings', record);
  return record;
}

async function findBookingByUserAndSchedule(userId, scheduleId, travelDate) {
  const all = await store.readAll('bookings');
  return all.find((b) =>
    String(b.userId) === String(userId) &&
    b.scheduleId === scheduleId &&
    b.travelDate === travelDate &&
    b.paymentStatus !== 'Cancelled'
  ) || null;
}

async function getBookings({ paymentStatus, search } = {}) {
  const [bookings, schedules, users, departures, buses] = await Promise.all([
    store.readAll('bookings'),
    store.readAll('schedules'),
    store.readAll('users'),
    store.readAll('departures'),
    store.readAll('buses'),
  ]);

  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [String(u.id), u]));
  const departureMap = new Map(departures.map((d) => [d.id, d]));
  const busMap = new Map(buses.map((b) => [b.id, b]));

  let filtered = bookings;
  if (paymentStatus) {
    filtered = filtered.filter((b) => String(b.paymentStatus) === String(paymentStatus));
  }

  const result = filtered.map((b) => {
    const s = scheduleMap.get(b.scheduleId);
    const u = b.userId ? userMap.get(String(b.userId)) : null;
    const d = b.departureId ? departureMap.get(b.departureId) : null;
    const bus = d ? busMap.get(d.busId) : null;
    
    return {
      id: b.id,
      scheduleId: b.scheduleId,
      departureId: b.departureId || null,
      userId: b.userId || null,
      passengerName: b.passengerName,
      phoneNumber: b.phoneNumber,
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount,
      travelDate: b.travelDate,
      createdAt: b.createdAt,
      destination: s?.destination || null,
      departureTime: s?.departureTime || null,
      busType: s?.busType || null,
      hubId: s?.hubId || null,
      userName: u?.name || null,
      userEmail: u?.email || null,
      busTag: bus?.tag || null,
    };
  });

  if (search) {
    const q = String(search).toLowerCase();
    return result.filter((b) => 
      String(b.id).toLowerCase().includes(q) ||
      String(b.passengerName).toLowerCase().includes(q) ||
      String(b.phoneNumber).toLowerCase().includes(q) ||
      String(b.destination).toLowerCase().includes(q) ||
      String(b.userEmail || '').toLowerCase().includes(q) ||
      String(b.busTag || '').toLowerCase().includes(q)
    );
  }

  return result.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function getBookingsByScheduleAndDate(scheduleId, travelDate) {
  const all = await store.readAll('bookings');
  return all.filter((b) => b.scheduleId === scheduleId && b.travelDate === travelDate && b.paymentStatus !== 'Cancelled').length;
}

async function getDepartureById(id) {
  return store.readById('departures', id);
}

async function findDepartureForScheduleAndDate(scheduleId, travelDate) {
  const all = await store.readAll('departures');
  return all
    .filter((d) => d.scheduleId === scheduleId && d.travelDate === travelDate)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}

async function getUserBookings(userId) {
  const [bookings, schedules] = await Promise.all([store.readAll('bookings'), store.readAll('schedules')]);
  return bookings
    .filter((b) => String(b.userId) === String(userId))
    .map((b) => {
      const s = schedules.find((x) => x.id === b.scheduleId);
      return { ...b, destination: s?.destination, departureTime: s?.departureTime, busType: s?.busType };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function getDailyManifest() {
  const today = todayLocalYmd();
  const [bookings, schedules, users] = await Promise.all([store.readAll('bookings'), store.readAll('schedules'), store.readAll('users')]);
  return bookings
    .filter((b) => b.paymentStatus === 'Completed' && String(b.createdAt || '').slice(0, 10) === today)
    .map((b) => {
      const s = schedules.find((x) => x.id === b.scheduleId);
      const u = users.find((x) => String(x.id) === String(b.userId));
      return { ...b, destination: s?.destination, departureTime: s?.departureTime, busType: s?.busType, userEmail: u?.email || null };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function getBookingById(id) {
  const [booking, schedules] = await Promise.all([store.readById('bookings', id), store.readAll('schedules')]);
  if (!booking) return null;
  const s = schedules.find((x) => x.id === booking.scheduleId);
  return { ...booking, destination: s?.destination, departureTime: s?.departureTime, busType: s?.busType };
}

async function updateBookingStatus(id, status) {
  await store.updateById('bookings', id, (b) => ({ ...b, paymentStatus: status }));
  return getBookingById(id);
}

async function getReportingMetrics() {
  const today = todayLocalYmd();
  const [bookings, schedules, challenges, deliveries] = await Promise.all([
    store.readAll('bookings'),
    store.readAll('schedules'),
    store.readAll('challenges'),
    store.readAll('deliveries'),
  ]);
  const todayBookings = bookings.filter((b) => String(b.createdAt || '').slice(0, 10) === today).length;
  const todayRevenue = bookings
    .filter((b) => b.paymentStatus === 'Completed' && String(b.createdAt || '').slice(0, 10) === today)
    .reduce((sum, b) => sum + asNumber(b.totalAmount, 0), 0);
  const todayDeliveryRevenue = deliveries
    .filter((d) => d.paymentStatus === 'Completed' && String(d.createdAt || '').slice(0, 10) === today)
    .reduce((sum, d) => sum + asNumber(d.feeAmount, 0), 0);
  const totalDeliveryRevenue = deliveries
    .filter((d) => d.paymentStatus === 'Completed')
    .reduce((sum, d) => sum + asNumber(d.feeAmount, 0), 0);
  const onTime = schedules.filter((s) => s.status === 'On Time').length;
  const onTimeRate = schedules.length > 0 ? Math.round((onTime / schedules.length) * 100) : 100;
  return { todayBookings, todayRevenue, todayDeliveryRevenue, totalDeliveryRevenue, onTimeRate: `${onTimeRate}%`, challenges };
}

async function getStats() {
  const [buses, bookings, schedules, deliveries] = await Promise.all([
    store.readAll('buses'),
    store.readAll('bookings'),
    store.readAll('schedules'),
    store.readAll('deliveries'),
  ]);
  const totalDeliveryRevenue = deliveries
    .filter((d) => d.paymentStatus === 'Completed')
    .reduce((sum, d) => sum + asNumber(d.feeAmount, 0), 0);
  return {
    totalBuses: buses.length,
    totalBookings: bookings.length,
    totalRevenue: bookings.reduce((sum, b) => sum + asNumber(b.totalAmount, 0), 0),
    activeSchedules: schedules.filter((s) => s.status === 'On Time').length,
    totalDeliveryRevenue,
  };
}

async function getAlerts() {
  const all = await store.readAll('system_alerts');
  return all.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 10);
}

async function createAlert(severity, message) {
  const existing = await store.query('system_alerts', {
    filter: (a) => a.message === message && a.isRead === false,
    limit: 1,
  });
  if (existing.length > 0) return;
  await store.create('system_alerts', {
    id: normalizeIdPrefix('alr'),
    severity,
    message,
    isRead: false,
    createdAt: nowIso(),
  });
}

async function logTelemetry(busId, { battery, speed, gpsLat, gpsLng }) {
  await store.create('telemetry_logs', {
    id: normalizeIdPrefix('tel'),
    busId,
    battery,
    speed,
    gpsLat,
    gpsLng,
    timestamp: nowIso(),
  });
}

async function getChallenges() {
  return store.readAll('challenges');
}

async function upsertChallenge({ id, severity, title, detail, metric, solution, impact, status, scenarioGenerated }) {
  return store.upsert(
    'challenges',
    (r) => r.id === id,
    (existing) => ({
      ...(existing || {}),
      id, severity, title, detail, metric, solution, impact,
      status: status || 'action_required',
      scenarioGenerated: scenarioGenerated || false,
      updatedAt: nowIso(),
      createdAt: existing?.createdAt || nowIso(),
    })
  );
}

async function clearScenarioChallenges() {
  const all = await store.readAll('challenges');
  const filtered = all.filter(r => !r.scenarioGenerated);
  return store.replaceAll('challenges', filtered);
}

async function getPricingRoutes() {
  const rows = await store.readAll('pricing_routes');
  return rows.map((r) => ({ ...r, isPeak: !!r.isPeak }));
}

async function updatePricingRoute(id, updates) {
  const updated = await store.updateById('pricing_routes', id, (r) => ({
    ...r,
    ...(updates.isPeak !== undefined ? { isPeak: updates.isPeak, currentPrice: updates.currentPrice } : {}),
    ...(updates.basePrice !== undefined ? { basePrice: updates.basePrice, peakSurcharge: updates.peakSurcharge, currentPrice: updates.currentPrice } : {}),
  }));
  return updated;
}

async function getTelemetryLogs(busId, limit = 60) {
  const rows = await store.query('telemetry_logs', {
    filter: (t) => t.busId === busId,
    sortBy: 'timestamp',
    sortDir: 'desc',
    limit,
  });
  return rows.reverse();
}

async function backupData() {
  return store.backupAll(ENTITIES);
}

async function recoverEntity(entity) {
  if (!ENTITIES.includes(entity)) {
    throw new Error(`Unknown entity: ${entity}`);
  }
  return store.recoverLatest(entity);
}

module.exports = {
  initDb,
  getDbMode,
  getChallenges,
  upsertChallenge,
  clearScenarioChallenges,
  getPricingRoutes,
  updatePricingRoute,
  findUserByEmail,
  createUser,
  getUserById,
  updateUserPassword,
  incrementUserAccess,
  getUsersAdmin,
  getAdminUserDetails,
  getHubs,
  getSchedules,
  getScheduleById,
  findScheduleByHubDestinationTime,
  createSchedule,
  getBuses,
  listBusFares,
  upsertBusFare,
  softDeleteBus,
  createAuditLog,
  getBusFare,
  getBusByTag,
  getDeparturesBetween,
  createDeparture,
  updateDeparture,
  canDeleteDeparture,
  deleteDeparture,
  getDepartureById,
  findDepartureForScheduleAndDate,
  countOccupiedSeats,
  tryReserveSeat,
  computeExpectedArrivalAt,
  archivePastDepartures,
  getArrivalsBetween,
  getArrivalById,
  createDelivery,
  listDeliveries,
  listDeliveriesByUser,
  getDeliveryById,
  getDeliveryByTrackingCode,
  getDeliveryContacts,
  getDeliveryFeeByBus,
  upsertDeliveryFee,
  listDeliveryFees,
  createUserDeliveryRequest,
  markDeliveryPaid,
  updateDeliveryStatus,
  updateDeliveryReceivedState,
  listActiveDeliveriesByBus,
  markDeliveryArrived,
  getDeliveryContactLookup,
  createDeliveryAuditLog,
  listDeliveryAuditLogs,
  updateBusPosition,
  updateBusStatus,
  getBusById,
  createBus,
  updateBus,
  decrementSeat,
  createBooking,
  getBookings,
  getUserBookings,
  getStats,
  getAlerts,
  createAlert,
  logTelemetry,
  getBookingById,
  updateBookingStatus,
  getReportingMetrics,
  getDailyManifest,
  findBookingByUserAndSchedule,
  getTelemetryLogs,
  getBookingsByScheduleAndDate,
  closePool,
  backupData,
  recoverEntity,
  resetOperationalData,
  syncFleetHubFare,
};
