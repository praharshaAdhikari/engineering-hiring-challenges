# BUG-005 — Office statistics count every booking regardless of status, so hours and hire fees are overstated

| | |
|---|---|
| **Severity** | High |
| **Priority** | P2 |
| **Area** | Staff console / Data |
| **Found** | API testing / Arithmetic |
| **Spec reference** | `SPEC.md` §6.4 |
| **Status** | Open |

## Summary

`GET /api/staff/stats` sums hours and hire fees across **all** bookings — including pending,
cancelled and rejected — instead of `confirmed` and `completed` only. On the seeded
database it reports 270.5 hours and $26,175.35 where the correct figures are 200.5 hours and
$21,312.90. These are the numbers the office reports to its board.

## Environment

- Build: Sabhaghar Booking 2.3.1 (`GET /api/health`)
- Running via: `npm run app:start` on port 4000
- Data state: fresh `npm run reset` (nothing else touched — this asserts on seeded totals)
- Account used: `staff@himalayacc.example` / `staff12345`

## Steps to reproduce

1. Reset and start the app (the figures below are the clean seeded state).
2. Read the stats:

```bash
curl -s localhost:4000/api/staff/stats -H "authorization: Bearer <staff-token>"
```

3. Cross-check against the seed. Running `npm run probe:stats` (from `qa/`) derives the
   correct figures straight from `src/seed/bookings.csv` — **200.5 hours** and **$21,312.90**
   for `confirmed` + `completed` (rate × hours per `SPEC.md` §6.4) — and, if the app is up,
   prints them next to what it reports. The probe hard-codes the §3 rates and does its own
   arithmetic; it imports nothing from the app, so it cannot reproduce the app's bug. (You can
   confirm the same total by hand from the CSV; the script just makes it reproducible.)

## Expected result

> `SPEC.md` §6.4: hours booked and hire fees are for bookings that are "confirmed or
> completed only. Cancelled, rejected and pending bookings contribute nothing."

So: `hoursBooked: 200.5`, `hireFees: 21312.90`.

## Actual result

```json
{
  "hoursBooked": 270.5,
  "hireFees": 26175.35,
  "pendingRequests": 8,
  "depositsHeld": 16400,
  "utilisation": 23.00170068027211
}
```

270.5 hours and $26,175.35 — the totals for **every** status, so pending, cancelled and
rejected bookings are inflating both figures. (`depositsHeld: 16400` is correct.)

## Impact

Every hours-booked and hire-fee number the office reads is wrong, and wrong in the direction
that overstates activity and money owed. These are the figures the office reports to its
board and uses to understand how the building is being used; they cannot be trusted, and the
error is invisible unless someone recomputes it from the raw data. A cancelled booking still
counts toward income that will never be collected. It is not a breach, so it is a step below
the security defects in urgency (P2), but it directly undermines "the office cannot trust the
numbers it reports" — one of the failures the brief names explicitly.

## Evidence

- `evidence/BUG-005-stats-wrong-totals.json` — the `200 OK` stats on a fresh reset
- `evidence/BUG-005-probe-stats-output.txt` — `npm run probe:stats`, deriving the correct
  figures from the CSV independently and flagging the mismatch (270.5 vs 200.5, $26,175.35
  vs $21,312.90; deposits held matches, so only the hours/fees query is wrong)

## Regression test

Not automated. This is the lowest-priority of the five findings (the only P2), and it was
the one left outside the brief's five-test budget — the three API slots went to the two
Critical and one High-P1 bugs. Verified by hand and by arithmetic against the seed instead
(above). The test is a one-liner when the budget lifts:

```
expect((await request.get('/api/staff/stats', staff).then(r => r.json())).hoursBooked).toBe(200.5);
```

## Acceptance criteria for the fix

- `hoursBooked` and `hireFees` count only `confirmed` and `completed` bookings — on the
  seeded data, 200.5 and 21312.90.
- `depositsHeld` continues to count bookings whose deposit status is `held`.
- A newly created (pending) booking does not change `hoursBooked` or `hireFees` until it is
  confirmed.
- The stats regression test above (once added) goes green.

## Notes and suggested area

`src/routes/staff.js` `GET /stats`: the loop that accumulates `hours` and `fees` iterates
every row from `SELECT … FROM bookings` with no status condition, unlike the deposits query
which filters on `deposit_status = 'held'`. A `WHERE b.status IN ('confirmed','completed')`
on the hours/fees query brings it in line with §6.4.

## Related (not separate reports, noted for the developer)

While confirming this, two smaller money defects surfaced in the same area — they can be
folded into the fix rather than filed separately:

- `hireFees` is computed with floating-point and can render more than two decimals
  (e.g. `29940.049999999974` once add-ons/other rows are involved), which violates
  `SPEC.md` §3 ("no amount … may show more than two decimal places").
- A negative add-on quantity is accepted (`POST /api/bookings` with `quantity: -10`),
  producing a negative `total` — `SPEC.md` §5 requires quantities of at least zero.
