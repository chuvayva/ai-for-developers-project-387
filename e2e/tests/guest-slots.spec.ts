import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// A browser far from the host time zone: the page must still show Moscow days and times.
test.use({ timezoneId: 'America/Los_Angeles' });

/** A day of the booking window the way the page writes it, such as `Tue 24 Nov`. */
function dayLabel(daysFromToday: number): string {
  // The en-CA locale writes a date as 2026-11-23.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + daysFromToday);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(day);
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
}

test('a guest goes from the home page to an event type and sees slots for tomorrow', async ({
  page,
  request,
}) => {
  // Other tests add event types to the same server, so this one has a name of its own.
  const name = `Slots call ${randomUUID()}`;
  const created = await request.post('/api/event-types', {
    data: { name, description: 'A call to look at slots.', durationMinutes: 30 },
  });
  expect(created.status()).toBe(201);

  await page.goto('/');
  await page.getByRole('link', { name: 'Book a call' }).click();
  await page.getByRole('link', { name }).click();

  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(page.getByText('Europe/Moscow')).toBeVisible();

  const days = page.getByRole('list', { name: 'Days' }).getByRole('button');
  await expect(days).toHaveCount(14);
  await expect(days.nth(0)).toContainText(dayLabel(0));
  await expect(days.nth(13)).toContainText(dayLabel(13));

  const tomorrow = days.nth(1);
  await expect(tomorrow).toContainText(dayLabel(1));
  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute('aria-pressed', 'true');

  // Bookings of other tests may take some of tomorrow's slots, so no exact list here.
  // Every slot that is left lies in working hours on the step of 30 minutes.
  const slots = page.getByRole('list', { name: 'Slots' }).getByRole('listitem');
  await expect(slots.first()).toBeVisible();
  for (const text of await slots.allTextContents()) {
    expect(text).toMatch(/^(09|1[0-7]):[03]0 – (09|1[0-8]):[03]0$/);
  }
});

test('an unknown event type shows a not found state', async ({ page }) => {
  await page.goto(`/book/${randomUUID()}`);

  await expect(page.getByRole('heading', { name: 'Event type not found' })).toBeVisible();
});
