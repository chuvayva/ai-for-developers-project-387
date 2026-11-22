import { type APIRequestContext, expect, type Page } from '@playwright/test';

/** Creates an event type of 60 minutes through the API and returns its id. */
export async function createHourCall(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/api/event-types', {
    data: { name, description: 'A call to book.', durationMinutes: 60 },
  });
  expect(created.status()).toBe(201);
  const eventType: { id: string } = await created.json();
  return eventType.id;
}

/** Opens the booking page of the event type on a day of the booking window. */
export async function openDay(page: Page, eventTypeId: string, daysFromToday: number) {
  await page.goto(`/book/${eventTypeId}`);
  const day = page.getByRole('list', { name: 'Days' }).getByRole('button').nth(daysFromToday);
  await day.click();
  await expect(day).toHaveAttribute('aria-pressed', 'true');
}
