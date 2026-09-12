# BUG-002 — Two members can book the same room at the same time; simultaneous requests all succeed

| | |
|---|---|
| **Severity** | Critical |
| **Priority** | P1 |
| **Area** | Booking request / API |
| **Found** | Concurrency |
| **Spec reference** | `SPEC.md` §5 |
| **Status** | Open |

## Summary

`POST /api/bookings` checks whether the slot is free and then inserts the booking, with no
transaction, lock or unique constraint between the two. When several requests for the same
slot arrive together, they all pass the "is it free?" check before any of them writes, so
they all succeed. Ten simultaneous requests for one slot produced ten confirmed bookings.

## Environment

- Build: Sabhaghar Booking 2.3.1 (`GET /api/health`)
- Running via: `npm run app:start` on port 4000
- Data state: fresh `npm run reset`
- Accounts used: `member@himalayacc.example` and `other@himalayacc.example` (two different members)

## Steps to reproduce

1. Reset and start the app.
2. From `qa/`, fire ten simultaneous requests for one empty slot:

```bash
DATE=2027-05-20 N=10 node qa/probes/two-at-once.mjs
```

The probe logs in as two different members, then sends ten `POST /api/bookings` for
`library` on `2027-05-20` `10:00–12:00` in the same tick (`Promise.all`). It is also encoded
as an assertion in `qa/tests/concurrency/one-slot-one-winner.spec.ts`.

## Expected result

> `SPEC.md` §5: "Two members requesting the same slot at the same moment must not both
> succeed. Exactly one gets it. This is the single most important rule in this document."

So: exactly **one** `201`, and the other nine `409 That time is already taken`.

## Actual result

All ten succeeded:

```
Fired 10 simultaneous requests for library on 2027-05-20 10:00-12:00
  201 Created : 10
  409 Conflict: 0
  references created: HCC-BK-4285, HCC-BK-4286, HCC-BK-4287, HCC-BK-4288, HCC-BK-4289,
                      HCC-BK-4290, HCC-BK-4291, HCC-BK-4292, HCC-BK-4293, HCC-BK-4294
```

It is not a narrow timing window: it reproduces every run, because the handler `await`s a
25 ms pricing step between the check and the insert, so every request has passed the check
before the first insert lands.

## Impact

Two families can be given the same hall on the same afternoon, and both are told they have
it. With wedding season starting the week after go-live, this is the failure that turns into
two wedding parties arriving at one courtyard. It also does not need bad intent — two people
submitting at the same busy moment is enough, and a member double-tapping "Send request"
can double-book against themselves. The office has no way to see it happened until the day.
`SPEC.md` calls this its single most important rule; the app does not enforce it at all.

## Evidence

- `evidence/BUG-002-concurrency-probe-output.txt` — the 10×201 run
- Reproduced as an assertion: `qa/tests/concurrency/one-slot-one-winner.spec.ts`

## Regression test

- `qa/tests/concurrency/one-slot-one-winner.spec.ts` → *"exactly one of many simultaneous
  requests for one slot succeeds (SPEC §5)"*
- Fails against 2.3.1 (`npm run test:red`). Passes once one-winner is enforced.

## Acceptance criteria for the fix

- Of N simultaneous requests for the same space/date/overlapping time, exactly one returns
  `201`; the rest return `409`.
- The same guarantee holds for a member submitting the identical request twice in quick
  succession.
- Non-overlapping and merely-touching bookings (e.g. `10:00–12:00` and `12:00–14:00`) are
  still both allowed (see BUG-006 note — touching is separately broken).
- `qa/tests/concurrency/one-slot-one-winner.spec.ts` goes green without being edited.

## Notes and suggested area

`src/routes/public.js` `POST /bookings`: the conflict `SELECT` and the `INSERT` are separate
statements with an `await confirmQuote(...)` between them and no surrounding transaction. A
unique constraint or an atomic conditional insert on `(space_id, event_date, overlapping
time)`, or serialising the check-and-insert in one transaction, would enforce §5.
