import { test, expect } from '@playwright/test';
import { login, auth, bookingBody } from '../helpers';

// BUG (privacy / IDOR): any signed-in member can read any booking by reference, including
// the booking owner's name, email, phone and HOME ADDRESS. GET /api/bookings/:reference
// has no ownership check at all.
//
// SPEC §2: "A member must never be able to read another member's booking or personal
// details."
//
// Impact in the client's language: any member who signs in can read every other member's
// home address by changing a reference in the URL.
const KNOWN_BUG = process.env.PROVE_BUGS !== '1';

test('a member cannot read another member\'s booking (SPEC §2)', async ({ request }) => {
  test.fail(KNOWN_BUG, 'v2.3.1 returns the full booking, including the owner\'s home address');

  // "Other Member" creates a booking that belongs to them.
  const otherToken = await login(request, 'other');
  const created = await request.post('/api/bookings', {
    ...auth(otherToken),
    data: bookingBody({ purpose: 'Private planning meeting' }),
  });
  expect(created.status()).toBe(201);
  const reference = (await created.json()).reference;

  // "Test Member" — a different account — tries to read it.
  const memberToken = await login(request, 'member');
  const res = await request.get(`/api/bookings/${reference}`, auth(memberToken));

  // They must be refused. The exact code is the app's choice (403 or 404); the point is
  // that no other member's personal data comes back.
  expect(res.status(), 'reading another member\'s booking must be refused').not.toBe(200);

  if (res.status() === 200) {
    const body = await res.json();
    expect(body.member?.address, 'another member\'s home address must never be exposed').toBeUndefined();
  }
});
