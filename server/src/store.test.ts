import { expect, test } from 'vitest';
import { createStore } from './store.ts';

const eventType = { name: 'Intro call', description: 'A short call.', durationMinutes: 30 };

test('replaceBooking fails for an id that no booking has and stores nothing', () => {
  const store = createStore();
  const created = store.createEventType(eventType);
  const booking = store.createBooking({
    eventType: created,
    startTime: '2026-11-23T06:00:00Z',
    endTime: '2026-11-23T06:30:00Z',
    guestName: 'Anna',
    guestEmail: 'anna@example.com',
    createdAt: '2026-11-23T05:00:00Z',
  });

  expect(() => store.replaceBooking({ ...booking, id: 'bkg_missing' })).toThrow(/bkg_missing/);
  expect(store.listBookings()).toEqual([booking]);
});
