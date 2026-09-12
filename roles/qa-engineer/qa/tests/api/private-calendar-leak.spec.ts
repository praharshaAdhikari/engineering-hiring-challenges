import { test, expect } from '@playwright/test';

// BUG (privacy): the public calendar leaks the member's name AND the purpose of every
// PRIVATE booking. It masks only the `title` field, but still returns the real name in
// `bookedBy` and the real purpose in `purpose`.
//
// SPEC §4: for a `private` booking the public calendar may reveal only "Private event",
// the space, the date and time — "Nothing identifying the member, and not the purpose
// either — not their name, not their email, not their member id, in any field of the
// response."
//
// (BUG-004 also covers a second calendar defect — cancelled/rejected/pending bookings
// appearing at all — which is verified by hand; this test asserts the higher-consequence
// privacy half.)
//
// This asserts the correct behaviour, so it FAILS against v2.3.1. `test.fail(...)` makes the
// suite green while the bug exists and flips it red the moment it is fixed. Run
// `npm run test:red` to watch it fail live.
const KNOWN_BUG = process.env.PROVE_BUGS !== '1';

test('a private booking leaks nothing identifying the member or the purpose (SPEC §4)', async ({ request }) => {
  test.fail(KNOWN_BUG, 'v2.3.1 returns bookedBy and purpose on private events');

  const res = await request.get('/api/calendar?from=2026-01-01&to=2026-12-31');
  expect(res.ok()).toBeTruthy();
  const { events } = await res.json();

  const privateEvents = events.filter((e: any) => e.visibility === 'private');
  expect(privateEvents.length, 'the seed data contains private events to check').toBeGreaterThan(0);

  for (const e of privateEvents) {
    expect(JSON.stringify(e), `${e.reference} exposes an email address`).not.toContain('@');
    expect(e.bookedBy ?? '', `${e.reference} exposes the member name`).toBe('');
    expect(e.purpose ?? '', `${e.reference} exposes the purpose`).toBe('');
  }
});
