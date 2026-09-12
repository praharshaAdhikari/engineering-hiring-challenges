# Postman collection — Sabhaghar Booking v2.3.1

Import `sabhaghar.postman_collection.json` (Postman → Import → File). Everything is a
collection variable, so there is no separate environment file to import.

## Before each full run

```bash
cd roles/qa-engineer/app
npm run reset      # drops every table and reseeds
npm start          # http://localhost:4000
```

Then run **1 · Auth → Login — staff** and **Login — member** once. Their test scripts save
`staffToken`, `memberToken` and `otherToken`, which every other request reads.

## What is in it

| Folder | What it covers |
|---|---|
| 1 · Auth | The three accounts, plus wrong password / unknown email / no-password member / case-variant email |
| 2 · Public | Spaces, availability (back-to-back, cancelled, pending and blackout days), the public calendar |
| 3 · Member | Profile, own bookings, creating, reading and cancelling — including reading *another* member's booking |
| 4 · Validation probes | One request per rule in SPEC §5, plus the §7 rules that are deliberate and must not be reported |
| 5 · Slot conflicts | Overlap, touching, containment, identical, and against pending / cancelled / rejected bookings |
| 6 · The office | Every documented filter, the pagination bounds from §6.1, stats, CSV, audit, approve and reject |
| 7 · Authorisation | Staff routes with a member token, no token, a token in the query string, and a hand-made token |

Each request's description cites the section of `app/SPEC.md` that governs it. Requests
covering **§7 (deliberate behaviour)** say so — reporting those as bugs costs marks.

Nothing here asserts pass/fail; it puts the payloads in front of you. A few requests log
useful things to the Postman console (`Ctrl/Cmd + Alt + C`) — the decoded token, the seeded
totals next to the ones the API reports, whether the CSV starts with a byte-order mark.

## Dates

Every probe that should *not* hit a slot conflict books its own date in December 2026
(the last seeded booking is 2026-11-10), skipping the 25th because it is a blackout. Re-run
the collection without `npm run reset` and those dates will be taken by the previous run.

## What Postman cannot do here

SPEC §5's most important rule — *two members requesting the same slot at the same moment
must not both succeed* — needs genuinely parallel requests. Postman fires sequentially.
Use the `two-at-once.mjs` sketch in [`../SETUP.md`](../SETUP.md), or write it as a test in
whichever runner you pick.
