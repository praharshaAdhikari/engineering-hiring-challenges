# BUG-004 — The public calendar leaks private members' names and event purposes, and lists bookings that should never appear

| | |
|---|---|
| **Severity** | High |
| **Priority** | P1 |
| **Area** | Public calendar / API |
| **Found** | API testing |
| **Spec reference** | `SPEC.md` §4 |
| **Status** | Open |

## Summary

`GET /api/calendar` is public (no sign-in). Two problems in one payload: (1) for `private`
bookings it masks only the `title` field but still returns the member's real name in
`bookedBy` and the real purpose in `purpose`; and (2) it applies no status filter, so
`pending`, `cancelled` and `rejected` bookings — which are not events — appear on the public
calendar.

## Environment

- Build: Sabhaghar Booking 2.3.1 (`GET /api/health`)
- Running via: `npm run app:start` on port 4000
- Data state: fresh `npm run reset`
- Account used: **none** — the endpoint is public

## Steps to reproduce

1. Reset and start the app.
2. Read the public calendar for a day with a private confirmed booking (`HCC-BK-4273`):

```bash
curl -s 'localhost:4000/api/calendar?from=2026-10-21&to=2026-10-21' | jq '.events[] | select(.reference=="HCC-BK-4273")'
```

3. For the status problem, list every status the public calendar returns across the year:

```bash
curl -s 'localhost:4000/api/calendar?from=2026-01-01&to=2026-12-31' \
  | jq '[.events[].status] | group_by(.) | map({(.[0]): length}) | add'
```

## Expected result

> `SPEC.md` §4, private visibility: the response may show "Private event", the space, the
> date and time, and **"Nothing identifying the member, and not the purpose either — not
> their name, not their email, not their member id, in any field of the response."**
>
> `SPEC.md` §4: "Only confirmed and completed bookings appear."

So: a private event exposes no `bookedBy` and no `purpose`, and the calendar contains only
`confirmed` and `completed` statuses.

## Actual result

The private booking leaks both the member's name and the purpose:

```json
{
  "reference": "HCC-BK-4273",
  "title": "Private event",
  "purpose": "दशैं कार्यक्रम",
  "bookedBy": "सुष्मिता श्रेष्ठ",
  "visibility": "private",
  "status": "confirmed"
}
```

And every status is present, not just the two allowed:

```json
{ "cancelled": 11, "completed": 22, "confirmed": 37, "pending": 8, "rejected": 6 }
```

## Impact

The centre promised members who choose "private" that their event would not be identified.
It is: their name and what the event is for are served to anybody on the internet, no login
required — including, in the seed data, a family's Dashain programme and every other private
booking. Separately, the public sees requests that were never approved and bookings that
were cancelled or rejected, so the "what's on" list shows events that are not happening —
misleading the community and advertising, for example, a cancelled wedding. The first half
is a privacy breach; the second is a correctness and reputation problem.

## Evidence

- `evidence/BUG-004-private-event-on-calendar.json` — the leaking private event
- Reproduced as assertions: `qa/tests/api/private-calendar-leak.spec.ts` (two tests)

- `qa/tests/api/private-calendar-leak.spec.ts` → *"a private booking leaks nothing
  identifying the member or the purpose (SPEC §4)"*
- Fails against 2.3.1 (`npm run test:red`). Passes once private events are stripped of the
  member name and purpose.
- The second defect in this report — cancelled/rejected/pending bookings appearing on the
  calendar — is verified by hand (step 3 above) and not automated, to keep the suite to the
  briefed five tests; the same fix closes both.

## Acceptance criteria for the fix

- For a `private` event, no field of the response contains the member's name, email, id or
  the purpose — only the masked title, space, date and time.
- The calendar returns only `confirmed` and `completed` bookings.
- A `public` event still shows its purpose and the member's name, as §4 allows.
- `qa/tests/api/private-calendar-leak.spec.ts` goes green without being edited.

## Notes and suggested area

`src/routes/public.js` `GET /calendar`: the row mapper sets `title` conditionally on
visibility but populates `purpose: r.purpose` and `bookedBy: r.member_name` unconditionally,
and the query has no `WHERE b.status IN ('confirmed','completed')`. Both the field selection
and the status filter need to depend on the data, not just the title.
