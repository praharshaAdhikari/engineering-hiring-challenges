import { test, expect } from '@playwright/test';
import { uniqueFutureDate } from '../helpers';

// A green end-to-end flow through the member UI: sign in, request a space, and see the
// booking come back on the "My bookings" page with its reference and a `pending` status.
//
// This exercises the happy path SPEC §5 / §7.2 describe (every request lands as pending)
// and proves the member-facing plumbing works, so the red bug tests above are clearly
// about behaviour and not a broken environment.

test('a member can sign in and request a booking (SPEC §5, §7.2)', async ({ page }) => {
  await page.goto('/');

  // Open the sign-in dialog and use the "Member" test-account chip, then submit. Scope to
  // the dialog: a "Sign in" button also lives in the masthead.
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  const dialog = page.locator('#signinDialog');
  await dialog.getByRole('button', { name: 'Member', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();

  // The request form replaces the "members only" lock once signed in.
  const form = page.locator('#requestForm');
  await expect(form).toBeVisible();

  // Fill a valid future booking on the Reading Room. The radio is visually hidden behind a
  // styled card, so click the card the way a member would.
  await page.locator('label.space-card', { hasText: 'Reading Room' }).click();
  await page.locator('#fDate').fill(uniqueFutureDate());
  await page.locator('#fStart').fill('10:00');
  await page.locator('#fEnd').fill('12:00');
  await page.locator('#fPurpose').fill('Automated UI booking');
  await page.locator('#fAttendees').fill('5');

  await page.getByRole('button', { name: 'Send request to the office' }).click();

  // The app confirms with a toast and routes to "My bookings", where the new booking shows
  // as pending with an HCC-BK reference.
  await expect(page.locator('.toast', { hasText: 'sent' })).toBeVisible();
  const card = page.locator('#mine .card.item').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.ref')).toHaveText(/HCC-BK-\d+/);
  await expect(card.locator('.pill.pending')).toBeVisible();
});
