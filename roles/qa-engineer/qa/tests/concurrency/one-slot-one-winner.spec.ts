import { test, expect } from '@playwright/test';
import { login, auth, bookingBody, uniqueFutureDate } from '../helpers';

// BUG (the most important one in the app): two members requesting the same slot at the
// same moment BOTH succeed. There is no transaction, lock or unique constraint around the
// "is the slot free?" check and the insert that follows, so simultaneous requests all pass
// the check before any of them writes. The probe fires 10 at once and gets 10 × 201.
//
// SPEC §5: "Two members requesting the same slot at the same moment must not both succeed.
// Exactly one gets it. This is the single most important rule in this document."
//
// Impact in the client's language: if two families submit a request for the same hall at
// the same second, the system accepts both and they arrive on the day to the same room.
const KNOWN_BUG = process.env.PROVE_BUGS !== '1';

test('exactly one of many simultaneous requests for one slot succeeds (SPEC §5)', async ({ request }) => {
  test.fail(KNOWN_BUG, 'v2.3.1 has no concurrency control — all simultaneous requests are accepted');

  // Two different members, alternating — genuinely "two people at once", not one member
  // double-submitting (a related but separate race).
  const [tokenA, tokenB] = await Promise.all([login(request, 'member'), login(request, 'other')]);

  // One slot, claimed by everyone at once. A fresh date so re-runs never collide.
  const slot = bookingBody({
    spaceSlug: 'library',
    eventDate: uniqueFutureDate(),
    startTime: '10:00',
    endTime: '12:00',
    purpose: 'Concurrency test',
  });

  const N = 10;
  const fire = (token: string) => request.post('/api/bookings', { ...auth(token), data: slot });

  // Build all the promises first, then await them together, so they hit the server in the
  // same tick rather than one-after-another.
  const responses = await Promise.all(
    Array.from({ length: N }, (_, i) => fire(i % 2 === 0 ? tokenA : tokenB)),
  );

  const created = responses.filter((r) => r.status() === 201);
  const conflicts = responses.filter((r) => r.status() === 409);

  expect(
    created.length,
    `expected exactly one 201; got ${created.length} (and ${conflicts.length} × 409). ` +
      'Every extra 201 is a double-booked room.',
  ).toBe(1);
  expect(conflicts.length, 'every other request should be refused with 409').toBe(N - 1);
});
