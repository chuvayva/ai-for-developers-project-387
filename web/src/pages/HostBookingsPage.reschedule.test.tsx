import type { components } from '@calendar/api';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { intro, json, renderAt, review, stubApi } from '../testing.tsx';

// A host reschedules a booking on the host bookings page, `/host/bookings`.

type Booking = components['schemas']['Booking'];
type SlotDay = components['schemas']['SlotDay'];

afterEach(() => {
  vi.unstubAllGlobals();
});

// Moscow is UTC+3, so 06:00Z on Monday 23 November 2026 is 09:00 there.
const anna: Booking = {
  id: 'bkg_1',
  eventType: intro,
  startTime: '2026-11-23T06:00:00Z',
  endTime: '2026-11-23T06:30:00Z',
  guestName: 'Anna Petrova',
  guestEmail: 'anna@example.com',
  createdAt: '2026-11-21T12:15:42Z',
};
const boris: Booking = {
  id: 'bkg_2',
  eventType: review,
  startTime: '2026-11-23T08:00:00Z',
  endTime: '2026-11-23T08:45:00Z',
  guestName: 'Boris Ivanov',
  guestEmail: 'boris@example.com',
  createdAt: '2026-11-21T12:20:00Z',
};

// 10:00 and 12:00 Moscow time on Tuesday, free for the intro call.
const introDays: SlotDay[] = [
  {
    date: '2026-11-24',
    slots: [
      { startTime: '2026-11-24T07:00:00Z', endTime: '2026-11-24T07:30:00Z' },
      { startTime: '2026-11-24T09:00:00Z', endTime: '2026-11-24T09:30:00Z' },
    ],
  },
];

type Server = {
  patch: (body: unknown) => Response;
  patched: unknown[];
  slotLoads: number;
};

function hostServer(patch: (body: unknown) => Response): Server {
  const server: Server = { patch, patched: [], slotLoads: 0 };
  stubApi({
    'GET /api/bookings': () => json(200, [anna, boris]),
    'GET /api/event-types': () => json(200, [intro, review]),
    'GET /api/event-types/evt_a/slots': () => {
      server.slotLoads += 1;
      return json(200, introDays);
    },
    'GET /api/event-types/evt_b/slots': () => json(200, []),
    'PATCH /api/bookings/bkg_1': (body) => {
      server.patched.push(body);
      return server.patch(body);
    },
  });
  return server;
}

async function openAnna() {
  const list = await screen.findByRole('list', { name: 'Upcoming bookings' });
  const item = within(list).getAllByRole('listitem')[0]!;
  fireEvent.click(within(item).getByRole('button', { name: 'Reschedule' }));
  return screen.findByRole('list', { name: 'Slots' });
}

test('rescheduling to a slot shows the new time and keeps the list in order of start', async () => {
  const moved: Booking = {
    ...anna,
    startTime: '2026-11-24T07:00:00Z',
    endTime: '2026-11-24T07:30:00Z',
  };
  const server = hostServer(() => json(200, moved));
  renderAt('/host/bookings');

  const slots = await openAnna();
  fireEvent.click(within(slots).getByRole('button', { name: 'Tue 24 Nov, 10:00 – 10:30' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(screen.queryByRole('list', { name: 'Slots' })).toBeNull());
  expect(server.patched).toEqual([{ startTime: '2026-11-24T07:00:00Z', eventTypeId: 'evt_a' }]);
  const items = within(screen.getByRole('list', { name: 'Upcoming bookings' })).getAllByRole(
    'listitem',
  );
  expect(items[0]?.textContent).toContain('Boris Ivanov');
  expect(items[1]?.textContent).toContain('Anna Petrova');
  expect(items[1]?.textContent).toContain('Tue 24 Nov, 10:00 – 10:30');
});

test('the host can change only the event type and keep the time', async () => {
  const changed: Booking = {
    ...anna,
    eventType: review,
    endTime: '2026-11-23T06:45:00Z',
  };
  const server = hostServer(() => json(200, changed));
  renderAt('/host/bookings');

  await openAnna();
  fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'evt_b' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(server.patched).toHaveLength(1));
  expect(server.patched).toEqual([{ startTime: anna.startTime, eventTypeId: 'evt_b' }]);
  expect(await screen.findByText('Mon 23 Nov, 09:00 – 09:45')).toBeTruthy();
});

test('a taken slot shows a message, leaves the booking and reloads the slots', async () => {
  const server = hostServer(() =>
    json(409, { code: 'slot_taken', message: 'The slot starting at that time is already booked.' }),
  );
  renderAt('/host/bookings');

  const slots = await openAnna();
  fireEvent.click(within(slots).getByRole('button', { name: 'Tue 24 Nov, 10:00 – 10:30' }));
  const loadsBefore = server.slotLoads;
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    'Someone else has just booked this time. Choose another one.',
  );
  await waitFor(() => expect(server.slotLoads).toBeGreaterThan(loadsBefore));
  const list = screen.getByRole('list', { name: 'Upcoming bookings' });
  expect(within(list).getAllByRole('listitem')[0]?.textContent).toContain(
    'Mon 23 Nov, 09:00 – 09:30',
  );
});

test('a booking that is gone shows that it does not exist', async () => {
  hostServer(() => json(404, { code: 'booking_not_found', message: 'No booking has the id.' }));
  renderAt('/host/bookings');

  const slots = await openAnna();
  fireEvent.click(within(slots).getByRole('button', { name: 'Tue 24 Nov, 12:00 – 12:30' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  expect((await screen.findByRole('alert')).textContent).toBe('This booking does not exist.');
});

test('the page offers no way to cancel or delete a booking', async () => {
  hostServer(() => json(200, anna));
  renderAt('/host/bookings');

  await openAnna();

  expect(screen.queryByRole('button', { name: /cancel|delete|remove/i })).toBeNull();
});
