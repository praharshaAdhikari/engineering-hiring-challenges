# QA suite — Sabhaghar Booking v2.3.1

Five automated tests plus a concurrency probe, covering the highest-consequence defects
found in exploration: a slot race, a privacy leak, an authorisation hole and wrong office
figures. Each test names the behaviour it protects and cites the `SPEC.md` section it comes
from.

## Why Playwright + TypeScript

The primary reason for this was I am familiar with JS/TS and can read the code well. Claude convinced me to pick it for speed and it is also the tool that covers all three kinds of test I
had to write. Cypress or Selenium would have done the job too; this was the least setup for the coverage.

## Running it

```bash
cd roles/qa-engineer/qa
npm ci
npx playwright install --with-deps chromium
npm test
```

`npm test` starts the app itself — it runs `npm run reset && npm start` in `../app` first
(see `webServer` in `playwright.config.ts`), so every run begins from the seeded state the
README documents. To run against an app you started yourself, set `BASE_URL`:

```bash
BASE_URL=http://localhost:4000 npm test
```

### The database lives on tmpfs, not in the repo

The app stores its SQLite file wherever `DB_PATH` points; the config sets it to
`/tmp/sabhaghar-qa.sqlite`. This matters if your checkout is on a FUSE mount (NTFS/exFAT):
SQLite's POSIX file locks are unreliable there, and `node:sqlite` will block forever on
"database is locked", so `npm run reset` never returns and the webServer times out. A native
filesystem (tmpfs) makes reset+start instant. On a normal ext4/btrfs checkout it changes
nothing. Override with `DB_PATH=/some/native/path` if `/tmp` is not writable.

To drive the app by hand for the concurrency probe or for exploratory testing — using the
same tmpfs database, so it never wedges — use the wrapper scripts:

```bash
npm run app:reset     # reseed
npm run app:start     # serve on http://localhost:4000
```

## The suite

| Test                                       | Kind        | SPEC     | Defect it covers                                                                      |
| ------------------------------------------ | ----------- | -------- | ------------------------------------------------------------------------------------- |
| `api/forged-token-rejected`                | API         | §2       | Anyone can forge a `role=staff` token, or escalate their own, for full office access  |
| `concurrency/one-slot-one-winner`          | concurrency | §5       | Simultaneous requests for one slot all succeed — the room is double-booked            |
| `api/member-cannot-read-another-booking`   | API         | §2       | Any member reads any other member's booking, including their home address             |
| `api/private-calendar-leak`                | API         | §4       | Private bookings leak the member's name and purpose to the public calendar          |
| `ui/member-requests-a-booking`             | UI flow     | §5, §7.2 | The member happy path: sign in, request a space, see it land as `pending`             |

## Green suite, red bugs — how that works

Four of these tests assert the **correct** behaviour, so against v2.3.1 as shipped they
**fail**. That is the point: a suite that passes completely against a knowingly broken app
proves nothing. But CI also has to go green so the team keeps it. Both are true at once via
Playwright's `test.fail()`:

- **`npm test` (default) → green.** The bug tests are marked as _expected_ failures.
  Playwright runs them, sees them fail, and reports the run green. The plumbing is proven and
  the suite is a live regression guard: the day a developer fixes one of these bugs, its
  `test.fail()` becomes an _unexpected pass_ and the build goes **red**, telling them to
  delete the annotation. The bug can never come back silently.
- **`npm run test:red` → red.** Sets `PROVE_BUGS=1`, which drops the `test.fail()` markers so
  the tests fail for real. This is the run to show in the video — four red tests, each
  labelled with its bug.

The UI flow is a normal passing test in both modes; it exists to prove the environment works,
so the red tests read as "this behaviour is broken", not "the harness is misconfigured".

## Probes

Two dependency-free scripts in `probes/`, for the findings that are clearest as a script:

- **`probe:concurrency`** (`two-at-once.mjs`) — fires ten simultaneous booking requests for
  one slot and prints how many the server accepted (ten, on the app as shipped). Same
  experiment as the `one-slot-one-winner` test, but quicker to run live and the more dramatic
  thing to film. Needs a running app.
- **`probe:stats`** (`stats-from-seed.mjs`) — derives the correct office figures (200.5 hours,
  $21,312.90) straight from `app/src/seed/bookings.csv`, hard-coding the SPEC §3 rates and
  doing its own arithmetic so it imports nothing from the app and cannot reproduce its bug. If
  the app is running it prints the app's figures beside the derived ones and flags the
  mismatch — the evidence for BUG-005, which is not one of the five automated tests.

```bash
npm run app:reset && npm run app:start   # one terminal (uses the tmpfs DB)
npm run probe:concurrency                # another (from qa/)
npm run probe:stats                      # derives the figures; compares if the app is up
```
