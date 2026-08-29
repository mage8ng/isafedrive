const pages = [
  '/login',
  '/',
  '/live-map',
  '/trips',
  '/customers',
  '/drivers',
  '/vehicles',
  '/deliveries',
  '/cities',
  '/corporate',
  '/fleets',
  '/payments',
  '/wallets',
  '/payouts',
  '/promotions',
  '/ratings',
  '/notifications',
  '/support',
  '/safety',
  '/fraud',
  '/audit-logs',
  '/admins',
  '/security',
  '/pricing',
  '/reports',
];

async function main() {
  let fails = 0;
  for (const p of pages) {
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        const r = await fetch(`http://localhost:3100${p}`);
        ok = r.ok;
        if (!ok && attempt === 1) {
          fails++;
          console.log(`ERR ${r.status} ${p}`);
        }
      } catch (e) {
        if (attempt === 1) {
          fails++;
          console.log(`ERR ??? ${p} ${e.message}`);
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    if (ok) console.log(`OK 200 ${p}`);
  }
  console.log(fails === 0 ? `\nAll ${pages.length} pages OK` : `\n${fails} pages failing`);
  process.exit(fails === 0 ? 0 : 1);
}

main();
