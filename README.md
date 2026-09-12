# QA screening submission — Sabhaghar Booking v2.3.1

**Praharsha Adhikari · QA Engineer challenge (SCREEN brief) · build 2.3.1**

I tested the reference build of the Himalaya Cultural Centre's hall-booking system, found the
defects that matter, wrote them up so a developer can fix them without asking me a question,
and left behind an automated suite that fails while the bugs are present and turns green once
they are fixed.

**Video walkthrough:** _<add your Loom / YouTube (unlisted) link here — 2–3 min>_

All of my work is under [`roles/qa-engineer/`](roles/qa-engineer/). Nothing in the app under
test (`roles/qa-engineer/app/`) was modified.

## Where everything is

| Deliverable | Location |
|---|---|
| Test summary + **NO-GO** recommendation | [`roles/qa-engineer/TEST-SUMMARY.md`](roles/qa-engineer/TEST-SUMMARY.md) |
| Five bug reports, ranked worst-first | [`roles/qa-engineer/bug-reports/`](roles/qa-engineer/bug-reports/) |
| Automated suite (3 API, 1 concurrency, 1 UI) | [`roles/qa-engineer/qa/`](roles/qa-engineer/qa/) |
| Concurrency probe | [`roles/qa-engineer/qa/probes/two-at-once.mjs`](roles/qa-engineer/qa/probes/two-at-once.mjs) |
| Postman collection (API exploration) | [`roles/qa-engineer/postman/`](roles/qa-engineer/postman/) |
| CI workflow | [`.github/workflows/qa-engineer.yml`](.github/workflows/qa-engineer.yml) |
| AI usage | [`AI-USAGE.md`](AI-USAGE.md) |

## Stack and why

| Layer | Choice | Why |
|---|---|---|
| Test framework | Playwright + TypeScript | One tool for API, concurrency and UI; the `request` fixture does the API tests with no browser, and I read TS fastest |
| Concurrency probe | Plain Node 24 (`fetch`, `Promise.all`) | No dependencies; the §5 race reads most clearly as a tiny standalone script |
| CI | GitHub Actions | Node 24 and nothing else — `node:sqlite` means no database service to stand up |
| API exploration | Postman collection | The defects live in the payloads, and a saved collection makes the inspection reproducible |

## How to run the suite

```bash
cd roles/qa-engineer/qa
npm ci
npx playwright install chromium      # add --with-deps on Debian/Ubuntu/CI; omit it on Fedora/macOS
npm test
```

`npm test` starts the app itself (it runs `npm run reset && npm start` in `../app` first),
so the run begins from the seeded state. **What you should see:** `5 passed` — a green run.

To watch the same suite fail against the shipped app — the run in the video:

```bash
npm run test:red        # 4 failed (the bugs), 1 passed (the UI happy path)
```

Both are correct. The four bug tests assert the *fixed* behaviour and are marked as expected
failures, so CI stays green as a live regression guard and turns red the moment a bug is
fixed (or a regression appears). The full explanation is in
[`roles/qa-engineer/qa/README.md`](roles/qa-engineer/qa/README.md).

### Driving the app by hand (for the probe or exploratory testing)

```bash
cd roles/qa-engineer/qa
npm run app:reset && npm run app:start   # serves on http://localhost:4000
npm run probe:concurrency                # in a second terminal — prints 10 of 10 slots taken
```

## Test accounts and seeded data

From the app under test (`roles/qa-engineer/app/README.md`):

```
staff@himalayacc.example    staff12345     staff  — the office console
member@himalayacc.example   member12345    member — has no seeded bookings, use it to create
other@himalayacc.example    other12345     member — the second member, for authorisation tests
```

The seeded totals I worked out by hand from `app/src/seed/bookings.csv` (the correct figures
per SPEC §6.4): **200.5** hours booked, **$21,312.90** in hire fees, **$16,400.00** in
deposits held. BUG-005 is that the app reports different numbers.

## Tests — what passes and what does not

- `npm test` → **5 passed** (green). The bug tests are expected failures; the UI flow passes.
- `npm run test:red` → **4 failed, 1 passed**. The four failures are BUG-001 to BUG-004, each
  labelled with its bug; the UI flow still passes. This is deliberate, not a broken suite.
- The five tests map to the five bug reports minus BUG-005, which is verified by hand and
  arithmetic (see its report and TEST-SUMMARY).

## Decisions and trade-offs

- **Did less, well.** Five bug reports and five tests, the shape the SCREEN brief asks for —
  not twenty-five thin ones. I found more than five defects and *chose* which five to write
  up; twelve more are logged in TEST-SUMMARY for the developer.
- **The suite is green in CI but genuinely red at heart.** Using Playwright's `test.fail()`
  keeps CI green (so the team keeps the workflow) while making the suite a real regression
  guard. A suite that passes completely against a knowingly broken app proves nothing.
- **The worst defect is tested.** When I first built the suite BUG-001 (the auth bypass) was
  uncovered; I swapped the lowest-priority test (BUG-005, stats, the only P2) out for it, so
  the three API slots hold the three highest-severity API-visible bugs.
- **I did not modify the app.** The only external change is pointing its SQLite file at a
  native filesystem via `DB_PATH` — on a FUSE checkout (NTFS/exFAT) SQLite's file locks hang
  forever. This is configuration, not a code change, and it is documented in the qa README.
- **Skipped on purpose** (the SCREEN brief lists these as out of scope): the two-page test
  plan, the tooling-standardisation write-up, load/performance/cross-browser and an
  accessibility pass.

## Known issues and limitations

- BUG-005 (stats) and the twelve secondary defects in TEST-SUMMARY are confirmed by hand but
  have no automated regression guard yet.
- No accessibility, cross-browser or load coverage (the §8 non-functional expectations are
  unverified).
- The suite assumes it owns the app; `npm test` reseeds before running, so run it that way
  rather than against a database you have already changed.

---

_This is a fork of the take-home challenge. The original challenge instructions remain in
[`SUBMISSION.md`](SUBMISSION.md), [`docs/`](docs/) and the per-role folders._
