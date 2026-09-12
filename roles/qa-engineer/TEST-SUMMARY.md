# Test summary — Sabhaghar Booking 2.3.1

|                    |                           |
| ------------------ | ------------------------- |
| **Tester**         | Praharsha Adhikari        |
| **Date**           | September 12, 2026        |
| **Build**          | 2.3.1 (`GET /api/health`) |
| **Recommendation** | **NO-GO for Friday**      |

---

## Recommendation

**No-go for Friday as it stands.** Three defects would cause direct harm in the first week
of booking season. First, there is effectively no login on the office side: anyone can
hand-write a token that says "staff" and read every member's personal details, approve or
reject bookings and alter records, with no account at all. Second, two families can be given
the same hall at the same time — ten simultaneous requests for one slot all succeeded, and
`SPEC.md` calls one-winner its single most important rule. Third, any signed-in member can
read any other member's home address by changing a reference in a URL. The membership's
private data and the integrity of every booking are both exposed.

The privacy and data fixes (BUG-003, BUG-004, BUG-005) look small and I would expect them
inside a day. The auth fix (BUG-001) means moving to a signed token and deciding role from
the account, not the token — a design change, but a well-understood one. The concurrency fix
(BUG-002) needs a locking or unique-constraint decision. **My recommendation: fix BUG-001
and BUG-002 before any public launch — they are not negotiable — land the three quick data
fixes alongside, and re-run the suite green before Friday. If Friday cannot move and the
auth and concurrency fixes are not ready, do not go live.**

---

## What I did

- **~4 hours**, split: exploratory + API by hand (a Postman collection under
  `postman/`); then real time under the API payloads and on concurrency; then the automated
  suite and CI; then the write-up.
- **Against**: the reference build on port 4000, from a clean `npm run reset` each time,
  Node 24, database on a native filesystem (see the note in `qa/README.md`).
- **Tooling**: Playwright + TypeScript for the suite (one tool for API, concurrency and UI),
  a dependency-free Node script for the concurrency probe, GitHub Actions for CI.
- I read `SPEC.md` §7 first and checked the deliberate behaviours off before reporting, so
  none of them are in the findings.

## Findings

Ranked, worst first. Full detail, reproduction and spec citation in each report; index and
ranking rationale in [`bug-reports/README.md`](bug-reports/README.md).

| #   | Severity | Priority | Finding                                                                       | Area                | Report                                                          |
| --- | -------- | -------- | ----------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| 1   | Critical | P1       | Anyone can forge a staff token — full office access, no account               | Auth (§2)           | [BUG-001](bug-reports/BUG-001-forgeable-staff-token.md)         |
| 2   | Critical | P1       | Two members can book the same slot at once; all simultaneous requests succeed | Booking (§5)        | [BUG-002](bug-reports/BUG-002-double-booking-race.md)           |
| 3   | Critical | P1       | Any member can read any other member's booking and home address (IDOR)        | API / Data (§2)     | [BUG-003](bug-reports/BUG-003-idor-booking-personal-data.md)    |
| 4   | High     | P1       | Public calendar leaks private members' names + purposes                       | Calendar (§4)       | [BUG-004](bug-reports/BUG-004-calendar-leaks-private-events.md) |
| 5   | High     | P2       | Office hours & hire-fee figures count every status — overstated               | Staff / Data (§6.4) | [BUG-005](bug-reports/BUG-005-stats-count-all-statuses.md)      |

**Totals:** 3 critical · 2 high · 0 medium · 0 low · 3 open questions.

## Other confirmed defects, found but not written up

Reporting five well beats reporting twenty thinly, so these are logged for the developer but
not filed as separate reports. Each is reproducible; several share a root cause with the five
above and would be fixed alongside them.

- **The public calendar shows non-events** (§4) — cancelled, rejected and pending bookings
  all appear, though only confirmed and completed should. Second defect in [BUG-004](bug-reports/BUG-004-calendar-leaks-private-events.md),
  sharing the same endpoint and fix as the privacy leak.
- **Reject does not release the deposit**, and approve/reject audit rows do not name the
  staff member (§6.2) — `deposit.status` stays `held`, `actor_id` is `null`.
- **A booking can be cancelled twice** (§6.3) — second cancel returns 200; risks a double
  refund in a real ledger.
- **Approve does not re-check the slot** and succeeds on already-confirmed or cancelled
  bookings (§6.2).
- **Staff search is broken for Devanagari names, references and emails** (§6.1) — the input
  is stripped to `[a-zA-Z0-9 ]`, so `सुष्मिता` becomes empty (returns everything) and `@`/`-`
  are removed from emails/references.
- **Pagination bounds are not enforced** (§6.1) — `pageSize` of 0, negative or >100, and
  `page` of 0 or negative, are all accepted instead of 422.
- **`pageSize=abc` and non-numeric `attendees` return 500 with a stack trace** — the global
  error handler serves `err.stack` to the client, leaking internals.
- **CSV export has no RFC 4180 quoting and no BOM** (§6.5) — `Shrestha, Bijay "BJ"` and a
  purpose containing a comma break the column layout.
- **Touching slots are wrongly rejected** (§5) — `12:00–14:00` after `10:00–12:00` returns
  409, though the spec (and the seed pair on 2026-11-07) says touching is legal. The clash
  query uses `<=`/`>=` where it needs `<`/`>`.
- **Over-capacity, zero and negative `attendees` are accepted** (§5), and a **negative
  add-on quantity produces a negative total** (noted in BUG-005).
- **Past `eventDate` is accepted** (§5 requires 422).
- **Staff token accepted in the query string** (`?token=`) — ends up in logs and history.

## Open questions for the product owner

Places the specification is genuinely silent — these are not defects, and my reading is given.

1. **Does "today" count as a future date?** §5 says `eventDate` "must be in the future" but
   does not define the boundary. (Note: past dates are accepted today — that is the separate
   bug above — but the today-boundary itself is undefined.) I would treat a same-day booking
   as allowed only if it is also after the current time, and would ask for that in writing.
2. **What should a non-numeric `attendees` or `pageSize` do?** The type is unspecified;
   today it crashes with a 500. Whatever the rule, a 422 with a clear message — never a 500
   with a stack trace — is the right shape.
3. **Should an unrecognised `visibility` value be rejected?** §4 defines only `public` and
   `private`; the API currently stores anything. I would reject unknown values with 422.

## Automated coverage delivered

Suite at [`qa/`](qa/). `npm test` is green (bug tests are marked as expected failures so CI
stays green and turns red the moment a bug is fixed or a regression appears);
`npm run test:red` runs them as real failures — the run to film.

Five tests, the shape the brief asks for — three API, one concurrency, one UI.

| Layer         | Tests | Fails against 2.3.1  | Covers                                                     |
| ------------- | ----- | -------------------- | ---------------------------------------------------------- |
| API           | 3     | 3                    | BUG-001 (forged token), BUG-003 (IDOR), BUG-004 (calendar) |
| Concurrency   | 1     | 1                    | BUG-002 (one-winner)                                       |
| UI end-to-end | 1     | 0 (green happy path) | Member sign-in → request → pending                         |

**4 of 5 tests fail against 2.3.1** under `test:red`; each maps to a finding. The three API
tests cover the three highest-severity API-visible bugs (the two Criticals and one High P1);
BUG-005 (stats, the one High **P2**) is verified by hand and arithmetic but is the finding I
left out of the five-test budget — see gaps. CI is in `.github/workflows/qa-engineer.yml` and
runs the suite on push.

## Coverage gaps and residual risk

What I did not test, and what could still be wrong because of it.

- **BUG-005 (stats) and the "other defects" list are not automated** — the five-test budget
  went to the higher-severity findings, so the P2 stats bug and the twelve secondary defects
  are confirmed by hand but have no regression guard and can silently return. First to
  automate when the budget lifts: stats, reject/deposit, cancel-twice and the 500/stack leak.
- **No accessibility pass** (`@axe-core/playwright` was out of scope for the time budget) —
  the §8 "works at 375px" requirement and keyboard-only booking are unverified.
- **No cross-browser, load or performance testing** — the §8 "100 bookings should not take
  seconds" claim is unmeasured.
- **The approve-time re-check race (§6.2) is not automated** — I reasoned it shares
  BUG-002's root cause but did not build a concurrency test for the approve path.
- **CSV was checked by eye, not parsed** — RFC 4180 correctness is asserted informally.

## What I would do next

1. Fix signed tokens + role-from-account (BUG-001); its regression test is already written. _(~half a day)_
2. Fix and test the concurrency guarantee for both request and approve. _(~1 day, incl. design)_
3. Land the privacy fixes (003, 004) — tests already written — and the stats fix (005). _(~1 day)_
4. Automate the highest-value items from the "other defects" list — reject/deposit, cancel-twice, pagination bounds, the 500/stack leak. _(~half a day)_
5. Add an accessibility pass and a 100-row render check. _(~half a day)_

## What I would ask the developers to change

To make this easier to test and harder to break:

- **Sign the token and derive role from the looked-up account** — closes BUG-001 and a class
  of privilege bugs.
- **Validate input at the boundary** (a schema library) and return structured 4xx codes —
  removes the 500/stack-trace responses and makes tests assert on codes, not prose.
- **Never send `err.stack` to the client** — the global error handler leaks internals today.
- **A reset/test-data endpoint** would let the suite reseed without a filesystem dependency
  (the current DB-on-FUSE lock issue is documented in `qa/README.md`).
- **Stable `data-testid` hooks** on the request form and console rows for durable UI tests.
