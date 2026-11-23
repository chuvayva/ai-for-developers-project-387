import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createHourCall } from './helpers.ts';

// Bookings block slots across event types, and every test file shares one server.
// This test books and reschedules on a day of its own, counted from today, that no
// other test books on. It uses two of the nine slots that day.
const DAY_OF_THE_BOOKING = 11;

type Slot = { startTime: string; endTime: string };

const hostDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const hostTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});

/** A slot written as the page writes it, in the host time zone, as in `Fri 4 Dec, 17:00 – 18:00`. */
function slotLabel(slot: Slot): string {
  const start = new Date(slot.startTime);
  const day = hostDay.formatToParts(start);
  const read = (type: string) => day.find((p) => p.type === type)?.value;
  const range = `${hostTime.format(start)} – ${hostTime.format(new Date(slot.endTime))}`;
  return `${read('weekday')} ${read('day')} ${read('month')}, ${range}`;
}

test('the host reschedules a booking and the list shows the new time', async ({
  page,
  request,
}) => {
  const id = randomUUID();
  const guestName = `Guest ${id}`;
  const eventTypeId = await createHourCall(request, `Moved call ${id}`);

  const days: { slots: Slot[] }[] = await (
    await request.get(`/api/event-types/${eventTypeId}/slots`)
  ).json();
  // The first and the last free slot of the day. A retry of this test finds its earlier ones taken.
  const slots = days[DAY_OF_THE_BOOKING]!.slots;
  const from = slots[0]!;
  const to = slots.at(-1)!;
  expect(to.startTime).not.toBe(from.startTime);
  const booked = await request.post('/api/bookings', {
    data: {
      eventTypeId,
      startTime: from.startTime,
      guestName,
      guestEmail: 'anna@example.com',
    },
  });
  expect(booked.status()).toBe(201);

  await page.goto('/host/bookings');
  const booking = page
    .getByRole('list', { name: 'Upcoming bookings' })
    .getByRole('listitem')
    .filter({ hasText: guestName });
  await expect(booking).toContainText(slotLabel(from));

  await booking.getByRole('button', { name: 'Reschedule' }).click();
  await booking.getByRole('button', { name: slotLabel(to) }).click();
  await booking.getByRole('button', { name: 'Confirm' }).click();

  await expect(booking).toContainText(slotLabel(to));
  await expect(booking).not.toContainText(slotLabel(from));
  await expect(booking.getByRole('button', { name: 'Reschedule' })).toBeVisible();

  await page.reload();
  await expect(booking).toContainText(slotLabel(to));
});
