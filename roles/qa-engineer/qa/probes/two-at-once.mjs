// two-at-once.mjs — concurrency probe for SPEC §5.
//
// SPEC §5: "Two members requesting the same slot at the same moment must not both
// succeed. Exactly one gets it. This is the single most important rule in this document."
//
// This is not a test with a pass/fail assertion — it is an experiment. It fires N booking
// requests for the *same space, date and time* as close to simultaneously as one Node
// process can, then reports how many the server accepted. The right answer is exactly one
// 201; every extra 201 is a double-booking — two families given the same room.
//
// Run against a freshly reset app:
//   cd ../../app && npm run reset && npm start      # in one terminal
//   node two-at-once.mjs                             # in another
//
// No dependencies. Node 24.

const BASE = process.env.BASE_URL ?? 'http://localhost:4000';
const N = Number(process.env.N ?? 10);

// A far-future date on a bookable space, well clear of the seed data (last seeded
// booking is 2026-11-10) and of any blackout. Change it between runs, or npm run reset,
// because once one request wins the slot is taken for good.
const SLOT = {
  spaceSlug: 'library',
  eventDate: process.env.DATE ?? '2027-03-15',
  startTime: '10:00',
  endTime: '12:00',
  attendees: 5,
  purpose: 'Concurrency probe',
};

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return (await res.json()).token;
}

function requestSlot(token) {
  return fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(SLOT),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}

// Two different members, alternating, so this is genuinely "two people at once" and not
// one member sending a request twice (which is a related but separate race).
const [memberA, memberB] = await Promise.all([
  login('member@himalayacc.example', 'member12345'),
  login('other@himalayacc.example', 'other12345'),
]);
const tokens = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? memberA : memberB));

// Kick every request off in the same tick, then wait for all of them together.
const results = await Promise.all(tokens.map(requestSlot));

const created = results.filter((r) => r.status === 201);
const conflicts = results.filter((r) => r.status === 409);
const other = results.filter((r) => r.status !== 201 && r.status !== 409);

console.log(`\nFired ${N} simultaneous requests for ${SLOT.spaceSlug} on ${SLOT.eventDate} ${SLOT.startTime}-${SLOT.endTime}\n`);
console.log(`  201 Created : ${created.length}`);
console.log(`  409 Conflict: ${conflicts.length}`);
if (other.length) console.log(`  other       : ${other.length} (${[...new Set(other.map((r) => r.status))].join(', ')})`);

if (created.length) {
  console.log(`\n  references created: ${created.map((r) => r.body?.reference).join(', ')}`);
}

console.log(
  created.length === 1
    ? '\n✅ Exactly one succeeded — SPEC §5 holds for this run.\n'
    : `\n❌ ${created.length} requests succeeded for the same slot. SPEC §5 requires exactly one.` +
        ' The office has double-booked the room.\n',
);

// Exit non-zero when the invariant is violated, so CI or a wrapper can catch it.
process.exit(created.length === 1 ? 0 : 1);
