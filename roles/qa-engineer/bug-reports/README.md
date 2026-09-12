# Bug reports — Sabhaghar Booking v2.3.1

Five defects, ranked worst-first. Ranked by consequence to the centre and its members — a
total auth bypass and a double-booking above a wrong dashboard number — not by how easy each
was to find. Full detail, reproduction and spec citation in each file; evidence bodies in
`evidence/`.

| # | Defect | Severity | Priority | Area | SPEC | Visible in UI? |
|---|--------|----------|----------|------|------|----------------|
| [001](BUG-001-forgeable-staff-token.md) | Anyone can forge a staff token — full office access with no account | Critical | P1 | Auth | §2 | No (API only) |
| [002](BUG-002-double-booking-race.md) | Two members can book the same slot at once; all simultaneous requests succeed | Critical | P1 | Booking | §5 | No (concurrency) |
| [003](BUG-003-idor-booking-personal-data.md) | Any member can read any other member's booking and home address | Critical | P1 | API / Data | §2 | Partly (payload) |
| [004](BUG-004-calendar-leaks-private-events.md) | Public calendar leaks private members' names + purposes, and shows non-events | High | P1 | Calendar | §4 | Partly (payload) |
| [005](BUG-005-stats-count-all-statuses.md) | Office hours & hire-fee figures count every status — overstated | High | P2 | Staff / Data | §6.4 | Yes |

Three of the five are only visible in the API payloads, not on the screens (001, 002, and
the leaking fields of 003/004).

## How severity and priority were graded

They answer different questions, and I kept them independent. **Severity** is how bad the
damage is *if it happens* — intrinsic to the defect, ignoring timing. **Priority** is how
soon to fix — folding in the launch context (go-live Friday, wedding season the week after),
likelihood, and whether a workaround exists.

- **Severity** by consequence class: **Critical** = security/privacy breach, direct
  real-world harm, or silent data corruption; **High** = data-integrity or member-experience
  harm that is bounded or recoverable; Medium/Low = has a workaround, or cosmetic.
- **Priority** by urgency at launch: anything reachable on Friday with no workaround is
  **P1**; something wrong but non-breaching with a stand-in mitigation is **P2**.

That is why four of five are P1 but only three are Critical. The two informative splits:
**004** is High (a name and purpose is less sensitive than 003's home address) yet still P1
(a *public*, unauthenticated endpoint breaking an explicit promise to members). **005** is
High *severity* but **P2** *priority* — every board figure is wrong, but it is not a breach
and the office can be told to recompute until it is fixed, so it need not block Friday.

## On the ranking

- **001 above 002** because it is a complete loss of access control: an unauthenticated
  attacker can do everything 002–005 describe and more (read all PII, approve/reject, alter
  records). 002 is the more business-specific catastrophe, but 001 subsumes it.
- **003 above 004** because it exposes more sensitive data (home address, phone) — though
  004 needs no account at all, which is why both are P1.
- **005 is P2, not P1**: it is wrong and erodes trust in the numbers, but it is not a breach
  and the office can be warned to recompute in the meantime.

## Deliberate behaviour (§7) — checked and NOT reported

Confirmed these are intended per `SPEC.md` §7 and left out on purpose: blackout dates
rejected with 422 (§7.3), quarter-hour times rejected (§7.4), the 09:00–23:00 window (§7.7),
every request starting `pending` (§7.2), Classroom B visible but not bookable (§7.5),
deposits recorded not charged (§7.6), guests unable to book (§7.1).

## Regression coverage

Four of the five are encoded as failing tests in `../qa/tests/` (run `npm run test:red` to
see them red); the suite goes green once the bugs are fixed. BUG-005 (the lowest-priority,
the only P2) is the one left outside the brief's five-test budget — verified by hand and
arithmetic instead.
