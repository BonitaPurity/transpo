const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const db = require('./db-json');
const { pickLang, sendPdf } = require('./pdf');
const envName = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(__dirname, '..', `.env.${envName}`) });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-a-secure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || `${JWT_SECRET}_refresh`;
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '14d';

const app = express();
app.set('trust proxy', 1);

function parseAllowedOrigins(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const TRUSTED_CLOUD_DOMAINS = [
  'vercel.app',
  'onrender.com',
  'netlify.app',
  'railway.app',
  'bonitapurity',
  'gitpod.io'
];

const allowedOrigins = (() => {
  const env = parseAllowedOrigins(process.env.CORS_ORIGINS);
  if (env.length > 0) return env;
  if (process.env.NODE_ENV === 'production') return [];
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
})();

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (process.env.CORS_ALLOW_ALL === 'true') return true;
  
  // Always permit safe dynamic prefixes securely
  if (TRUSTED_CLOUD_DOMAINS.some(domain => origin.includes(domain))) {
    return true;
  }
  
  if (allowedOrigins.length === 0) {
    return process.env.NODE_ENV !== 'production';
  }
  
  return allowedOrigins.some(allowed => 
    origin === allowed || 
    origin.startsWith(allowed) || 
    origin.includes(allowed.replace(/^https?:\/\//, '')) || 
    allowed === '*'
  );
}

const corsOptions = {
  origin(origin, cb) {
    if (isOriginAllowed(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization', 'x-requested-with', 'accept'],
  optionsSuccessStatus: 200,
};

const sslKeyPath = process.env.SSL_KEY_PATH ? path.resolve(process.env.SSL_KEY_PATH) : null;
const sslCertPath = process.env.SSL_CERT_PATH ? path.resolve(process.env.SSL_CERT_PATH) : null;
const useHttps = !!(sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath));
const server = useHttps
  ? https.createServer(
      {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      },
      app
    )
  : http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin(origin, cb) {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests; please try again later.' },
});

app.use((req, res, next) => {
  const rid = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  next();
});

app.use(
  helmet({
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', '*.basemaps.cartocdn.com', '*.tile.openstreetmap.org', 'openstreetmap.org'],
        'connect-src': [
          "'self'",
          ...allowedOrigins,
          ...TRUSTED_CLOUD_DOMAINS.map(d => `*.${d}`),
          ...(process.env.CORS_ALLOW_ALL === 'true' ? ['*'] : []),
          'ws:',
          'wss:',
          'http:',
          'https:',
        ],
      },
    },
  })
);
app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());

app.use((req, res, next) => {
  const enforce = process.env.ENFORCE_HTTPS !== 'false' && process.env.NODE_ENV === 'production';
  if (!enforce) return next();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const isSecure = req.secure || forwardedProto === 'https';
  if (isSecure) return next();
  const host = req.headers.host;
  if (!host) return res.status(400).json({ success: false, message: 'HTTPS required', requestId: req.requestId });
  return res.redirect(301, `https://${host}${req.originalUrl}`);
});

// Socket.io connection logging
io.on('connection', (socket) => {
  console.log('Operational Nexus: Client connected');
  socket.on('disconnect', () => console.log('Operational Nexus: Client disconnected'));
});

function emitDeliveryUpdate(delivery) {
  if (!delivery) return;
  io.emit('delivery_update', {
    trackingCode: delivery.trackingCode,
    status: delivery.status,
    paymentStatus: delivery.paymentStatus,
    arrived: delivery.arrived === true,
    arrivedAt: delivery.arrivedAt || null,
    received: delivery.received === true,
    receivedAt: delivery.receivedAt || null,
    busId: delivery.busId || null,
    destination: delivery.destination || null,
    travelDate: delivery.travelDate || null,
    updatedAt: delivery.updatedAt || null,
  });
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

function decodeTokenExpiryIso(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object' || !decoded.exp) return null;
    const ms = Number(decoded.exp) * 1000;
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

const refreshTokenStore = new Map();

function cleanupExpiredRefreshTokens() {
  const now = Date.now();
  for (const [key, meta] of refreshTokenStore.entries()) {
    if (!meta || !Number.isFinite(meta.expiresAtMs) || meta.expiresAtMs <= now) {
      refreshTokenStore.delete(key);
    }
  }
}

function issueAuthTokens(user) {
  cleanupExpiredRefreshTokens();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshDecoded = jwt.decode(refreshToken);
  const refreshExpiresAtMs = Number(refreshDecoded?.exp || 0) * 1000;
  refreshTokenStore.set(refreshToken, {
    userId: user.id,
    email: user.email,
    role: user.role,
    expiresAtMs: Number.isFinite(refreshExpiresAtMs) ? refreshExpiresAtMs : (Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  return {
    token: accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    refreshExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
    tokenExpiresAt: decodeTokenExpiryIso(accessToken),
    refreshTokenExpiresAt: decodeTokenExpiryIso(refreshToken),
  };
}

function revokeRefreshToken(token) {
  if (!token) return;
  refreshTokenStore.delete(token);
}

function authenticateToken(req, res, next) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Authorization token missing' });
  }
  
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token missing' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

const ADMIN_BYPASS_AUTH_ENABLED = String(process.env.ADMIN_BYPASS_AUTH_ENABLED || 'false').toLowerCase() === 'true';
const ADMIN_BYPASS_AUTH_ALLOW_IN_PROD = String(process.env.ADMIN_BYPASS_AUTH_ALLOW_IN_PROD || 'false').toLowerCase() === 'true';

function isAdminBypassAllowed() {
  if (!ADMIN_BYPASS_AUTH_ENABLED) return false;
  if (process.env.NODE_ENV === 'production' && !ADMIN_BYPASS_AUTH_ALLOW_IN_PROD) return false;
  return true;
}

const ADMIN_BYPASS_ROUTES = [
  { method: 'GET', re: /^\/api\/fleet$/ },
  { method: 'POST', re: /^\/api\/fleet$/ },
  { method: 'PUT', re: /^\/api\/fleet\/[^/]+$/ },
  { method: 'POST', re: /^\/api\/fleet\/[^/]+\/maintenance$/ },

  { method: 'POST', re: /^\/api\/departures$/ },
  { method: 'PUT', re: /^\/api\/departures\/[^/]+$/ },
  { method: 'DELETE', re: /^\/api\/departures\/[^/]+$/ },

  { method: 'GET', re: /^\/api\/pricing$/ },
  { method: 'PUT', re: /^\/api\/pricing\/[^/]+$/ },
  { method: 'GET', re: /^\/api\/admin\/bus-fares$/ },
  { method: 'PUT', re: /^\/api\/admin\/bus-fares\/[^/]+$/ },
  { method: 'GET', re: /^\/api\/admin\/delivery-fees$/ },
  { method: 'PUT', re: /^\/api\/admin\/delivery-fees\/[^/]+$/ },

  { method: 'GET', re: /^\/api\/admin\/deliveries$/ },
  { method: 'POST', re: /^\/api\/admin\/deliveries$/ },
  { method: 'GET', re: /^\/api\/admin\/deliveries\/[^/]+$/ },
  { method: 'GET', re: /^\/api\/admin\/deliveries\/[^/]+\/contact$/ },
  { method: 'PUT', re: /^\/api\/admin\/deliveries\/[^/]+\/received$/ },
  { method: 'PUT', re: /^\/api\/admin\/deliveries\/[^/]+$/ },
];

function isBypassRoute(req) {
  const pathOnly = String(req.path || '');
  const method = String(req.method || '').toUpperCase();
  return ADMIN_BYPASS_ROUTES.some((r) => r.method === method && r.re.test(pathOnly));
}

function authenticateTokenOrBypassAdmin(req, res, next) {
  if (isAdminBypassAllowed() && isBypassRoute(req)) {
    req.user = { id: 0, email: 'bypass@local', role: 'admin' };
    return next();
  }
  return authenticateToken(req, res, next);
}

function withAsync(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function attachUserIfPresent(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return null;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return null;
  }
  return user;
}

function requireAdminOrLogistics(req, res) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return null;
  }
  if (user.role !== 'admin' && user.role !== 'logistics_operator') {
    res.status(403).json({ success: false, message: 'Admin or logistics access required' });
    return null;
  }
  return user;
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value);
}

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  try {
    const user = await db.findUserByEmail(email.trim().toLowerCase());
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const bcrypt = require('bcryptjs');
    let valid = false;
    let needsHashUpgrade = false;

    // Check if the password is valid using bcrypt
    try {
      valid = bcrypt.compareSync(password, user.password);
    } catch (err) {
      // bcrypt throws on invalid hash types (like plaintext passwords)
      valid = false;
    }

    // Fallback: If bcrypt failed, check if the password is raw plaintext (e.g. from manual admin creation)
    if (!valid && password === user.password) {
      valid = true;
      needsHashUpgrade = true;
      console.log(`[Auth] Legacy plaintext authentication detected for user ${user.email}. Executing hash upgrade...`);
    }

    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (needsHashUpgrade) {
      try {
        await db.updateUserPassword(user.id, password);
        console.log(`[Auth] successfully upgraded hash for user ${user.email}`);
      } catch (upgradeErr) {
        console.error('[Auth] failed to auto-upgrade legacy plain-text hash:', upgradeErr);
      }
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    const tokens = issueAuthTokens(payload);
    try {
      await db.incrementUserAccess(user.id);
    } catch (err) {
      console.error('Access count update failed:', err);
    }

    return res.json({ success: true, data: { user: payload, ...tokens } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
});

// 2. (Optional) Register user (stores in DB)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await db.findUserByEmail(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const created = await db.createUser({ name, email: email.trim().toLowerCase(), phone: phone || '', password, role: 'user' });
    const payload = {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      role: created.role,
    };
    const tokens = issueAuthTokens(payload);
    return res.status(201).json({ success: true, data: { user: payload, ...tokens } });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = req.user;
  return res.json({ success: true, data: user });
});

app.post('/api/auth/refresh', authLimiter, async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || '').trim();
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'refreshToken is required' });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    if (!payload || payload.type !== 'refresh') {
      revokeRefreshToken(refreshToken);
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const inStore = refreshTokenStore.get(refreshToken);
    if (!inStore) {
      return res.status(401).json({ success: false, message: 'Refresh token revoked or expired' });
    }
    if (String(inStore.userId) !== String(payload.id)) {
      revokeRefreshToken(refreshToken);
      return res.status(401).json({ success: false, message: 'Refresh token mismatch' });
    }

    const dbUser = await db.getUserById(payload.id);
    const user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: dbUser?.name || payload.email,
      phone: dbUser?.phone || '',
    };
    revokeRefreshToken(refreshToken);
    const tokens = issueAuthTokens(user);
    return res.json({ success: true, data: { user, ...tokens } });
  } catch {
    revokeRefreshToken(refreshToken);
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const refreshToken = String(req.body?.refreshToken || '').trim();
  revokeRefreshToken(refreshToken);
  return res.json({ success: true, message: 'Logged out' });
});

app.post('/api/auth/change-password', authenticateToken, authLimiter, withAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const userId = req.user?.id;
  const user = await db.getUserById(userId);
  if (!user || !user.password) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const bcrypt = require('bcryptjs');
  const valid = bcrypt.compareSync(String(currentPassword), String(user.password));
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  await db.updateUserPassword(userId, newPassword);
  return res.json({ success: true, message: 'Password updated successfully' });
}));

// 3. Get all Hubs
app.get('/api/hubs', async (req, res) => {
  const hubs = await db.getHubs();
  res.json({ success: true, data: hubs });
});

// 4. Get Schedules (Optional filter by Hub)
app.get('/api/schedules', async (req, res) => {
  const { hubId } = req.query;
  const schedules = await db.getSchedules(hubId);
  res.json({ success: true, data: schedules });
});

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label || `Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

let departuresArchiveInFlight = null;
function triggerDeparturesArchive() {
  if (departuresArchiveInFlight) return;
  departuresArchiveInFlight = withTimeout(db.archivePastDepartures(new Date()), 1500, 'Departure archive timeout')
    .catch((err) => {
      console.error('Departure archive failed:', err);
    })
    .finally(() => {
      departuresArchiveInFlight = null;
    });
}

// 4b. Get Departures (Today + next 2 days)
app.get('/api/departures', async (req, res) => {
  try {
    const { hubId, startDate, includePast, windowStart, windowEnd } = req.query;
    triggerDeparturesArchive();
    const localToday = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const start = typeof startDate === 'string' && startDate.trim().length > 0 ? startDate.trim() : localToday();
    const parts = start.split('-').map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ success: false, message: 'Invalid startDate (expected YYYY-MM-DD)' });
    }
    const startDt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    if (isNaN(startDt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate (expected YYYY-MM-DD)' });
    }
    const formatLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const endDt = new Date(startDt);
    endDt.setDate(endDt.getDate() + 2);
    const end = formatLocal(endDt);

    const deps = await withTimeout(db.getDeparturesBetween(start, end, hubId), 8000, 'Departures query timeout');
    const enriched = await Promise.all(
      deps.map(async (d) => {
        const shouldIncludePast = includePast === 'true';
        if (!shouldIncludePast && d.travelDate === start) {
          const depTime = String(d.departureTime || '').trim();
          const match = depTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (match) {
            const hh = parseInt(match[1], 10);
            const mm = parseInt(match[2], 10);
            const ap = match[3].toUpperCase();
            const now = new Date();
            const dep = new Date(startDt);
            let hour24 = hh % 12;
            if (ap === 'PM') hour24 += 12;
            dep.setHours(hour24, mm, 0, 0);
            if (now.getTime() > dep.getTime()) {
              return null;
            }
          }
        }
        const depMinutes = (String(d.departureTime || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i))
          ? (() => {
              const m = String(d.departureTime).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
              if (!m) return null;
              const hh = parseInt(m[1], 10);
              const mm = parseInt(m[2], 10);
              const ap = m[3].toUpperCase();
              let hour24 = hh % 12;
              if (ap === 'PM') hour24 += 12;
              return hour24 * 60 + mm;
            })()
          : null;

        const ws = typeof windowStart === 'string' ? windowStart : '06:30';
        const we = typeof windowEnd === 'string' ? windowEnd : '23:59';
        const parseHHMM = (s) => {
          const mm = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
          if (!mm) return null;
          const h = parseInt(mm[1], 10);
          const m = parseInt(mm[2], 10);
          if (h < 0 || h > 23 || m < 0 || m > 59) return null;
          return h * 60 + m;
        };
        const wStartMin = parseHHMM(ws) ?? 390;
        const wEndMin = parseHHMM(we) ?? 1439;
        if (depMinutes !== null && (depMinutes < wStartMin || depMinutes > wEndMin)) {
          return null;
        }

        const seatCapacity = d.seatCapacity ?? d.busSeatCapacity ?? 45;
        const occupied = d.occupiedSeats ?? (await db.countOccupiedSeats(d.id));
        const seatsAvailable = Math.max(0, seatCapacity - occupied);
        const expectedArrivalAt = db.computeExpectedArrivalAt(d.travelDate, d.departureTime, d.duration);
        // Use bus-specific fare if set, otherwise fall back to schedule/route baseline price
        const effectivePrice = (d.busFareAmount !== null && d.busFareAmount !== undefined)
          ? d.busFareAmount
          : (d.price ?? 0);
        return { ...d, price: effectivePrice, seatCapacity, occupiedSeats: occupied, seatsAvailable, isSoldOut: seatsAvailable <= 0, expectedArrivalAt };
      })
    );
    res.json({ success: true, data: enriched.filter(Boolean), range: { start, end } });
  } catch (error) {
    console.error('Departures fetch failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch departures' });
  }
});

app.get('/api/arrivals', async (req, res) => {
  try {
    const { hubId, startDate, destination } = req.query;
    const localToday = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const start = typeof startDate === 'string' && startDate.trim().length > 0 ? startDate.trim() : localToday();
    const parts = start.split('-').map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ success: false, message: 'Invalid startDate (expected YYYY-MM-DD)' });
    }
    const startDt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    if (isNaN(startDt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate (expected YYYY-MM-DD)' });
    }
    const endDt = new Date(startDt);
    endDt.setDate(endDt.getDate() + 2);
    const y = endDt.getFullYear();
    const m = String(endDt.getMonth() + 1).padStart(2, '0');
    const day = String(endDt.getDate()).padStart(2, '0');
    const end = `${y}-${m}-${day}`;

    const rows = await db.getArrivalsBetween(start, end, {
      hubId: typeof hubId === 'string' ? hubId : undefined,
      destination: typeof destination === 'string' ? destination : undefined,
    });
    res.json({ success: true, data: rows, range: { start, end } });
  } catch (error) {
    console.error('Arrivals fetch failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch arrivals' });
  }
});

// 4c. Create Departure (Admin-only)
app.post('/api/departures', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    let { scheduleId, busId, travelDate, status, hubId, destination, departureTime } = req.body;
    if (!busId || !travelDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields (busId, travelDate)' });
    }
    const dt = new Date(travelDate);
    if (isNaN(dt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid travelDate (expected YYYY-MM-DD)' });
    }

    if (!scheduleId) {
      if (!hubId || !destination || !departureTime) {
        return res.status(400).json({ success: false, message: 'Missing required fields (scheduleId) or (hubId, destination, departureTime)' });
      }

      const normalizeTime = (raw) => {
        const s = String(raw || '').trim();
        const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m12) {
          const hh = parseInt(m12[1], 10);
          const mm = parseInt(m12[2], 10);
          const ap = m12[3].toUpperCase();
          const hhPad = String(hh).padStart(2, '0');
          const mmPad = String(mm).padStart(2, '0');
          return `${hhPad}:${mmPad} ${ap}`;
        }
        const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
        if (m24) {
          const h24 = parseInt(m24[1], 10);
          const mm = parseInt(m24[2], 10);
          if (h24 < 0 || h24 > 23 || mm < 0 || mm > 59) return null;
          const ap = h24 >= 12 ? 'PM' : 'AM';
          const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
          return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`;
        }
        return null;
      };

      const normalizedDepartureTime = normalizeTime(departureTime);
      if (!normalizedDepartureTime) {
        return res.status(400).json({ success: false, message: 'Invalid departureTime (use HH:MM or HH:MM AM/PM)' });
      }

      const minutesFromMidnight = (() => {
        const match = normalizedDepartureTime.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return null;
        const hh = parseInt(match[1], 10);
        const mm = parseInt(match[2], 10);
        const ap = match[3].toUpperCase();
        let hour24 = hh % 12;
        if (ap === 'PM') hour24 += 12;
        return hour24 * 60 + mm;
      })();
      if (minutesFromMidnight === null || minutesFromMidnight < 390 || minutesFromMidnight > 1439) {
        return res.status(400).json({ success: false, message: 'Departure time must be between 06:30 AM and 11:59 PM' });
      }

      const cleanedDestination = String(destination).trim();
      if (!cleanedDestination) {
        return res.status(400).json({ success: false, message: 'Destination is required' });
      }

      let found = await db.findScheduleByHubDestinationTime(hubId, cleanedDestination, normalizedDepartureTime);
      if (!found) {
        const scheduleNewId = `sch_${Math.floor(Math.random() * 900000 + 100000)}`;
        found = await db.createSchedule({
          id: scheduleNewId,
          hubId,
          destination: cleanedDestination,
          departureTime: normalizedDepartureTime,
          status: 'Active',
          price: null,
          busType: null,
          duration: null,
          seatsAvailable: null,
        });
      }
      scheduleId = found.id;
    }

    const schedule = await db.getScheduleById(scheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const bus = await db.getBusById(busId);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    if (!bus.approved) return res.status(403).json({ success: false, message: 'Bus is not approved for departures' });

    const id = `dep_${Math.floor(Math.random() * 900000 + 100000)}`;
    const created = await db.createDeparture({ id, scheduleId, busId, travelDate: travelDate, status: status || 'Scheduled', seatCapacity: bus.seatCapacity ?? 45 });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create departure failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create departure' });
  }
});

app.put('/api/departures/:id', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    const { id } = req.params;
    const existing = await db.getDepartureById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Departure not found' });

    const { busId, status, travelDate } = req.body || {};
    if (travelDate !== undefined) {
      const parts = String(travelDate).split('-').map((p) => Number(p));
      if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
        return res.status(400).json({ success: false, message: 'Invalid travelDate (expected YYYY-MM-DD)' });
      }
    }

    if (busId !== undefined) {
      const bus = await db.getBusById(busId);
      if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
      if (!bus.approved) return res.status(403).json({ success: false, message: 'Bus is not approved for departures' });
    }

    const updated = await db.updateDeparture(id, { busId, status, travelDate });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update departure failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update departure' });
  }
});

app.delete('/api/departures/:id', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    const { id } = req.params;
    const existing = await db.getDepartureById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Departure not found' });

    const canDelete = await db.canDeleteDeparture(id);
    if (!canDelete) {
      return res.status(400).json({ success: false, message: 'Cannot delete a departure with active bookings. Cancel it instead.' });
    }
    const ok = await db.deleteDeparture(id);
    res.json({ success: true, data: { deleted: ok } });
  } catch (error) {
    console.error('Delete departure failed:', error);
    res.status(500).json({ success: false, message: 'Failed to delete departure' });
  }
});

app.get('/api/fleet/live', authenticateToken, async (req, res) => {
  const { hubId } = req.query;
  const fleet = await db.getBuses(hubId);
  const out = (fleet || []).map((b) => ({
    id: b.id,
    tag: b.tag,
    hubId: b.hubId,
    destination: b.destination || null,
    status: b.status || null,
    speed: Number.isFinite(Number(b.speed)) ? Number(b.speed) : 0,
    battery: Number.isFinite(Number(b.battery)) ? Number(b.battery) : 0,
    gpsLat: Number.isFinite(Number(b.gpsLat)) ? Number(b.gpsLat) : 0,
    gpsLng: Number.isFinite(Number(b.gpsLng)) ? Number(b.gpsLng) : 0,
    seatCapacity: Number.isFinite(Number(b.seatCapacity)) ? Number(b.seatCapacity) : null,
    lastSeen: b.lastSeen || null,
  }));
  res.json({ success: true, data: out });
});

// 5. Fleet management (admin-only)
app.get('/api/fleet', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { hubId } = req.query;
  const fleet = await db.getBuses(hubId);
  res.json({ success: true, data: fleet });
});

app.post('/api/fleet', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id, tag, hubId, destination, status, speed, battery, gpsLat, gpsLng, seatCapacity, approved } = req.body;
  if (!tag || !hubId) {
    return res.status(400).json({ success: false, message: 'Missing required fields (tag, hubId)' });
  }
  if (seatCapacity !== undefined && (!Number.isFinite(Number(seatCapacity)) || Number(seatCapacity) <= 0)) {
    return res.status(400).json({ success: false, message: 'seatCapacity must be a positive number' });
  }

  const busId = id || `bus_${Math.floor(Math.random() * 1000000)}`;
  const created = await db.createBus({
    id: busId,
    tag,
    hubId,
    destination: destination || '',
    status: status || 'Active',
    speed: speed ?? 0,
    battery: battery ?? 0,
    gpsLat: gpsLat ?? 0,
    gpsLng: gpsLng ?? 0,
    seatCapacity: seatCapacity ?? 45,
    approved: approved ?? true,
  });
  try {
    await db.createAuditLog({
      action: 'BUS_CREATED',
      actor: { id: req.user?.id || null, email: req.user?.email || null, role: req.user?.role || null },
      entityType: 'bus',
      entityId: created?.id || busId,
      details: { tag, hubId, destination, seatCapacity: seatCapacity ?? 45 },
    });
  } catch {}
  res.status(201).json({ success: true, data: created });
});

app.put('/api/fleet/:id', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.params;
  const updates = req.body;
  const existing = await db.getBusById(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Bus not found' });
  }

  const updated = await db.updateBus(id, updates);
  if (!updated) {
    return res.status(400).json({ success: false, message: 'Bus cannot be updated (may be deleted)' });
  }
  try {
    await db.createAuditLog({
      action: 'BUS_UPDATED',
      actor: { id: req.user?.id || null, email: req.user?.email || null, role: req.user?.role || null },
      entityType: 'bus',
      entityId: id,
      details: { updates },
    });
  } catch {}
  res.json({ success: true, data: updated });
});

app.delete('/api/fleet/:id', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.params;
  const existing = await db.getBusById(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Bus not found' });
  }
  const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : '';
  const deleted = await db.softDeleteBus(id, { id: req.user?.id, email: req.user?.email });
  if (!deleted) {
    return res.status(500).json({ success: false, message: 'Failed to delete bus' });
  }
  try {
    await db.createAuditLog({
      action: 'BUS_DELETED',
      actor: { id: req.user?.id || null, email: req.user?.email || null, role: req.user?.role || null },
      entityType: 'bus',
      entityId: id,
      details: { reason },
    });
  } catch {}
  res.json({ success: true, data: deleted });
});

app.get('/api/fleet/:id/telemetry', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;
    const history = await db.getTelemetryLogs(id, limit ? parseInt(limit, 10) : 60);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching telemetry history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch telemetry history' });
  }
});

app.post('/api/fleet/:id/maintenance', authenticateTokenOrBypassAdmin, async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.params;
  const { action } = req.body;
  const bus = await db.getBusById(id);
  if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

  let message = '';
  if (action === 'charge') {
    await db.updateBus(id, { status: 'Charging' });
    await db.createAlert('info', `Maintenance: Unit ${bus.tag} assigned to charging nexus.`);
    message = 'Charging initiated';
  } else if (action === 'repair') {
    await db.updateBus(id, { status: 'Active', battery: 100, speed: bus.status === 'Arrived' ? 0 : 65 });
    await db.createAlert('ok', `Maintenance: Unit ${bus.tag} system health restored to 100%.`);
    message = 'System health restored';
  } else if (action === 'emergency_stop') {
    await db.updateBus(id, { status: 'Critical', speed: 0 });
    await db.createAlert('critical', `Remote Protocol: Emergency override engaged for Unit ${bus.tag}.`);
    message = 'Emergency stop engaged';
  }

  const updated = await db.getBusById(id);
  io.emit('telemetry_update', updated);
  res.json({ success: true, message, data: updated });
});

// 6. Bookings (Create)
app.post('/api/bookings', attachUserIfPresent, async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admins are not allowed to create bookings' });
    }

    const { scheduleId, departureId, passengerName, phoneNumber, totalAmount, travelDate } = req.body;
    const userId = req.user?.id || req.body.userId;
    if (!scheduleId || !passengerName || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields' });
    }

    const schedule = await db.getScheduleById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Target schedule not found' });
    }

    const tDate = travelDate || 'Today';

    const effectiveDepartureId = departureId || null;
    let busCapacity = null;
    let departure = null;
    let fareAmount = schedule.price ?? 0;
    if (effectiveDepartureId) {
      departure = await db.getDepartureById(effectiveDepartureId);
      if (!departure) {
        return res.status(404).json({ success: false, message: 'Departure not found' });
      }
      if (departure.travelDate !== tDate) {
        return res.status(400).json({ success: false, message: 'Departure date mismatch' });
      }
      const bus = await db.getBusById(departure.busId);
      if (!bus || !bus.approved) {
        return res.status(403).json({ success: false, message: 'Departure bus is not approved' });
      }
      busCapacity = bus.seatCapacity ?? 45;
      const busFare = await db.getBusFare(bus.id);
      if (busFare !== null) fareAmount = busFare;
    } else {
      departure = await db.findDepartureForScheduleAndDate(scheduleId, tDate);
      if (departure) {
        const bus = await db.getBusById(departure.busId);
        if (bus && bus.approved) {
          busCapacity = bus.seatCapacity ?? 45;
          const busFare = await db.getBusFare(bus.id);
          if (busFare !== null) fareAmount = busFare;
        }
      }
    }

    // 1. Check Capacity
    const capacityLimit = busCapacity ?? (schedule.seatsAvailable > 0 ? schedule.seatsAvailable : 45);
    if (effectiveDepartureId) {
      const reserved = await db.tryReserveSeat(effectiveDepartureId);
      if (!reserved) {
        const today = new Date();
        const opts = [0, 1, 2].map((i) => {
          const dd = new Date(today);
          dd.setDate(dd.getDate() + i);
          return dd.toISOString().slice(0, 10);
        });
        return res.status(400).json({
          success: false,
          message: 'Bus is fully booked for the selected date.',
          alternatives: { action: 'choose_another_date', suggestedDates: opts.filter((d) => d !== tDate) },
        });
      }
    } else {
      const bookedCount = await db.getBookingsByScheduleAndDate(scheduleId, tDate);
      if (bookedCount >= capacityLimit) {
        const today = new Date();
        const opts = [0, 1, 2].map((i) => {
          const dd = new Date(today);
          dd.setDate(dd.getDate() + i);
          return dd.toISOString().slice(0, 10);
        });
        return res.status(400).json({
          success: false,
          message: 'Bus is fully booked for the selected date.',
          alternatives: { action: 'choose_another_date', suggestedDates: opts.filter((d) => d !== tDate) },
        });
      }
    }

    // 2. Check for duplicate booking securely on identical day
    if (userId) {
      const existing = await db.findBookingByUserAndSchedule(userId, scheduleId, tDate);
      if (existing) {
        return res.status(409).json({ 
          success: false, 
          message: 'You already have an active booking for this trip on this day. Check your manifest.' 
        });
      }
    }

    const bookingId = 'T-' + Math.floor(Math.random() * 90000 + 10000);
    const booking = await db.createBooking({
      id: bookingId,
      scheduleId,
      departureId: effectiveDepartureId || (departure ? departure.id : null),
      userId,
      passengerName,
      phoneNumber,
      paymentStatus: 'Pending',
      totalAmount: Number.isFinite(Number(fareAmount)) ? Math.round(Number(fareAmount)) : totalAmount,
      travelDate: tDate
    });

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Internal server error while creating booking' });
  }
});

// 7. Bookings (List - Admin)
app.get('/api/bookings', authenticateToken, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { paymentStatus, search } = req.query;
  const bookings = await db.getBookings({ paymentStatus, search });
  res.json({ success: true, data: bookings });
}));

app.get('/api/admin/bookings/export', authenticateToken, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const format = String(req.query.format || '').toLowerCase();
  const { paymentStatus } = req.query;
  const bookings = await db.getBookings(paymentStatus ? { paymentStatus } : undefined);

  if (format === 'csv') {
    const headers = ['Pass ID', 'Passenger', 'Phone', 'Route', 'Bus Type', 'Date', 'Time', 'Status', 'Amount'];
    const escapeCsv = (val) => {
      const s = String(val === null || val === undefined ? '' : val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = bookings.map((b) => ([
      escapeCsv(b.id),
      escapeCsv(b.passengerName),
      escapeCsv(b.phoneNumber),
      escapeCsv(`Kampala -> ${b.destination || ''}`),
      escapeCsv(b.busType || ''),
      escapeCsv(b.travelDate),
      escapeCsv(b.departureTime),
      escapeCsv(b.paymentStatus),
      escapeCsv(b.totalAmount),
    ].join(',')));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const dateKey = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=TRANSPO_BOOKINGS_${dateKey}.csv`);
    return res.send(csvContent);
  }

  if (format === 'pdf') {
    if (bookings.length > 5000) {
      return res.status(413).json({ success: false, message: 'Dataset too large for PDF export' });
    }
    const lang = pickLang(req);
    const dateKey = new Date().toISOString().split('T')[0];
    const columns = [
      { label: 'Pass ID', width: 64 },
      { label: 'Passenger', width: 86 },
      { label: 'Phone', width: 72 },
      { label: 'Route', width: 98 },
      { label: 'Bus Type', width: 72 },
      { label: 'Date', width: 58 },
      { label: 'Time', width: 54 },
      { label: 'Status', width: 56 },
      { label: 'Amount', width: 58, align: 'right' },
    ];
    const rows = bookings.map((b) => ([
      b.id,
      b.passengerName,
      b.phoneNumber,
      `Kampala -> ${b.destination || ''}`,
      b.busType || '',
      b.travelDate,
      b.departureTime,
      b.paymentStatus,
      Number(b.totalAmount || 0).toLocaleString(),
    ]));
    return sendPdf(res, {
      filename: `TRANSPO_BOOKINGS_${dateKey}.pdf`,
      title: 'Bookings Export',
      subtitle: `Total records: ${bookings.length}`,
      columns,
      rows,
      lang,
    });
  }

  return res.status(400).json({ success: false, message: 'Unsupported export format' });
}));

// 7b. User bookings (Specific route first)
app.get('/api/bookings/user/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const userIdNum = parseInt(id, 10);
    const requestedId = isNaN(userIdNum) ? id : userIdNum;
    if (currentUser.role !== 'admin' && String(currentUser.id) !== String(requestedId)) {
      return res.status(403).json({ success: false, message: 'Access to requested bookings is forbidden' });
    }
    console.log(`Fetching bookings for user: ${id}`);
    const bookings = await db.getUserBookings(requestedId);
    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

app.get('/api/bookings/user/:id/export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const userIdNum = parseInt(id, 10);
    const requestedId = isNaN(userIdNum) ? id : userIdNum;
    if (currentUser.role !== 'admin' && String(currentUser.id) !== String(requestedId)) {
      return res.status(403).json({ success: false, message: 'Access to requested bookings is forbidden' });
    }

    const bookings = await db.getUserBookings(requestedId);
    const format = String(req.query.format || '').toLowerCase();

    if (format === 'csv') {
      const headers = ['Pass ID', 'Passenger', 'Route', 'Bus Type', 'Date', 'Time', 'Status'];
      const rows = bookings.map((b) => ([
        b.id,
        b.passengerName,
        `Kampala -> ${b.destination || ''}`,
        b.busType || '',
        b.travelDate,
        b.departureTime,
        b.paymentStatus,
      ].join(',')));
      const csvContent = [headers.join(','), ...rows].join('\n');
      const dateKey = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=TRANSPO_MY_BOOKINGS_${dateKey}.csv`);
      return res.send(csvContent);
    }

    if (format === 'pdf') {
      if (bookings.length > 5000) {
        return res.status(413).json({ success: false, message: 'Dataset too large for PDF export' });
      }
      const lang = pickLang(req);
      const dateKey = new Date().toISOString().split('T')[0];
      const columns = [
        { label: 'Pass ID', width: 76 },
        { label: 'Passenger', width: 110 },
        { label: 'Route', width: 130 },
        { label: 'Bus Type', width: 86 },
        { label: 'Date', width: 70 },
        { label: 'Time', width: 70 },
        { label: 'Status', width: 70 },
      ];
      const rows = bookings.map((b) => ([
        b.id,
        b.passengerName,
        `Kampala -> ${b.destination || ''}`,
        b.busType || '',
        b.travelDate,
        b.departureTime,
        b.paymentStatus,
      ]));
      return sendPdf(res, {
        filename: `TRANSPO_MY_BOOKINGS_${dateKey}.pdf`,
        title: 'My Bookings',
        subtitle: `Total records: ${bookings.length}`,
        columns,
        rows,
        lang,
      });
    }

    return res.status(400).json({ success: false, message: 'Unsupported export format' });
  } catch (error) {
    console.error('Error exporting user bookings:', error);
    return res.status(500).json({ success: false, message: 'Failed to export bookings' });
  }
});

// 7c. Bookings (Get One - Generic route second)
app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const booking = await db.getBookingById(id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  res.json({ success: true, data: booking });
});


// 8. Mobile Money Payment Simulation
app.post('/api/payments/mobile-money', async (req, res) => {
  const { bookingId, deliveryId, phoneNumber, provider } = req.body;
  if ((!bookingId && !deliveryId) || !phoneNumber || !provider) {
    return res.status(400).json({ success: false, message: 'Missing payment details' });
  }

  // Simulate external payment gateway processing
  setTimeout(async () => {
    try {
      if (bookingId) {
        await db.updateBookingStatus(bookingId, 'Completed');
        console.log(`Payment confirmed for Booking: ${bookingId} via ${provider}`);
        return res.json({ success: true, message: 'Payment processed successfully', transactionId: 'TX-' + Date.now() });
      }

      const before = await db.getDeliveryById(deliveryId);
      const delivery = await db.markDeliveryPaid(deliveryId);
      if (!delivery) {
        return res.status(404).json({ success: false, message: 'Delivery not found' });
      }
      try {
        await db.createDeliveryAuditLog({
          trackingCode: delivery.trackingCode,
          deliveryId: delivery.id,
          actorId: null,
          actorRole: 'system',
          action: 'payment_completed',
          fromStatus: before?.status || null,
          toStatus: delivery.status,
          fromReceived: before ? (before.received === true) : null,
          toReceived: delivery.received === true,
          ip: null,
        });
      } catch {}
      emitDeliveryUpdate(delivery);
      console.log(`Payment confirmed for Delivery: ${deliveryId} via ${provider}`);
      return res.json({
        success: true,
        message: 'Delivery payment processed successfully',
        transactionId: 'TX-' + Date.now(),
        trackingCode: delivery.trackingCode,
      });
    } catch (err) {
      console.error('Payment callback error:', err);
      // Note: Header might already be sent in timeout
    }
  }, 1000);
});


// 9. Stats (Admin)
app.get('/api/stats', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const stats = await db.getStats();
  res.json({ success: true, data: stats });
});

app.get('/api/alerts', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const alerts = await db.getAlerts();
  res.json({ success: true, data: alerts });
});

app.get('/api/deliveries/mine', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ success: false, message: 'Authentication required' });
    const rows = await db.listDeliveriesByUser(currentUser.id, 200);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('My deliveries fetch failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deliveries' });
  }
});

app.get('/api/deliveries/quote/:departureId', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ success: false, message: 'Authentication required' });
    const departure = await db.getDepartureById(req.params.departureId);
    if (!departure) return res.status(404).json({ success: false, message: 'Departure not found' });
    const bus = await db.getBusById(departure.busId);
    if (!bus || !bus.approved) return res.status(403).json({ success: false, message: 'Bus is not approved' });
    const fee = (await db.getDeliveryFeeByBus(bus.id)) ?? 10000;
    res.json({ success: true, data: { feeAmount: fee, busId: bus.id, busTag: bus.tag, travelDate: departure.travelDate } });
  } catch (error) {
    console.error('Delivery quote failed:', error);
    res.status(500).json({ success: false, message: 'Failed to quote delivery' });
  }
});

app.post('/api/deliveries', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { departureId, description, receiverName, receiverPhone, senderName, senderPhone, contacts } = req.body;
    if (!departureId || !receiverName || !receiverPhone) {
      return res.status(400).json({ success: false, message: 'Missing required fields (departureId, receiverName, receiverPhone)' });
    }

    const created = await db.createUserDeliveryRequest({
      userId: currentUser.id,
      departureId,
      senderName: senderName || currentUser.name,
      senderPhone: senderPhone || currentUser.phone,
      receiverName,
      receiverPhone,
      description,
      contacts,
    });
    if (created.error) return res.status(400).json({ success: false, message: created.error });
    try {
      await db.createDeliveryAuditLog({
        trackingCode: created.delivery.trackingCode,
        deliveryId: created.delivery.id,
        actorId: currentUser.id,
        actorRole: currentUser.role,
        action: 'create_user',
        fromStatus: null,
        toStatus: created.delivery.status,
        fromReceived: null,
        toReceived: created.delivery.received === true,
        ip: req.ip,
      });
    } catch {}
    emitDeliveryUpdate(created.delivery);
    res.status(201).json({
      success: true,
      data: {
        deliveryId: created.delivery.id,
        trackingCode: created.delivery.trackingCode,
        feeAmount: created.delivery.feeAmount,
      },
      message: 'Delivery created. Print and attach the tracking code to the parcel before dispatch, then complete payment to enable tracking.',
    });
  } catch (error) {
    console.error('Create user delivery failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create delivery' });
  }
});

app.get('/api/deliveries/:trackingCode', async (req, res) => {
  try {
    const delivery = await db.getDeliveryByTrackingCode(req.params.trackingCode);
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    if (delivery.paymentStatus !== 'Completed') {
      return res.status(403).json({ success: false, message: 'Delivery tracking is available after payment is completed' });
    }
    let trip = null;
    if (delivery.tripId) {
      trip = (await db.getDepartureById(delivery.tripId)) || (await db.getArrivalById(delivery.tripId));
    }
    let vehicle = null;
    if (delivery.busId) {
      const bus = await db.getBusById(delivery.busId);
      if (bus) {
        vehicle = {
          id: bus.id,
          tag: bus.tag,
          status: bus.status,
          gpsLat: bus.gpsLat,
          gpsLng: bus.gpsLng,
          lastSeen: bus.lastSeen || null,
        };
      }
    }
    const contacts = await db.getDeliveryContacts(delivery.id);
    res.json({ success: true, data: { ...delivery, trip, vehicle, contacts } });
  } catch (error) {
    console.error('Delivery tracking failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery' });
  }
});

app.get('/api/metrics/detailed', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const metrics = await db.getReportingMetrics();
  res.json({ success: true, data: metrics });
});

app.get('/api/metrics/export', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const format = String(req.query.format || '').toLowerCase();
  const metrics = await db.getReportingMetrics();
  const stats = await db.getStats();
  const dateKey = new Date().toISOString().split('T')[0];

  // Build flat rows: KPIs + challenges
  const kpiRows = [
    ["KPI", "Value", "Notes"],
    ["Today's Bookings",       String(metrics.todayBookings),  "Bookings created today"],
    ["Today's Revenue",        `UGX ${Number(metrics.todayRevenue).toLocaleString()}`, "Completed ticket payments today"],
    ["Today's Delivery Fees",  `UGX ${Number(metrics.todayDeliveryRevenue || 0).toLocaleString()}`, "Completed delivery payments today"],
    ["On-Time Rate",           metrics.onTimeRate,              "Based on active schedules"],
    ["Total Buses",            String(stats.totalBuses),        "All registered buses"],
    ["Total Bookings",         String(stats.totalBookings),     "All-time bookings"],
    ["Total Revenue",          `UGX ${Number(stats.totalRevenue).toLocaleString()}`, "All-time completed ticket payments"],
    ["Total Delivery Revenue", `UGX ${Number(stats.totalDeliveryRevenue || 0).toLocaleString()}`, "All-time completed delivery fees"],
    ["Active Schedules",       String(stats.activeSchedules),  "Schedules with On Time status"],
  ];

  const challengeRows = [
    [],
    ["ACTIVE CHALLENGES", "", "", "", ""],
    ["Title", "Severity", "Status", "Metric", "Solution"],
    ...(metrics.challenges || []).map(c => [
      c.title,
      c.severity,
      c.status,
      c.metric,
      c.solution,
    ]),
  ];

  if (format === 'csv') {
    const allRows = [...kpiRows, ...challengeRows];
    const csvContent = allRows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=TRANSPO_OPS_INTELLIGENCE_${dateKey}.csv`);
    return res.send(csvContent);
  }

  if (format === 'pdf') {
    const lang = pickLang(req);
    const columns = [
      { label: 'Title / KPI',   width: 160 },
      { label: 'Severity',      width: 70 },
      { label: 'Status',        width: 90 },
      { label: 'Metric',        width: 80 },
      { label: 'Solution',      width: 160 },
    ];
    // KPI summary rows first
    const kpiPdfRows = [
      ["Today's Bookings",       metrics.todayBookings,  '-', '-', 'Bookings created today'],
      ["Today's Revenue",        `UGX ${Number(metrics.todayRevenue).toLocaleString()}`, '-', '-', 'Completed ticket payments today'],
      ["Today's Delivery Fees",  `UGX ${Number(metrics.todayDeliveryRevenue || 0).toLocaleString()}`, '-', '-', 'Completed delivery payments today'],
      ["On-Time Rate",           '-', '-', metrics.onTimeRate, 'Based on active schedules'],
      ["Total Buses",            stats.totalBuses, '-', '-', 'All registered buses'],
      ["Total Revenue",          `UGX ${Number(stats.totalRevenue).toLocaleString()}`, '-', '-', 'All-time completed ticket payments'],
      ["Total Delivery Revenue", `UGX ${Number(stats.totalDeliveryRevenue || 0).toLocaleString()}`, '-', '-', 'All-time completed delivery fees'],
    ];
    const challengePdfRows = (metrics.challenges || []).map(c => [
      c.title, c.severity, c.status, c.metric, c.solution,
    ]);
    return sendPdf(res, {
      filename: `TRANSPO_OPS_INTELLIGENCE_${dateKey}.pdf`,
      title: 'Ops Intelligence Report',
      subtitle: `Generated: ${dateKey} · Challenges: ${(metrics.challenges || []).length} · On-Time: ${metrics.onTimeRate}`,
      columns,
      rows: [...kpiPdfRows, ...challengePdfRows],
      lang,
    });
  }

  res.json({ success: true, data: { metrics, stats, generatedAt: new Date().toISOString() } });
});

app.get('/api/admin/manifest/export', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const manifest = await db.getDailyManifest();
  const format = String(req.query.format || '').toLowerCase();
  
  if (format === 'csv') {
    const headers = ['Booking ID', 'Passenger', 'Route Destination', 'Schedule Type', 'Amount (UGX)', 'Travel Date', 'Departure Time'];
    const rows = manifest.map(b => [
      b.id,
      b.passengerName,
      b.destination,
      b.busType,
      b.totalAmount,
      b.travelDate,
      b.departureTime
    ].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    // Ensure the filename is properly set for the browser download
    res.setHeader('Content-Disposition', `attachment; filename=TRANSPO_AUDIT_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csvContent);
  }

  if (format === 'pdf') {
    if (manifest.length > 5000) {
      return res.status(413).json({ success: false, message: 'Dataset too large for PDF export' });
    }
    const lang = pickLang(req);
    const dateKey = new Date().toISOString().split('T')[0];
    const columns = [
      { label: 'Booking ID', width: 78 },
      { label: 'Passenger', width: 86 },
      { label: 'Destination', width: 86 },
      { label: 'Bus Type', width: 76 },
      { label: 'Amount (UGX)', width: 76, align: 'right' },
      { label: 'Date', width: 62 },
      { label: 'Time', width: 62 },
    ];
    const rows = manifest.map((b) => ([
      b.id,
      b.passengerName,
      b.destination,
      b.busType,
      Number(b.totalAmount || 0).toLocaleString(),
      b.travelDate,
      b.departureTime,
    ]));
    return sendPdf(res, {
      filename: `TRANSPO_AUDIT_${dateKey}.pdf`,
      title: 'Operational Audit Manifest',
      subtitle: `Total records: ${manifest.length}`,
      columns,
      rows,
      lang,
    });
  }

  res.json({
    success: true,
    data: manifest,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords: manifest.length,
      totalValue: manifest.reduce((sum, b) => sum + b.totalAmount, 0)
    }
  });
});

app.post('/api/admin/storage/backup', authenticateToken, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = await db.backupData();
  res.json({ success: true, data: result });
}));

app.post('/api/admin/storage/recover/:entity', authenticateToken, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const entity = String(req.params.entity || '').trim();
  if (!entity) return res.status(400).json({ success: false, message: 'Missing entity' });
  const ok = await db.recoverEntity(entity);
  if (!ok) return res.status(404).json({ success: false, message: 'No backup available for entity' });
  res.json({ success: true, data: { entity, recovered: true } });
}));

app.post('/api/admin/storage/reset-operational', authenticateToken, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = await db.resetOperationalData();
  res.json({ success: true, data: result });
}));

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/api/admin/deliveries', authenticateTokenOrBypassAdmin, withAsync(async (req, res) => {
  if (!requireAdminOrLogistics(req, res)) return;

  const radiusMeters = Number(process.env.DELIVERY_GEOFENCE_METERS || 200);
  const deliveries = await db.listDeliveries(500);
  const buses = await db.getBuses();
  const busById = new Map((buses || []).map((b) => [String(b.id), b]));

  const updatesToEmit = [];
  const out = [];

  for (const d of deliveries) {
    const bus = d.busId ? busById.get(String(d.busId)) : null;
    const dest = d.destination ? CITY_COORDS[d.destination] : null;

    let arrivedNow = d.arrived === true;
    let arrivedAtOut = d.arrivedAt || null;
    if (!arrivedNow && d.paymentStatus === 'Completed' && bus && dest && Number.isFinite(Number(bus.gpsLat)) && Number.isFinite(Number(bus.gpsLng))) {
      const meters = haversineMeters(Number(bus.gpsLat), Number(bus.gpsLng), Number(dest.lat), Number(dest.lng));
      if (meters <= radiusMeters) {
        const updated = await db.markDeliveryArrived(d.trackingCode, new Date().toISOString());
        if (updated) {
          arrivedNow = true;
          arrivedAtOut = updated.arrivedAt || arrivedAtOut;
          try {
            await db.createDeliveryAuditLog({
              trackingCode: updated.trackingCode,
              deliveryId: updated.id,
              actorId: null,
              actorRole: 'system',
              action: 'bus_arrived',
              fromStatus: d.status || null,
              toStatus: updated.status,
              fromReceived: d.received === true,
              toReceived: updated.received === true,
              ip: null,
            });
          } catch {}
          updatesToEmit.push(updated);
        }
      }
    }

    out.push({
      trackingCode: d.trackingCode,
      receiverName: d.receiverName,
      busId: d.busId || null,
      busTag: bus ? bus.tag : null,
      destination: d.destination || null,
      travelDate: d.travelDate || null,
      enRouteStatus: arrivedNow ? 'Arrived' : 'En-route',
      arrived: arrivedNow,
      arrivedAt: arrivedAtOut,
      received: d.received === true,
      receivedAt: d.receivedAt || null,
    });
  }

  for (const u of updatesToEmit) emitDeliveryUpdate(u);
  res.json({ success: true, data: out });
}));

app.get('/api/admin/delivery-fees', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.listDeliveryFees();
  res.json({ success: true, data: rows });
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = await db.getUsersAdmin();
  res.json({ success: true, data: users });
});

app.get('/api/admin/users/:id', authenticateToken, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const details = await db.getAdminUserDetails(req.params.id);
  if (!details) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: details });
}));

app.put('/api/admin/users/:id/password', authenticateToken, authLimiter, withAsync(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const targetUserId = req.params.id;
  const { newPassword } = req.body || {};
  if (!newPassword) return res.status(400).json({ success: false, message: 'newPassword is required' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }
  const target = await db.getUserById(targetUserId);
  if (!target) return res.status(404).json({ success: false, message: 'User not found' });
  await db.updateUserPassword(targetUserId, newPassword);
  res.json({ success: true, message: 'Password updated successfully' });
}));

app.put('/api/admin/delivery-fees/:busId', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { feeAmount } = req.body;
  if (feeAmount === undefined) return res.status(400).json({ success: false, message: 'Missing feeAmount' });
  if (!Number.isFinite(Number(feeAmount)) || Number(feeAmount) < 0) {
    return res.status(400).json({ success: false, message: 'feeAmount must be a non-negative number' });
  }
  const updated = await db.upsertDeliveryFee(req.params.busId, feeAmount);
  res.json({ success: true, data: updated });
});

app.post('/api/admin/deliveries', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdminOrLogistics(req, res)) return;

  try {
    const { tripId, receiverName, receiverPhone, senderName, senderPhone, description } = req.body;
    if (!tripId || !receiverName || !receiverPhone) {
      return res.status(400).json({ success: false, message: 'Missing required fields (tripId, receiverName, receiverPhone)' });
    }

    const departure = await db.getDepartureById(tripId);
    let travelDate = null;
    let destination = null;
    let hubId = null;
    let busId = null;
    if (departure) {
      const schedule = await db.getScheduleById(departure.scheduleId);
      travelDate = departure.travelDate;
      destination = schedule?.destination || null;
      hubId = schedule?.hubId || departure.hubId || null;
      busId = departure.busId || null;
    } else {
      const arrival = await db.getArrivalById(tripId);
      if (arrival) {
        travelDate = arrival.travelDate;
        destination = arrival.destination || null;
        hubId = arrival.hubId || null;
        busId = arrival.busId || null;
      }
    }

    const id = `del_${Math.floor(Math.random() * 900000 + 100000)}`;
    const created = await db.createDelivery({
      id,
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
      status: 'Pending',
    });
    const paid = await db.markDeliveryPaid(created.id);
    try {
      await db.createDeliveryAuditLog({
        trackingCode: (paid || created).trackingCode,
        deliveryId: (paid || created).id,
        actorId: req.user?.id,
        actorRole: req.user?.role,
        action: 'create',
        fromStatus: null,
        toStatus: (paid || created).status,
        fromReceived: null,
        toReceived: (paid || created).received === true,
        ip: req.ip,
      });
    } catch {}
    emitDeliveryUpdate(paid || created);
    res.status(201).json({ success: true, data: paid || created });
  } catch (error) {
    console.error('Create delivery failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create delivery' });
  }
});

app.get('/api/admin/deliveries/:trackingCode', authenticateTokenOrBypassAdmin, withAsync(async (req, res) => {
  if (!requireAdminOrLogistics(req, res)) return;
  const trackingCode = req.params.trackingCode;
  const delivery = await db.getDeliveryByTrackingCode(trackingCode);
  if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
  const contacts = await db.getDeliveryContacts(delivery.id);
  const audit = await db.listDeliveryAuditLogs(trackingCode, 100);
  const bus = delivery.busId ? await db.getBusById(delivery.busId) : null;
  const vehicle = bus ? { id: bus.id, tag: bus.tag, status: bus.status, gpsLat: bus.gpsLat, gpsLng: bus.gpsLng, lastSeen: bus.lastSeen || null } : null;

  res.json({ success: true, data: { delivery, contacts, vehicle, audit } });
}));

app.get('/api/admin/deliveries/:trackingCode/contact', authenticateTokenOrBypassAdmin, withAsync(async (req, res) => {
  if (!requireAdminOrLogistics(req, res)) return;
  const row = await db.getDeliveryContactLookup(req.params.trackingCode);
  if (!row) return res.status(404).json({ success: false, message: 'Delivery not found' });
  res.json({ success: true, data: row });
}));

app.put('/api/admin/deliveries/:trackingCode/received', authenticateTokenOrBypassAdmin, withAsync(async (req, res) => {
  const actor = requireAdminOrLogistics(req, res);
  if (!actor) return;
  const trackingCode = req.params.trackingCode;
  const { received, undo } = req.body || {};
  if (typeof received !== 'boolean') return res.status(400).json({ success: false, message: 'received must be boolean' });
  if (undo !== undefined && typeof undo !== 'boolean') return res.status(400).json({ success: false, message: 'undo must be boolean' });

  const before = await db.getDeliveryByTrackingCode(trackingCode);
  if (!before) return res.status(404).json({ success: false, message: 'Delivery not found' });

  let updated;
  try {
    updated = await db.updateDeliveryReceivedState(trackingCode, received, { receivedBy: actor.id, undo: undo === true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNDO_REQUIRED') {
      return res.status(409).json({ success: false, message: 'Undo required to mark a received parcel as not received' });
    }
    throw e;
  }
  if (!updated) return res.status(404).json({ success: false, message: 'Delivery not found' });

  try {
    await db.createDeliveryAuditLog({
      trackingCode,
      deliveryId: updated.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: received ? 'set_received' : 'set_not_received',
      fromStatus: before.status,
      toStatus: updated.status,
      fromReceived: before.received === true,
      toReceived: updated.received === true,
      ip: req.ip,
    });
  } catch {}

  emitDeliveryUpdate(updated);
  res.json({ success: true, data: updated });
}));

app.put('/api/admin/deliveries/:trackingCode', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Missing status' });
    const before = await db.getDeliveryByTrackingCode(req.params.trackingCode);
    const updated = await db.updateDeliveryStatus(req.params.trackingCode, status);
    if (!updated) return res.status(404).json({ success: false, message: 'Delivery not found' });
    try {
      await db.createDeliveryAuditLog({
        trackingCode: updated.trackingCode,
        deliveryId: updated.id,
        actorId: req.user?.id,
        actorRole: req.user?.role,
        action: 'status_update',
        fromStatus: before?.status || null,
        toStatus: updated.status,
        fromReceived: before ? (before.received === true) : null,
        toReceived: updated.received === true,
        ip: req.ip,
      });
    } catch {}
    emitDeliveryUpdate(updated);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update delivery failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update delivery' });
  }
});

app.get('/api/pricing', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const routes = await db.getPricingRoutes();
  res.json({ success: true, data: routes });
});

app.put('/api/pricing/:id', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const updates = req.body;
  const updated = await db.updatePricingRoute(id, updates);
  res.json({ success: true, data: updated });
});

app.get('/api/admin/bus-fares', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.listBusFares();
  res.json({ success: true, data: rows });
});

app.put('/api/admin/bus-fares/:busId', authenticateTokenOrBypassAdmin, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { fareAmount } = req.body || {};
  if (fareAmount === undefined) return res.status(400).json({ success: false, message: 'Missing fareAmount' });
  if (!Number.isFinite(Number(fareAmount)) || Number(fareAmount) < 0) {
    return res.status(400).json({ success: false, message: 'fareAmount must be a non-negative number' });
  }
  const updated = await db.upsertBusFare(req.params.busId, fareAmount);
  res.json({ success: true, data: updated });
});

// 9b. Geolocation Routing Proxy
app.get('/api/routing', async (req, res) => {
  try {
    const { srcLat, srcLng, destLat, destLng } = req.query;
    if (!srcLat || !srcLng || !destLat || !destLng) {
      return res.status(400).json({ success: false, message: 'Source and destination coordinates are required' });
    }

    const sLat = Number(srcLat);
    const sLng = Number(srcLng);
    const dLat = Number(destLat);
    const dLng = Number(destLng);
    if (![sLat, sLng, dLat, dLng].every((n) => Number.isFinite(n))) {
      return res.status(400).json({ success: false, message: 'Coordinates must be valid numbers' });
    }
    
    const path = await getOrFetchOSRMRoute(sLat, sLng, dLat, dLng);
    
    if (!path) {
      return res.status(404).json({ success: false, message: 'No road route found between these points' });
    }
    
    res.json({ success: true, data: path });
  } catch (error) {
    console.error('Routing error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate road route' });
  }
});

// 10. Admin Scenarios (Presentation Mode)
app.post('/api/admin/scenario', authenticateToken, async (req, res) => {
  try {
    const { scenario, hubId } = req.body;
    if (!requireAdmin(req, res)) return;

  const buses = await db.getBuses();
  let affectedCount = 0;

  // Helper: upsert a scenario challenge into the challenges table
  async function upsertScenarioChallenge({ id, severity, title, detail, metric, solution, impact, status }) {
    await db.upsertChallenge({ id, severity, title, detail, metric, solution, impact, status, scenarioGenerated: true });
  }

  if (scenario === 'battery_low') {
    const target = buses.find(b => b.battery > 50);
    if (target) {
      affectedCount = 1;
      await upsertScenarioChallenge({
        id: 'scenario_battery_low',
        severity: 'critical',
        title: `Unit ${target.tag} Battery Critical`,
        detail: `Simulated failure: Unit ${target.tag} battery dropped to 12%. Immediate charging required to prevent service disruption.`,
        metric: '12% battery',
        solution: `Reroute ${target.tag} passengers to next available bus and dispatch to nearest charging bay immediately.`,
        impact: 'Service disruption avoided within 45 min',
        status: 'action_required',
      });
      await db.createAlert('warning', `Simulated Failure: Unit ${target.tag} battery dropped to 12%`);
    }
  }
  else if (scenario === 'traffic_delay') {
    affectedCount = buses.filter(b => b.status === 'En Route' || b.status === 'Active').length;
    await upsertScenarioChallenge({
      id: 'scenario_traffic_delay',
      severity: 'warning',
      title: 'CBD Gridlock — Mass Traffic Delay',
      detail: `Heavy congestion simulated on major CBD arteries. ${affectedCount} en-route units affected. Estimated delay: 25–40 min.`,
      metric: `${affectedCount} units delayed`,
      solution: 'Activate alternate routing via Northern Bypass. Notify passengers via SMS of expected delays.',
      impact: 'Delay reduced from 40 min to 15 min',
      status: 'in_progress',
    });
    await db.createAlert('info', 'Traffic Advisory: Heavy congestion simulated on major arteries.');
  }
  else if (scenario === 'hub_congestion') {
    affectedCount = 1;
    await upsertScenarioChallenge({
      id: 'scenario_hub_congestion',
      severity: 'warning',
      title: 'Hub Terminal Near Capacity',
      detail: 'Hub reporting 98% bay occupancy. Only 1 bay available. Incoming buses risk queuing on access road.',
      metric: '98% bay load',
      solution: 'Activate overflow routing to secondary staging area. Hold 3 inbound units at 2km holding point.',
      impact: '-35% congestion within 20 min',
      status: 'action_required',
    });
    await db.createAlert('warning', 'Terminal Alert: Hub reporting 98% bay occupancy.');
  }
  else if (scenario === 'weather_emergency') {
    affectedCount = buses.filter(b => b.status === 'En Route' || b.status === 'Delayed').length;
    await upsertScenarioChallenge({
      id: 'scenario_weather_emergency',
      severity: 'critical',
      title: 'Weather Emergency — Speed Restriction Active',
      detail: `Torrential rain advisory issued. All en-route units restricted to 40% max speed. ${affectedCount} buses affected. ETA delays expected across all routes.`,
      metric: `${affectedCount} units restricted`,
      solution: 'Issue passenger delay notifications. Extend departure windows by 30 min. Monitor road conditions every 15 min.',
      impact: 'Passenger safety maintained. Delays communicated proactively.',
      status: 'monitoring',
    });
    await db.createAlert('warning', 'Weather Emergency: Global speed restriction active (40% max).');
  }
  else if (scenario === 'hub_offline') {
    const targetHub = hubId || 'h1';
    const hubName = targetHub === 'h1' ? 'Namanve' : 'Regional';
    affectedCount = 1;
    await upsertScenarioChallenge({
      id: 'scenario_hub_offline',
      severity: 'critical',
      title: `${hubName} Hub Power Failure`,
      detail: `${hubName} Hub is offline due to total power failure. All charging services suspended. Buses cannot depart or arrive until power is restored.`,
      metric: 'Hub offline',
      solution: `Activate generator backup. Reroute all ${hubName} Hub departures to nearest operational hub. ETA for power restoration: 2 hrs.`,
      impact: 'Service continuity maintained via rerouting',
      status: 'action_required',
    });
    await db.createAlert('critical', `Infrastructure Alert: ${hubName} Hub offline due to power failure.`);
  }
  else if (scenario === 'reset') {
    // Remove all scenario-generated challenges
    await db.clearScenarioChallenges();
    await db.createAlert('ok', 'System Reset: All scenario challenges cleared. Network nominal.');
    affectedCount = buses.length;
  }
  else {
    return res.status(400).json({ success: false, message: 'Invalid scenario type' });
  }

    res.json({ success: true, message: `Scenario ${scenario} active. Affected units: ${affectedCount}` });

    // Emit latest alerts via socket so Digital Twin Events panel updates immediately
    try {
      const latestAlerts = await db.getAlerts();
      io.emit('alerts_update', latestAlerts.slice(0, 10));
    } catch {}
  } catch (error) {
    console.error('Error triggering scenario:', error);
    res.status(500).json({ success: false, message: 'Internal server error while triggering scenario' });
  }
});

// Simulation: Update bus positions every 5 seconds
const CITY_COORDS = {
  'Entebbe': { lat: 0.0512, lng: 32.4637 },
  'Jinja': { lat: 0.4479, lng: 33.2032 },
  'Mbale': { lat: 1.0789, lng: 34.1815 },
  'Masaka': { lat: -0.3338, lng: 31.7341 },
  'Mbarara': { lat: -0.6072, lng: 30.6545 },
  'Fort Portal': { lat: 0.6631, lng: 30.2763 },
  'Gulu': { lat: 2.7747, lng: 32.2990 },
  'Arua': { lat: 3.0303, lng: 30.9073 },
  'Hoima': { lat: 1.4331, lng: 31.3522 },
};

const CITY_NAMES = Object.keys(CITY_COORDS);

const OSRM_CACHE_ENABLED = String(process.env.OSRM_CACHE_ENABLED ?? 'true').toLowerCase() !== 'false';
const OSRM_CACHE_MAX_ENTRIES = Math.max(0, Number(process.env.OSRM_CACHE_MAX_ENTRIES || 800));
const OSRM_CACHE_TTL_MS = Math.max(0, Number(process.env.OSRM_CACHE_TTL_MS || 6 * 60 * 60 * 1000));
const OSRM_CACHE_COORD_PRECISION = Math.min(6, Math.max(0, Number(process.env.OSRM_CACHE_COORD_PRECISION || 4)));
const OSRM_FETCH_TIMEOUT_MS = Math.max(500, Number(process.env.OSRM_FETCH_TIMEOUT_MS || 6000));

class LruTtlCache {
  constructor({ maxEntries, ttlMs }) {
    this.maxEntries = Number.isFinite(Number(maxEntries)) ? Number(maxEntries) : 0;
    this.ttlMs = Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : 0;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expired = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (entry.expiresAt !== 0 && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.expired++;
      this.misses++;
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value) {
    const expiresAt = this.ttlMs > 0 ? Date.now() + this.ttlMs : 0;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    while (this.maxEntries > 0 && this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
      this.evictions++;
    }
  }

  stats() {
    return {
      enabled: OSRM_CACHE_ENABLED,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      size: this.map.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expired: this.expired,
    };
  }
}

const osrmCache = new LruTtlCache({ maxEntries: OSRM_CACHE_MAX_ENTRIES, ttlMs: OSRM_CACHE_TTL_MS });
const osrmInFlight = new Map();
const osrmFetchStats = { fetchErrors: 0, timeouts: 0, lastErrorAt: null, lastTimeoutAt: null };
let osrmFailureStreak = 0;
let lastOsrmAlertAt = 0;

async function getOrFetchOSRMRoute(srcLat, srcLng, destLat, destLng) {
  if (![srcLat, srcLng, destLat, destLng].every((n) => Number.isFinite(Number(n)))) return null;
  const precision = OSRM_CACHE_COORD_PRECISION;
  const cacheKey = `${Number(srcLat).toFixed(precision)},${Number(srcLng).toFixed(precision)}_${Number(destLat).toFixed(precision)},${Number(destLng).toFixed(precision)}`;

  if (OSRM_CACHE_ENABLED) {
    const cached = osrmCache.get(cacheKey);
    if (cached) return cached;
  }

  const inFlight = osrmInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const p = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_FETCH_TIMEOUT_MS);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${srcLng},${srcLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response || response.ok !== true) {
        osrmFailureStreak++;
        osrmFetchStats.fetchErrors++;
        osrmFetchStats.lastErrorAt = new Date().toISOString();
        return null;
      }
      const data = await response.json();
      if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const raw = data.routes[0]?.geometry?.coordinates;
        if (Array.isArray(raw) && raw.length > 0) {
          const coords = raw
            .filter((c) => Array.isArray(c) && c.length >= 2)
            .map((c) => [Number(c[1]), Number(c[0])])
            .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
          if (coords.length > 0) {
            osrmFailureStreak = 0;
            if (OSRM_CACHE_ENABLED) osrmCache.set(cacheKey, coords);
            return coords;
          }
        }
      }
      osrmFailureStreak++;
      return null;
    } catch (err) {
      if (err?.name === 'AbortError') {
        osrmFetchStats.timeouts++;
        osrmFetchStats.lastTimeoutAt = new Date().toISOString();
      } else {
        osrmFetchStats.fetchErrors++;
        osrmFetchStats.lastErrorAt = new Date().toISOString();
      }
      osrmFailureStreak++;
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (osrmFailureStreak >= 10 && Date.now() - lastOsrmAlertAt > 30 * 60 * 1000) {
        lastOsrmAlertAt = Date.now();
        try {
          await db.createAlert('warning', 'Routing provider degraded: OSRM route fetches are failing repeatedly. Falling back to straight-line routing.');
        } catch {}
      }
    }
  })();

  osrmInFlight.set(cacheKey, p);
  try {
    return await p;
  } finally {
    osrmInFlight.delete(cacheKey);
  }
}

const busPathProgress = {}; // Store index progress of each bus

function roamAroundCurrentPosition(bus) {
  const jitterLat = (Math.random() - 0.5) * 0.01;
  const jitterLng = (Math.random() - 0.5) * 0.01;
  const fallbackSpeed = Math.max(15, Math.round(bus.speed || 35));
  const newBattery = Math.max(0, Number(bus.battery) - (0.05 + Math.random() * 0.04));
  return {
    gpsLat: Number(bus.gpsLat) + jitterLat,
    gpsLng: Number(bus.gpsLng) + jitterLng,
    battery: newBattery,
    status: bus.status,
    speed: fallbackSpeed,
  };
}

async function autoMarkArrivedDeliveriesForBus({ busId, gpsLat, gpsLng, destinationName }) {
  const dest = CITY_COORDS[destinationName];
  if (!dest) return;
  if (!Number.isFinite(Number(gpsLat)) || !Number.isFinite(Number(gpsLng))) return;

  const radiusMeters = Number(process.env.DELIVERY_GEOFENCE_METERS || 200);
  const dist = haversineMeters(Number(gpsLat), Number(gpsLng), Number(dest.lat), Number(dest.lng));
  if (dist > radiusMeters) return;

  const candidates = await db.listActiveDeliveriesByBus(busId);
  for (const d of candidates) {
    if (!d || d.arrived === true) continue;
    if (String(d.destination || '').toLowerCase() !== String(destinationName || '').toLowerCase()) continue;
    const before = d;
    const updated = await db.markDeliveryArrived(d.trackingCode, new Date().toISOString());
    if (!updated) continue;
    try {
      await db.createDeliveryAuditLog({
        trackingCode: updated.trackingCode,
        deliveryId: updated.id,
        actorId: null,
        actorRole: 'system',
        action: 'bus_arrived',
        fromStatus: before.status,
        toStatus: updated.status,
        fromReceived: before.received === true,
        toReceived: updated.received === true,
        ip: null,
      });
    } catch {}
    emitDeliveryUpdate(updated);
  }
}

// Use a slower interval for JSON file storage to avoid .tmp file accumulation.
// Postgres free tier (Render) has limited connections — use 5s to avoid exhausting the pool.
const SIM_INTERVAL_MS = process.env.SIM_INTERVAL_MS
  ? Math.max(500, Number(process.env.SIM_INTERVAL_MS))
  : (db.getDbMode() === 'postgres' ? 5000 : 4000);

async function startSimulation() {
  let stopped = false;
  const handle = setInterval(async () => {
    if (stopped) return;
    try {
      const buses = await db.getBuses();
      if (!buses || buses.length === 0) return; // nothing to simulate
      
      // Process bus positions sequentially to handle async awaits properly
      for (const bus of buses) {
        // Track the latest position/battery/speed so telemetry is never stale
        let telemetrySnapshot = {
          battery: bus.battery,
          speed: bus.speed,
          gpsLat: bus.gpsLat,
          gpsLng: bus.gpsLng,
          status: bus.status,
        };

        // 1. Charging Simulation
        if (bus.status === 'Charging') {
          const newBattery = Math.min(100, bus.battery + 2);
          await db.updateBusStatus(bus.id, 'Charging', newBattery);
          telemetrySnapshot.battery = newBattery;
          if (newBattery === 100) {
            await db.updateBusStatus(bus.id, 'Active');
            telemetrySnapshot.status = 'Active';
            await db.createAlert('ok', `${bus.tag} fully charged and ready for service.`);
          }
        } 
        // 2. En Route / Active / Delayed / Arrived Movement
        else if (bus.status === 'En Route' || bus.status === 'Active' || bus.status === 'Delayed' || bus.status === 'Arrived') {
          if (bus.status === 'Arrived') {
            const randomDestination = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
            await db.updateBus(bus.id, {
              status: 'Active',
              destination: randomDestination,
              speed: Math.max(30, Number(bus.speed) || 45),
            });
          }

          const currentBus = await db.getBusById(bus.id);
          if (!currentBus) continue;
          const dest = CITY_COORDS[currentBus.destination];
          if (!dest) {
            // Keep admin-defined routes visibly active even when destination is custom/unknown.
            const roamed = roamAroundCurrentPosition(currentBus);
            await db.updateBusPosition(bus.id, roamed);
            telemetrySnapshot = { ...telemetrySnapshot, ...roamed };
            continue;
          }

          if (!busPathProgress[currentBus.id]) {
              busPathProgress[currentBus.id] = { index: 0, path: [] };
          }

          let currentPath = busPathProgress[currentBus.id].path;
          
          if (currentPath.length === 0) {
              const fetched = await getOrFetchOSRMRoute(currentBus.gpsLat, currentBus.gpsLng, dest.lat, dest.lng);
              if (fetched) {
                  currentPath = fetched;
                  // Guard: entry may have been deleted by another tick
                  if (busPathProgress[currentBus.id]) {
                    busPathProgress[currentBus.id].path = currentPath;
                    busPathProgress[currentBus.id].index = 0;
                  }
              }
          }

          // If OSRM failed or no path, fallback to straight line
          if (!currentPath || currentPath.length === 0) {
              const step = 0.005;
              const noise = (Math.random() - 0.5) * 0.0005;
              const dLat = dest.lat - currentBus.gpsLat;
              const dLng = dest.lng - currentBus.gpsLng;
              const dist = Math.sqrt(dLat * dLat + dLng * dLng);

              if (dist < step) {
                const arrivedPos = { gpsLat: dest.lat, gpsLng: dest.lng, battery: Math.max(0, currentBus.battery - 1), status: 'Arrived', speed: 0 };
                await db.updateBusPosition(bus.id, arrivedPos);
                telemetrySnapshot = { ...telemetrySnapshot, ...arrivedPos };
                await autoMarkArrivedDeliveriesForBus({ busId: bus.id, gpsLat: dest.lat, gpsLng: dest.lng, destinationName: currentBus.destination });
                await db.createAlert('info', `${currentBus.tag} has arrived at destination: ${currentBus.destination}`);
                delete busPathProgress[currentBus.id];
              } else {
                const newLat = currentBus.gpsLat + (dLat / dist) * step + noise;
                const newLng = currentBus.gpsLng + (dLng / dist) * step + noise;
                const delayedFactor = currentBus.status === 'Delayed' ? 0.55 : 1;
                const speed = Math.max(0, (60 + Math.random() * 20) * delayedFactor * (currentBus.speed === 5 ? 0.1 : 1));
                const batteryDrain = 0.1 + (Math.random() * 0.05);
                const newBattery = Math.max(0, currentBus.battery - batteryDrain);
                const newPos = { gpsLat: newLat, gpsLng: newLng, battery: newBattery, status: currentBus.status, speed };

                await db.updateBusPosition(bus.id, newPos);
                telemetrySnapshot = { ...telemetrySnapshot, ...newPos };
                await autoMarkArrivedDeliveriesForBus({ busId: bus.id, gpsLat: newLat, gpsLng: newLng, destinationName: currentBus.destination });

                if (newBattery < 20 && currentBus.battery >= 20) {
                  await db.createAlert('warning', `${currentBus.tag} battery low (${newBattery.toFixed(0)}%). Maintenance required.`);
                }
              }
          } else {
              const progress = busPathProgress[currentBus.id];
              if (!progress) {
                busPathProgress[currentBus.id] = { index: 0, path: currentPath || [] };
              }
              const { index, path } = busPathProgress[currentBus.id];
              const speedFactorBase = Math.max(1, Math.floor(currentBus.speed / 20));
              const speedFactor = currentBus.status === 'Delayed' ? Math.max(1, Math.floor(speedFactorBase * 0.6)) : speedFactorBase;
              
              let nextIndex = index + speedFactor;
              
              if (nextIndex >= path.length) {
                  const lastPoint = path[path.length - 1];
                  const arrivedPos = { gpsLat: lastPoint[0], gpsLng: lastPoint[1], battery: Math.max(0, currentBus.battery - 1), status: 'Arrived', speed: 0 };
                  await db.updateBusPosition(bus.id, arrivedPos);
                  telemetrySnapshot = { ...telemetrySnapshot, ...arrivedPos };
                  await autoMarkArrivedDeliveriesForBus({ busId: bus.id, gpsLat: lastPoint[0], gpsLng: lastPoint[1], destinationName: currentBus.destination });
                  await db.createAlert('info', `${currentBus.tag} has arrived at destination: ${currentBus.destination}`);
                  delete busPathProgress[currentBus.id];
              } else {
                  const nextPoint = path[nextIndex];
                  const delayedFactor = currentBus.status === 'Delayed' ? 0.55 : 1;
                  const speed = Math.max(0, (60 + Math.random() * 20) * delayedFactor * (currentBus.speed === 5 ? 0.1 : 1));
                  const batteryDrain = 0.1 + (Math.random() * 0.05);
                  const newBattery = Math.max(0, currentBus.battery - batteryDrain);
                  const newPos = { gpsLat: nextPoint[0], gpsLng: nextPoint[1], battery: newBattery, status: currentBus.status, speed };

                  await db.updateBusPosition(bus.id, newPos);
                  telemetrySnapshot = { ...telemetrySnapshot, ...newPos };
                  await autoMarkArrivedDeliveriesForBus({ busId: bus.id, gpsLat: nextPoint[0], gpsLng: nextPoint[1], destinationName: currentBus.destination });
                  
                  if (busPathProgress[currentBus.id]) {
                    busPathProgress[currentBus.id].index = nextIndex;
                  } else {
                    busPathProgress[currentBus.id] = { index: nextIndex, path };
                  }

                  if (newBattery < 20 && currentBus.battery >= 20) {
                    await db.createAlert('warning', `${currentBus.tag} battery low (${newBattery.toFixed(0)}%). Maintenance required.`);
                  }
              }
          }
        }

        // Log and emit using the up-to-date snapshot, not the stale loop variable
        await db.logTelemetry(bus.id, {
          battery: telemetrySnapshot.battery,
          speed: telemetrySnapshot.speed,
          gpsLat: telemetrySnapshot.gpsLat,
          gpsLng: telemetrySnapshot.gpsLng,
        });

        io.emit('telemetry_update', {
          busId: bus.id,
          tag: bus.tag,
          status: telemetrySnapshot.status,
          battery: telemetrySnapshot.battery,
          speed: telemetrySnapshot.speed,
          gpsLat: telemetrySnapshot.gpsLat,
          gpsLng: telemetrySnapshot.gpsLng,
        });
      }

      const updatedBuses = await db.getBuses();
      io.emit('fleet_update', updatedBuses);
    } catch (err) {
      if (String(err?.message || '').includes('pool after calling end')) {
        stopped = true;
        return;
      }
      console.error('Simulation step error:', err);
    }
  }, SIM_INTERVAL_MS);
  return handle;
}

// Global start
async function bootstrap() {
    try {
        if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'replace-with-a-secure-secret') {
            throw new Error('JWT_SECRET must be set in production');
        }

        // Clean up leftover .tmp files from previous interrupted atomic writes
        if (db.getDbMode && db.getDbMode() !== 'postgres') {
            try {
                const dataDir = process.env.JSON_STORAGE_DIR
                    ? path.resolve(process.env.JSON_STORAGE_DIR)
                    : path.join(__dirname, '..', 'data');
                if (fs.existsSync(dataDir)) {
                    const tmpFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith('.tmp'));
                    for (const f of tmpFiles) {
                        try { fs.unlinkSync(path.join(dataDir, f)); } catch {}
                    }
                    if (tmpFiles.length > 0) {
                        console.log(`Cleaned up ${tmpFiles.length} stale .tmp file(s) from data directory.`);
                    }
                }
            } catch (cleanupErr) {
                console.warn('Non-fatal: .tmp cleanup failed:', cleanupErr.message);
            }
        }

        console.log('PostgreSQL: Initializing Operational Nexus...');
        await db.initDb();
        console.log(`DB mode: ${db.getDbMode()}`);
        console.log('PostgreSQL: Connection established and verified.');
        
        if (require.main === module) {
            setInterval(async () => {
                try {
                    await db.archivePastDepartures(new Date());
                } catch (err) {
                    console.error('Departure archive failed:', err);
                }
            }, 60000);

            console.log(`Simulation interval: ${SIM_INTERVAL_MS}ms`);
            const simHandle = startSimulation();
            server.listen(PORT, () => {
                console.log(`Backend server running on port ${PORT} (${useHttps ? 'https' : 'http'}) with Real-Time Nexus (Socket.io) active`);
            });

            const shutdown = async (signal) => {
                try {
                    console.log(`Received ${signal}. Shutting down...`);
                    // Stop simulation first so no more DB calls are made
                    clearInterval(await simHandle);
                    await new Promise((resolve) => server.close(resolve));
                    try { io.close(); } catch {}
                    await db.closePool();
                    process.exit(0);
                } catch (err) {
                    console.error('Graceful shutdown failed:', err);
                    process.exit(1);
                }
            };

            process.once('SIGTERM', () => shutdown('SIGTERM'));
            process.once('SIGINT', () => shutdown('SIGINT'));
        }
    } catch (error) {
        console.error('Bootstrap failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    bootstrap();
}

// Health check
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage ? process.memoryUsage() : null;
  res.json({
    status: 'OK',
    message: 'TRANSPO HUB API Running',
    uptimeSeconds: Number.isFinite(process.uptime?.()) ? Math.floor(process.uptime()) : null,
    memory: mem
      ? {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
        }
      : null,
    osrm: {
      cache: osrmCache.stats(),
      inFlight: osrmInFlight.size,
      fetchErrors: osrmFetchStats.fetchErrors,
      timeouts: osrmFetchStats.timeouts,
      lastErrorAt: osrmFetchStats.lastErrorAt,
      lastTimeoutAt: osrmFetchStats.lastTimeoutAt,
      failureStreak: osrmFailureStreak,
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found', requestId: req.requestId });
});

app.use((err, req, res, next) => {
  const requestId = req.requestId;
  if (err?.message === 'CORS blocked') {
    if (res.headersSent) return next(err);
    return res.status(403).json({ success: false, message: 'CORS blocked', requestId });
  }
  if (err?.type === 'entity.parse.failed') {
    if (res.headersSent) return next(err);
    return res.status(400).json({ success: false, message: 'Invalid JSON body', requestId });
  }
  const safeMessage = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err?.message || 'Internal server error');
  try {
    console.error(`[${requestId}]`, err);
  } catch {}
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, message: safeMessage, requestId });
});

module.exports = app;
