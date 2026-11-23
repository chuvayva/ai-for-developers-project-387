import type { components } from '@calendar/api';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { intro, json, renderAt, shownSlots, stubApi } from '../testing.tsx';

// A guest looks at the days and slots on the booking page, `/book/:eventTypeId`.

type SlotDay = components['schemas']['SlotDay'];

const notFound = () =>
  json(404, { code: 'event_type_not_found', message: 'No event type has the id "evt_gone".' });

const originalZone = process.env.TZ;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalZone;
  }
});

// A booking window that starts on Monday 23 November 2026. Moscow is UTC+3.
const bookingWindow: SlotDay[] = [
  {
    date: '2026-11-23',
    slots: [
      { startTime: '2026-11-23T13:30:00Z', endTime: '2026-11-23T14:00:00Z' },
      { startTime: '2026-11-23T14:30:00Z', endTime: '2026-11-23T15:00:00Z' },
    ],
  },
  {
    date: '2026-11-24',
    slots: [{ startTime: '2026-11-24T06:00:00Z', endTime: '2026-11-24T06:30:00Z' }],
  },
  { date: '2026-11-25', slots: [] },
  ...['26', '27', '28', '29', '30'].map((day) => ({ date: `2026-11-${day}`, slots: [] })),
  ...['01', '02', '03', '04', '05', '06'].map((day) => ({ date: `2026-12-${day}`, slots: [] })),
];

function introApi(days: SlotDay[] = bookingWindow) {
  stubApi({
    'GET /api/event-types/evt_a': () => json(200, intro),
    'GET /api/event-types/evt_a/slots': () => json(200, days),
  });
}

test('the slots page shows the event type and the 14 days of the booking window', async () => {
  introApi();

  renderAt('/book/evt_a');

  expect(await screen.findByRole('heading', { name: 'Intro call', level: 1 })).toBeTruthy();
  expect(screen.getByText('30 min')).toBeTruthy();
  expect(screen.getByText('A short call to get acquainted.')).toBeTruthy();
  const days = within(screen.getByRole('list', { name: 'Days' })).getAllByRole('button');
  expect(days).toHaveLength(14);
  expect(days[0]?.textContent).toContain('Mon 23 Nov');
  expect(days[1]?.textContent).toContain('Tue 24 Nov');
  expect(days[8]?.textContent).toContain('Tue 1 Dec');
  expect(days[13]?.textContent).toContain('Sun 6 Dec');
});

test('the first day is chosen at the start, and its slots are shown in Moscow time', async () => {
  introApi();

  renderAt('/book/evt_a');

  const today = await screen.findByRole('button', { name: /Mon 23 Nov/ });
  expect(today.getAttribute('aria-pressed')).toBe('true');
  expect(shownSlots()).toEqual(['16:30 – 17:00', '17:30 – 18:00']);
});

test('choosing a day shows the slots of that day', async () => {
  introApi();
  renderAt('/book/evt_a');

  fireEvent.click(await screen.findByRole('button', { name: /Tue 24 Nov/ }));

  expect(shownSlots()).toEqual(['09:00 – 09:30']);
  expect(screen.getByRole('button', { name: /Tue 24 Nov/ }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(screen.getByRole('button', { name: /Mon 23 Nov/ }).getAttribute('aria-pressed')).toBe(
    'false',
  );
});

test('each day says how many slots it has, and a day with none is marked', async () => {
  introApi();

  renderAt('/book/evt_a');

  expect((await screen.findByRole('button', { name: /Mon 23 Nov/ })).textContent).toContain(
    '2 slots',
  );
  expect(screen.getByRole('button', { name: /Tue 24 Nov/ }).textContent).toContain('1 slot');
  expect(screen.getByRole('button', { name: /Wed 25 Nov/ }).textContent).toContain('No slots');
});

test('choosing a day with no slot says so', async () => {
  introApi();
  renderAt('/book/evt_a');

  fireEvent.click(await screen.findByRole('button', { name: /Wed 25 Nov/ }));

  expect(screen.getByText('There are no slots on this day.')).toBeTruthy();
  expect(screen.queryByRole('list', { name: 'Slots' })).toBeNull();
});

test('the times carry a visible Europe/Moscow label', async () => {
  introApi();

  renderAt('/book/evt_a');

  expect(await screen.findByText(/Europe\/Moscow/)).toBeTruthy();
});

test.each(['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC'])(
  'times and days are in Moscow time when the browser is in %s',
  async (zone) => {
    process.env.TZ = zone;
    // Proof that the zone of this process, which jsdom takes as the browser's, really changed.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    introApi();

    renderAt('/book/evt_a');

    const days = within(await screen.findByRole('list', { name: 'Days' })).getAllByRole('button');
    expect(days[0]?.textContent).toContain('Mon 23 Nov');
    expect(shownSlots()).toEqual(['16:30 – 17:00', '17:30 – 18:00']);
    fireEvent.click(screen.getByRole('button', { name: /Tue 24 Nov/ }));
    expect(shownSlots()).toEqual(['09:00 – 09:30']);
  },
);

test('an unknown event type shows a not found state', async () => {
  stubApi({
    'GET /api/event-types/evt_gone': notFound,
    'GET /api/event-types/evt_gone/slots': notFound,
  });

  renderAt('/book/evt_gone');

  expect(await screen.findByRole('heading', { name: 'Event type not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'See the event types' }).getAttribute('href')).toBe(
    '/book',
  );
  expect(screen.queryByRole('list', { name: 'Days' })).toBeNull();
});

test('the id in the address is sent to the server as one path segment', async () => {
  const requested: string[] = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    requested.push(new URL(request.url).pathname);
    return notFound();
  });

  renderAt('/book/a%2Fb%20c');

  await screen.findByRole('heading', { name: 'Event type not found' });
  expect(requested.toSorted()).toEqual([
    '/api/event-types/a%2Fb%20c',
    '/api/event-types/a%2Fb%20c/slots',
  ]);
});

test('the slots page says so when it cannot be loaded', async () => {
  stubApi({
    'GET /api/event-types/evt_a': () => json(200, intro),
    'GET /api/event-types/evt_a/slots': () => new Response('Bad gateway', { status: 502 }),
  });

  renderAt('/book/evt_a');

  expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Event type not found' })).toBeNull();
});
