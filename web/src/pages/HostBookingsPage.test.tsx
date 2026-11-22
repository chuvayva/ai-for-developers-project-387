import type { components } from '@calendar/api';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { intro, json, renderAt, review, stubApi } from '../testing.tsx';

type Booking = components['schemas']['Booking'];

/** A server that answers `listBookings` only. */
function fakeServer(list: () => Response) {
  stubApi({ 'GET /api/bookings': list });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Moscow is UTC+3, so 06:00Z on Monday 23 November 2026 is 09:00 there.
const annaOnMonday: Booking = {
  id: 'bkg_1',
  eventType: intro,
  startTime: '2026-11-23T06:00:00Z',
  endTime: '2026-11-23T06:30:00Z',
  guestName: 'Anna Petrova',
  guestEmail: 'anna@example.com',
  createdAt: '2026-11-21T12:15:42Z',
};
// 21:30Z on Monday is 00:30 on Tuesday in Moscow. No slot starts then, and the
// time shows which zone the page writes in.
const borisOnTuesday: Booking = {
  id: 'bkg_2',
  eventType: review,
  startTime: '2026-11-23T21:30:00Z',
  endTime: '2026-11-23T22:15:00Z',
  guestName: 'Boris Ivanov',
  guestEmail: 'boris@example.com',
  createdAt: '2026-11-21T12:20:00Z',
};

test('the page lists the upcoming bookings in the order the server returns them', async () => {
  fakeServer(() => json(200, [annaOnMonday, borisOnTuesday]));

  renderAt('/host/bookings');

  const list = await screen.findByRole('list', { name: 'Upcoming bookings' });
  const [first, second] = within(list).getAllByRole('listitem');
  expect(within(first!).getByRole('heading', { name: 'Intro call' })).toBeTruthy();
  expect(within(first!).getByText('Mon 23 Nov, 09:00 – 09:30')).toBeTruthy();
  expect(within(first!).getByText('Anna Petrova')).toBeTruthy();
  expect(within(first!).getByText('anna@example.com')).toBeTruthy();
  expect(within(second!).getByRole('heading', { name: 'Code review' })).toBeTruthy();
  expect(within(second!).getByText('Tue 24 Nov, 00:30 – 01:15')).toBeTruthy();
  expect(within(second!).getByText('Boris Ivanov')).toBeTruthy();
  expect(within(second!).getByText('boris@example.com')).toBeTruthy();
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);
});

test('the page says which time zone the times are in', async () => {
  fakeServer(() => json(200, [annaOnMonday]));

  renderAt('/host/bookings');

  await screen.findByRole('list', { name: 'Upcoming bookings' });
  expect(screen.getByText(/Europe\/Moscow/)).toBeTruthy();
});

test('the page says so when there are no upcoming bookings', async () => {
  fakeServer(() => json(200, []));

  renderAt('/host/bookings');

  expect(await screen.findByText('No upcoming bookings.')).toBeTruthy();
  expect(screen.queryByRole('list', { name: 'Upcoming bookings' })).toBeNull();
});

test('the page does not claim there are no bookings while it is loading', async () => {
  let answer: ((response: Response) => void) | undefined;
  const pending = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  vi.stubGlobal('fetch', () => pending);

  renderAt('/host/bookings');

  expect(screen.getByText('Loading the bookings.')).toBeTruthy();
  expect(screen.queryByText('No upcoming bookings.')).toBeNull();

  answer?.(json(200, []));
  expect(await screen.findByText('No upcoming bookings.')).toBeTruthy();
  expect(screen.queryByText('Loading the bookings.')).toBeNull();
});

test('the page says so when the bookings cannot be loaded', async () => {
  fakeServer(() => new Response('Bad gateway', { status: 502 }));

  renderAt('/host/bookings');

  expect(await screen.findByText('The bookings could not be loaded.')).toBeTruthy();
  expect(screen.queryByText('No upcoming bookings.')).toBeNull();
});

test('the home page links to the upcoming bookings', async () => {
  fakeServer(() => json(200, []));
  renderAt('/');

  const link = screen.getByRole('link', { name: 'Upcoming bookings' });
  expect(link.getAttribute('href')).toBe('/host/bookings');
  fireEvent.click(link);

  expect(screen.getByRole('heading', { name: 'Upcoming bookings' })).toBeTruthy();
  expect(await screen.findByText('No upcoming bookings.')).toBeTruthy();
});
