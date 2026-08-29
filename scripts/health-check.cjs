const API = 'http://localhost:3000/api/v1';

async function main() {
  const l = await (
    await fetch(`${API}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'isafeadmin', password: 'prof_uchendu@!safedr!ve?' }),
    })
  ).json();
  if (!l.accessToken) {
    console.log('LOGIN FAILED', JSON.stringify(l));
    process.exit(1);
  }
  const h = { Authorization: `Bearer ${l.accessToken}` };

  const reads = [
    '/admin/dashboard',
    '/admin/search?q=a',
    '/admin/customers',
    '/admin/drivers',
    '/admin/vehicles',
    '/admin/rides?status=active',
    '/admin/payments',
    '/admin/wallets',
    '/admin/transactions',
    '/admin/withdrawals',
    '/admin/promotions',
    '/admin/ratings',
    '/admin/safety',
    '/admin/support',
    '/admin/audit-logs',
    '/admin/admins',
    '/admin/pricing',
    '/admin/live/drivers',
    '/admin/fraud/alerts',
    '/admin/corporate',
    '/admin/fleets',
    '/deliveries',
    '/cities',
    '/admin/zones',
    '/admin/reports/trips.csv',
    '/admin/reports/payments.csv',
  ];

  let fails = 0;
  for (const ep of reads) {
    const r = await fetch(`${API}${ep}`, { headers: h }).catch((e) => ({ ok: false, status: 0, json: () => ({ message: e.message }) }));
    let body = '';
    try {
      const text = await r.text();
      try {
        const j = JSON.parse(text);
        body = Array.isArray(j) ? `${j.length} items` : text.slice(0, 70);
      } catch {
        body = `${text.split('\n').length} csv lines`;
      }
    } catch {}
    const ok = r.ok;
    if (!ok) fails++;
    console.log(`${ok ? 'OK ' : 'ERR'} ${r.status ?? '?'} ${ep} ${body}`);
  }

  const writes = [
    ['broadcast', '/admin/notifications/broadcast', { title: 'Health check', message: 'Module check' }],
  ];
  for (const [name, ep, body] of writes) {
    const r = await fetch(`${API}${ep}`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ok = r.ok;
    if (!ok) fails++;
    console.log(`${ok ? 'OK ' : 'ERR'} ${r.status} POST ${name}`);
  }

  console.log(fails === 0 ? `\nALL ${reads.length + writes.length} MODULE ENDPOINTS HEALTHY` : `\n${fails} ENDPOINTS FAILING`);
  process.exit(fails === 0 ? 0 : 1);
}

main();
