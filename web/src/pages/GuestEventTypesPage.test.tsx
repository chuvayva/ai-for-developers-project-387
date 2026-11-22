import type { components } from '@calendar/api';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { intro, json, renderAt, review, shownSlots, stubApi } from '../testing.tsx';

// A guest chooses an event type on the guest event types page, `/book`.

type SlotDay = components['schemas']['SlotDay'];

afterEach(() => {
  vi.unstubAllGlobals();
});

// Monday 23 November 2026, the first day of a booking window. Moscow is UTC+3.
const monday: SlotDay = {
  date: '2026-11-23',
  slots: [
    { startTime: '2026-11-23T13:30:00Z', endTime: '2026-11-23T14:00:00Z' },
    { startTime: '2026-11-23T14:30:00Z', endTime: '2026-11-23T15:00:00Z' },
  ],
};

test('the guest sees the event types with name, description and duration', async () => {
  stubApi({ 'GET /api/event-types': () => json(200, [review, intro]) });

  renderAt('/book');

  const list = await screen.findByRole('list', { name: 'Event types' });
  const items = within(list).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]?.textContent).toContain('Code review');
  expect(items[0]?.textContent).toContain('45 min');
  expect(items[1]?.textContent).toContain('Intro call');
  expect(items[1]?.textContent).toContain('30 min');
  expect(items[1]?.textContent).toContain('A short call to get acquainted.');
});

test('each event type leads to its slots', async () => {
  stubApi({ 'GET /api/event-types': () => json(200, [review, intro]) });

  renderAt('/book');

  const link = await screen.findByRole('link', { name: 'Intro call' });
  expect(link.getAttribute('href')).toBe('/book/evt_a');
});

test('the guest is told when there are no event types', async () => {
  stubApi({ 'GET /api/event-types': () => json(200, []) });

  renderAt('/book');

  expect(await screen.findByText('There are no event types to book yet.')).toBeTruthy();
  expect(screen.queryByRole('list', { name: 'Event types' })).toBeNull();
});

test('the guest is told when the event types cannot be loaded', async () => {
  stubApi({ 'GET /api/event-types': () => new Response('Bad gateway', { status: 502 }) });

  renderAt('/book');

  expect(await screen.findByText('The event types could not be loaded.')).toBeTruthy();
});

test('the guest goes from the home page to an event type and its slots', async () => {
  stubApi({
    'GET /api/event-types': () => json(200, [intro]),
    'GET /api/event-types/evt_a': () => json(200, intro),
    'GET /api/event-types/evt_a/slots': () => json(200, [monday]),
  });
  renderAt('/');

  fireEvent.click(screen.getByRole('link', { name: 'Book a call' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Intro call' }));

  expect(await screen.findByRole('heading', { name: 'Intro call', level: 1 })).toBeTruthy();
  expect(shownSlots()).toEqual(['16:30 – 17:00', '17:30 – 18:00']);
});
