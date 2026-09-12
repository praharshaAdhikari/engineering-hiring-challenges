# AI usage

## Tools

- **Claude Code** — the main AI tool. Used for cross-checking the defects I found,
  drafting the five bug reports, writing the Playwright suite and the concurrency probe,
  building the Postman collection, and drafting the test summary and this README.
- **Postman** (not an AI tool) — how I did the manual exploratory testing myself: I ran the
  collection against the running app by hand and found the defects from the payloads.

## Roughly how much

Most of the first draft of the written artefacts and the test code came from the agent. What
I owned was the direction: which defects were worth reporting, how to rank them, the
severity/priority calls, the scope of the suite, and the go/no-go decision. I drove it as a
fast pair, not as an autopilot — I read what it produced, pushed back where it was wrong, and
re-ran everything myself against a fresh `npm run reset` before trusting it.

## What I changed about what it produced

The corrections are where the real work was:

- **It over-built the suite.** The brief asks for exactly five tests — three API, one
  concurrency, one UI — and the agent drifted to eight, including a second assertion crammed
  into the calendar test. I made it hold to the briefed five: I dropped the lowest-priority
  test (stats, the only P2 finding) and had it split the calendar test down to a single
  behaviour — the privacy leak — because a test should assert one thing.
- **The discarded assertion still needed a home.** When the calendar test was narrowed to the
  privacy leak, the "public calendar shows cancelled/rejected bookings" defect fell out of the
  automated coverage, so I had it logged in the confirmed-defects list in the summary rather
  than lost.
- **It initially left the worst defect untested.** The forgeable-staff-token bug (my #1) had
  no regression test at first because the agent froze the test list too early. I had it add
  coverage for that and rebalance the five so the top finding is the one that is guarded.
- **I rewrote the tool-choice rationale** in the suite README in my own words rather than ship
  its version.
- **It tripped on the environment, not the app.** My checkout is on a FUSE (NTFS) mount, where
  SQLite's file locks hang; the agent spent time chasing phantom processes before we found the
  real cause. The fix — point `DB_PATH` at a native filesystem — is configuration only; the
  app under test was not touched.

## What I did myself and must defend

I did the exploratory testing by hand first. I ran the whole Postman collection against the
running app myself, read the payloads, and found the defects that way — the list of findings
started as my notes, not the agent's. I then handed each one to the agent to cross-check
against the app and the spec, which is how a few got corrected (for example, that the stats
figure is wrong because it counts every status, and that "book on today's date" is a
spec-silent open question rather than a bug).

The ranking, the severity/priority grading and the NO-GO recommendation are my judgement
calls, not the agent's. I have gone through each bug's reproduction and the seeded-total
arithmetic against a running instance so I can reproduce them live, and I can explain every
line of the test suite and every claim in the reports on request.
