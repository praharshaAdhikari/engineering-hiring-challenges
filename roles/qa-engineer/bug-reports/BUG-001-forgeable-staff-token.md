# BUG-001 — Anyone can forge a staff token and read or change every booking, with no account and no password

| | |
|---|---|
| **Severity** | Critical |
| **Priority** | P1 |
| **Area** | Auth |
| **Found** | API testing / Code reading |
| **Spec reference** | `SPEC.md` §2 |
| **Status** | Open |

## Summary

Session tokens are unsigned base64 of `id:email:role`, and the staff check trusts the
`role` inside the token without verifying it against anything. Anyone can hand-write a token
that says `staff` — no account, no password, no login — and call every staff endpoint:
read all bookings and members' personal data, approve or reject requests, export the CSV,
read the audit log. This is a complete authentication bypass.

## Environment

- Build: Sabhaghar Booking 2.3.1 (`GET /api/health`)
- Running via: `npm run app:start` (or `npm start`) on port 4000
- Data state: fresh `npm run reset`
- Account used: **none** — that is the point

## Steps to reproduce

1. Reset and start the app from a known state.
2. Build a token by hand. A token is `base64("<id>:<email>:<role>")` — nothing more. Use a
   made-up id and email and set the role to `staff`:

```bash
FAKE=$(python3 -c "import base64;print(base64.b64encode(b'00000000-0000-0000-0000-000000000000:attacker@evil.example:staff').decode())")
echo "$FAKE"
# MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwOmF0dGFja2VyQGV2aWwuZXhhbXBsZTpzdGFmZg==
```

3. Call a staff-only endpoint with it:

```bash
curl -s -i "localhost:4000/api/staff/bookings?pageSize=2" \
  -H "authorization: Bearer $FAKE"
```

A signed-in member can also escalate their own access: decode their real token, change
`member` to `staff`, re-encode, and use it. Both paths work.

## Expected result

> `SPEC.md` §2: "Staff routes are reachable only by a staff account."

So: `403 {"error":"Staff only"}` — a token that was not issued by the server to a real
staff account must be rejected.

## Actual result

`200 OK`, with the full bookings list including every member's name, email and phone:

```json
{
  "page": 1, "pageSize": 2, "total": 84,
  "bookings": [
    {
      "reference": "HCC-BK-4283",
      "member": { "name": "Sarita Bhattarai", "email": "sarita.b@example.com", "phone": "+977 …" },
      "status": "confirmed", "deposit": { "amount": 250, "status": "held" }
      // …
    }
  ]
}
```

The same forged token also returns `200` on `/api/staff/stats`, `/api/staff/audit`,
`/api/staff/bookings.csv`, and succeeds on `POST /api/staff/bookings/:reference/approve`
and `/reject`.

## Impact

Anyone on the internet who can reach this server — with no account, no password and nothing
stolen — can become the front office. They can read every member's name, email, phone and
(via BUG-004) home address, approve or reject any booking, and alter the record the centre
relies on. There is no audit trail that would catch it, because the forged actor is not a
real account. For a system going live in a week, this is the single most serious defect in
it: it is not "a member can see too much", it is "there is effectively no login at all on
the office side." It would be a reportable data breach the moment it were exploited.

## Evidence

- `evidence/BUG-001-staff-bookings-via-forged-token.json` — the `200` response to the forged request

## Regression test

- `qa/tests/api/forged-token-rejected.spec.ts` → *"a hand-built staff token from no account
  is rejected"* and *"a member cannot escalate by re-encoding their own token as staff"*
- Both fail against 2.3.1 (`npm run test:red`). Pass once tokens are signed and role is read
  from the looked-up account.

## Acceptance criteria for the fix

- A token not issued by the server (bad or missing signature) is rejected on every
  authenticated route with `401`.
- Staff authorisation is decided by the account the token resolves to in the database, not
  by a `role` string carried in the token.
- A valid member cannot reach any `/api/staff/*` route by editing their own token.
- A real staff login still works end to end.

## Notes and suggested area

`src/auth.js`: `issueToken`/`readToken` base64-encode and decode `id:email:role` with no
signature, so the token is both readable and forgeable. `requireStaff` calls `readToken` and
checks `claims.role === 'staff'` without looking the member up in the database — so a
non-existent id with `role=staff` passes. (By contrast `requireAuth`/`currentUser` do a DB
lookup, which is why forged tokens fail on member routes but succeed on staff routes.) A
signed token (e.g. HMAC/JWT) plus deciding role from the looked-up account would close both
halves.
