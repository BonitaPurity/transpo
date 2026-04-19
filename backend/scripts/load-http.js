const { performance } = require('perf_hooks');

async function http(method, url, { headers, body } = {}) {
  const res = await fetch(url, {
    method,
    headers,
    body,
  });
  const ct = res.headers.get('content-type') || '';
  const buf = await res.arrayBuffer();
  return { status: res.status, contentType: ct, bytes: buf.byteLength };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function runLoad(name, fn, { concurrency, iterations }) {
  const times = [];
  const failures = [];
  let inFlight = 0;
  let started = 0;

  return new Promise((resolve) => {
    const launchNext = async () => {
      if (started >= iterations) {
        if (inFlight === 0) {
          const sorted = [...times].sort((a, b) => a - b);
          resolve({
            name,
            iterations,
            ok: iterations - failures.length,
            failed: failures.length,
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            max: sorted.length ? sorted[sorted.length - 1] : 0,
            failures,
          });
        }
        return;
      }
      started += 1;
      inFlight += 1;
      const t0 = performance.now();
      try {
        const r = await fn();
        const t1 = performance.now();
        times.push(t1 - t0);
        if (!r || r.status < 200 || r.status >= 400) {
          failures.push({ status: r?.status ?? 0, contentType: r?.contentType ?? '' });
        }
      } catch (e) {
        const t1 = performance.now();
        times.push(t1 - t0);
        failures.push({ status: 0, contentType: '', error: e instanceof Error ? e.message : String(e) });
      } finally {
        inFlight -= 1;
        if (started < iterations) {
          launchNext();
        } else if (inFlight === 0) {
          const sorted = [...times].sort((a, b) => a - b);
          resolve({
            name,
            iterations,
            ok: iterations - failures.length,
            failed: failures.length,
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            max: sorted.length ? sorted[sorted.length - 1] : 0,
            failures,
          });
        }
      }
    };

    while (inFlight < concurrency && started < iterations) {
      launchNext();
    }
  });
}

(async () => {
  const api = process.env.API_BASE || 'http://localhost:5000/api';
  const adminEmail = process.env.ADMIN_EMAIL || 'staging.admin@transpo.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

  const loginRes = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const loginText = await loginRes.text();
  let loginJson = null;
  try {
    loginJson = JSON.parse(loginText);
  } catch {}
  if (loginRes.status !== 200 || !loginJson?.success) {
    console.error('Admin login failed', { status: loginRes.status, body: loginJson || loginText });
    process.exit(1);
  }
  const token = loginJson?.data?.token;
  if (!token) {
    console.error('Admin token missing');
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  const results = [];
  results.push(await runLoad('GET /api/health', () => http('GET', `${api}/health`), { concurrency: 30, iterations: 300 }));
  results.push(await runLoad('GET /api/metrics/detailed (admin)', () => http('GET', `${api}/metrics/detailed`, { headers: auth }), { concurrency: 20, iterations: 120 }));
  results.push(await runLoad('GET /api/admin/deliveries (admin)', () => http('GET', `${api}/admin/deliveries`, { headers: auth }), { concurrency: 20, iterations: 120 }));
  results.push(await runLoad('GET /api/admin/manifest/export?format=pdf (admin)', () => http('GET', `${api}/admin/manifest/export?format=pdf`, { headers: auth }), { concurrency: 5, iterations: 15 }));

  console.log('\nLOAD RESULTS (ms)');
  for (const r of results) {
    console.log(`${r.name}: ok=${r.ok}/${r.iterations} failed=${r.failed} p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} max=${r.max.toFixed(1)}`);
    if (r.failed) {
      console.log(`  failures sample: ${JSON.stringify(r.failures.slice(0, 3))}`);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
