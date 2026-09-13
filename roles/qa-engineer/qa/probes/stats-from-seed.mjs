// stats-from-seed.mjs — derive the office figures independently, for BUG-005.
//
// SPEC §6.4: hours booked and hire fees count `confirmed` and `completed` bookings only;
// deposits held counts bookings whose deposit is held (everything except cancelled/rejected).
//
// This computes those three numbers straight from src/seed/bookings.csv, using the rates and
// deposits from SPEC §3 hard-coded below — it does NOT import anything from the app, so it
// cannot reproduce the app's bug. That independence is the whole point: it is the source of
// truth the app is checked against. If the app is running it also fetches /api/staff/stats
// and prints the two side by side.
//
// Run:  node probes/stats-from-seed.mjs        (from qa/)
// or:   npm run probe:stats

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CSV = join(here, '..', '..', 'app', 'src', 'seed', 'bookings.csv');

// SPEC §3 — capacity omitted, we only need rate and deposit here.
const RATE = { 'main-hall': 182.5, courtyard: 91.3, kitchen: 62.75, 'classroom-a': 47.35, library: 32.1, 'classroom-b': 45.0 };
const DEPOSIT = { 'main-hall': 500, courtyard: 250, kitchen: 150, 'classroom-a': 100, library: 50, 'classroom-b': 100 };

// A minimal RFC 4180 parser: needed because the seed contains fields with embedded commas
// and doubled quotes (e.g. `Shrestha, Bijay "BJ"`), which a naive split(',') would misalign.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function hours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh + em / 60 - (sh + sm / 60);
}

const round2 = (n) => Math.round(n * 100) / 100;
const money = (n) => `$${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const rows = parseCsv(readFileSync(CSV, 'utf8'));

const earning = rows.filter((r) => r.status === 'confirmed' || r.status === 'completed');
const held = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'rejected');

const expected = {
  hoursBooked: round2(earning.reduce((s, r) => s + hours(r.start_time, r.end_time), 0)),
  hireFees: round2(earning.reduce((s, r) => s + hours(r.start_time, r.end_time) * RATE[r.space_slug], 0)),
  depositsHeld: round2(held.reduce((s, r) => s + DEPOSIT[r.space_slug], 0)),
};

console.log(`\nDerived from ${rows.length} seed rows (SPEC §6.4, confirmed + completed only):\n`);
console.log(`  hours booked  : ${expected.hoursBooked}`);
console.log(`  hire fees     : ${money(expected.hireFees)}`);
console.log(`  deposits held : ${money(expected.depositsHeld)}`);
console.log(`\n  (app/README.md publishes 200.5 / $21,312.90 / $16,400.00 as the source of truth.)`);

// If the app is up, fetch its numbers and compare — this is the BUG-005 evidence.
const BASE = process.env.BASE_URL ?? 'http://localhost:4000';
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'staff@himalayacc.example', password: 'staff12345' }),
    signal: AbortSignal.timeout(1500),
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const token = (await login.json()).token;
  const stats = await (await fetch(`${BASE}/api/staff/stats`, { headers: { authorization: `Bearer ${token}` } })).json();

  console.log(`\nApp reports (GET /api/staff/stats):\n`);
  const line = (label, got, want) =>
    console.log(`  ${label.padEnd(14)}: ${String(got).padEnd(12)} ${got === want ? 'matches' : `WRONG — expected ${want}`}`);
  line('hoursBooked', round2(stats.hoursBooked), expected.hoursBooked);
  line('hireFees', round2(stats.hireFees), expected.hireFees);
  line('depositsHeld', round2(stats.depositsHeld), expected.depositsHeld);

  const wrong = round2(stats.hoursBooked) !== expected.hoursBooked || round2(stats.hireFees) !== expected.hireFees;
  console.log(
    wrong
      ? '\n❌ The app disagrees with the seed — BUG-005 (stats count every status, not just confirmed/completed).\n'
      : '\n✅ The app matches the seed.\n',
  );
} catch {
  console.log(`\n(App not reachable at ${BASE} — showing the derived figures only. Start it with \`npm run app:start\` to compare.)\n`);
}
