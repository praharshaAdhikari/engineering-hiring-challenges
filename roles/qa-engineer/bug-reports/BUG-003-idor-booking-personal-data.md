# BUG-003 — Any signed-in member can read every other member's booking and home address via `/api/bookings/:reference`

| | |
|---|---|
| **Severity** | Critical |
| **Priority** | P1 |
| **Area** | API / Data |
| **Found** | API testing |
| **Spec reference** | `SPEC.md` §2 |
| **Status** | Open |

## Summary

`GET /api/bookings/:reference` looks a booking up by reference and returns it with the
owner's full personal record — name, email, phone and home address — with no check that the
booking belongs to the caller. Any member can read any other member's booking, and their
address, by changing the reference in the URL. References are sequential (`HCC-BK-####`), so
the whole membership can be walked in seconds.

## Environment

- Build: Sabhaghar Booking 2.3.1 (`GET /api/health`)
- Running via: `npm run app:start` on port 4000
- Data state: fresh `npm run reset`
- Account used: `member@himalayacc.example` / `member12345` (owns none of the seeded bookings)

## Steps to reproduce

1. Reset and start the app.
2. Sign in as `member@himalayacc.example` and take the bearer token from the login response.
3. Request a booking that belongs to a different member — `HCC-BK-4271` (owner: Shrestha,
   Bijay "BJ"):

```bash
curl -s localhost:4000/api/bookings/HCC-BK-4271 \
  -H "authorization: Bearer <member-token>"
```

## Expected result

> `SPEC.md` §2: "A member must never be able to read another member's booking or personal
> details."

So: `404 {"error":"No such booking"}` (the same response as a reference that does not exist,
so the endpoint does not even confirm the booking is real).

## Actual result

`200 OK`, with the other member's full record:

```json
{
  "reference": "HCC-BK-4271",
  "purpose": "Board meeting, quarterly",
  "member": {
    "name": "Shrestha, Bijay \"BJ\"",
    "email": "bj.shrestha@example.com",
    "phone": "+977 9801 234567",
    "address": "9 Harwood Rd, Euless, TX 76040"
  }
}
```

## Impact

Any member with an account — which is anyone who has ever booked a room — can read every
other member's name, email, phone number and home address, and the purpose of events others
marked private, by changing a reference in a URL. References run in sequence, so the entire
membership list can be walked in a few seconds. That includes the bookings whose owners
chose "private" and were told their event would not be identified. For a community centre
whose members include people who are careful about who knows where they live, this is among
the most serious failures possible, and it would be a reportable data breach in several of
the jurisdictions its members live in.

## Evidence

- `evidence/BUG-003-idor-another-members-booking.json` — the full `200` response
- Reproduced as an assertion: `qa/tests/api/member-cannot-read-another-booking.spec.ts`

## Regression test

- `qa/tests/api/member-cannot-read-another-booking.spec.ts` → *"a member cannot read another
  member's booking (SPEC §2)"*
- Fails against 2.3.1 (`npm run test:red`). Passes once the ownership check is applied.

## Acceptance criteria for the fix

- A member requesting another member's booking reference receives `404`, not the record.
- The same request with their own reference still returns it.
- Staff can still read any booking (via the staff routes), once BUG-001 is fixed.
- `qa/tests/api/member-cannot-read-another-booking.spec.ts` goes green without being edited.

## Notes and suggested area

`src/routes/public.js` `GET /bookings/:reference`: the query selects the booking and joins
the member with no `WHERE b.member_id = <caller>` condition, and the route is behind
`requireAuth` (any member) rather than an ownership check. Note the payload also exposes the
member `address`, which no other endpoint returns — even the correct owner arguably does not
need their own address echoed here, but the defect is that anyone gets it.
