import { test, expect } from '@playwright/test';
import { login } from '../helpers';

// BUG (the worst one): session tokens are unsigned base64 of `id:email:role`, and the staff
// check trusts the `role` inside the token without verifying it against the database or any
// signature. A token can be hand-written — no account, no login — and it is accepted on the
// staff routes. A real member can also escalate by re-encoding their own token with
// role=staff.
//
// SPEC §2: "Staff routes are reachable only by a staff account."
//
// This asserts the correct behaviour, so it FAILS against v2.3.1. `npm run test:red` shows
// it red; `npm test` marks it expected-fail so CI stays green until the bug is fixed.
const KNOWN_BUG = process.env.PROVE_BUGS !== '1';

// base64("<id>:<email>:<role>") — the exact shape src/auth.js issues and reads.
const token = (id: string, email: string, role: string) =>
  Buffer.from(`${id}:${email}:${role}`).toString('base64');

test('staff routes reject forged and self-escalated tokens (SPEC §2)', async ({ request }) => {
  test.fail(KNOWN_BUG, 'v2.3.1 trusts role=staff in an unsigned token');

  const call = (t: string) =>
    request.get('/api/staff/bookings?pageSize=2', { headers: { authorization: `Bearer ${t}` } });

  // 1) A staff token hand-built from no account at all.
  const forged = token('00000000-0000-0000-0000-000000000000', 'attacker@evil.example', 'staff');
  expect((await call(forged)).status(), 'a token not issued by the server must not reach staff routes').toBe(403);

  // 2) A real member re-encoding their own token with the role flipped to staff.
  const real = await login(request, 'member');
  const [id, email] = Buffer.from(real, 'base64').toString('utf8').split(':');
  const escalated = token(id, email, 'staff');
  expect((await call(escalated)).status(), 'a member must not become staff by editing their token').toBe(403);
});
