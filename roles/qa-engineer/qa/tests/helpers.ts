import { APIRequestContext, expect } from '@playwright/test';

// The three accounts the README documents.
export const ACCOUNTS = {
  staff: { email: 'staff@himalayacc.example', password: 'staff12345' },
  member: { email: 'member@himalayacc.example', password: 'member12345' },
  other: { email: 'other@himalayacc.example', password: 'other12345' },
};

export async function login(request: APIRequestContext, who: keyof typeof ACCOUNTS): Promise<string> {
  const res = await request.post('/api/auth/login', { data: ACCOUNTS[who] });
  expect(res.ok(), `login for ${who} should succeed`).toBeTruthy();
  return (await res.json()).token;
}

export function auth(token: string) {
  return { headers: { authorization: `Bearer ${token}` } };
}

// A booking-shaped body with sensible defaults; override any field.
export function bookingBody(overrides: Record<string, unknown> = {}) {
  return {
    spaceSlug: 'library',
    eventDate: uniqueFutureDate(),
    startTime: '10:00',
    endTime: '12:00',
    attendees: 5,
    purpose: 'Automated test booking',
    visibility: 'public',
    ...overrides,
  };
}

// The app has no per-test reset, so anything that creates a booking must claim a date no
// other run has used, or a second run hits a stale slot conflict. A random day in a wide
// 2027–2029 window (skipping the seed's range and the four blackout dates) makes that
// collision astronomically unlikely without any shared state.
const BLACKOUTS = new Set(['10-11', '10-20', '11-11', '12-25']);
export function uniqueFutureDate(): string {
  for (;;) {
    const year = 2027 + Math.floor(Math.random() * 3);
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!BLACKOUTS.has(mmdd)) return `${year}-${mmdd}`;
  }
}

// The seeded truths from app/README.md, derived by hand from src/seed/bookings.csv.
// Kept here so a test reads as "the answer we worked out" rather than a magic number.
export const SEEDED = {
  hoursBooked: 200.5, // confirmed + completed only (SPEC §6.4)
  hireFees: 21312.9, // confirmed + completed only
  depositsHeld: 16400,
};
