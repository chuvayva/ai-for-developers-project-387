import type { FastifyInstance } from 'fastify';
import { expect, test } from 'vitest';
import { build } from '../app.ts';

// 05:00Z on Monday 23 November 2026 is 08:00 in Europe/Moscow.
const mondayMorning = () => new Date('2026-11-23T05:00:00Z');

async function createEventType(app: FastifyInstance, durationMinutes: number): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/event-types',
    payload: { name: 'Intro call', durationMinutes },
  });
  return response.json().id;
}

function listSlots(app: FastifyInstance, eventTypeId: string) {
  return app.inject({ method: 'GET', url: `/api/event-types/${eventTypeId}/slots` });
}

test('the slots of an event type cover 14 days in order, starting with today', async () => {
  const app = build({ now: mondayMorning });
  const id = await createEventType(app, 60);

  const response = await listSlots(app, id);

  expect(response.statusCode).toBe(200);
  const days: { date: string; slots: unknown[] }[] = response.json();
  expect(days.map((day) => day.date)).toEqual([
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-28',
    '2026-11-29',
    '2026-11-30',
    '2026-12-01',
    '2026-12-02',
    '2026-12-03',
    '2026-12-04',
    '2026-12-05',
    '2026-12-06',
  ]);
  expect(days.map((day) => day.slots.length)).toEqual([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]);
});

test('slots follow the duration of the event type, in UTC with whole seconds', async () => {
  const app = build({ now: mondayMorning });
  const id = await createEventType(app, 270);

  const response = await listSlots(app, id);

  expect(response.json()[0]).toEqual({
    date: '2026-11-23',
    slots: [
      { startTime: '2026-11-23T06:00:00Z', endTime: '2026-11-23T10:30:00Z' },
      { startTime: '2026-11-23T10:30:00Z', endTime: '2026-11-23T15:00:00Z' },
    ],
  });
});

test('a day with no slot is present with an empty list', async () => {
  // 15:30Z is 18:30 in Moscow, after working hours.
  const app = build({ now: () => new Date('2026-11-23T15:30:00Z') });
  const id = await createEventType(app, 60);

  const response = await listSlots(app, id);

  const days = response.json();
  expect(days).toHaveLength(14);
  expect(days[0]).toEqual({ date: '2026-11-23', slots: [] });
  expect(days[1].date).toBe('2026-11-24');
  expect(days[1].slots).toHaveLength(9);
});

test('the clock is read on every request', async () => {
  let now = new Date('2026-11-23T05:00:00Z');
  const app = build({ now: () => now });
  const id = await createEventType(app, 60);
  const before = await listSlots(app, id);

  now = new Date('2026-11-23T06:00:01Z');
  const after = await listSlots(app, id);

  expect(before.json()[0].slots[0].startTime).toBe('2026-11-23T06:00:00Z');
  expect(after.json()[0].slots[0].startTime).toBe('2026-11-23T07:00:00Z');
});

test('without a clock option the window starts today', async () => {
  const app = build();
  const id = await createEventType(app, 60);

  const response = await listSlots(app, id);

  // The en-CA locale writes a date as 2026-11-23.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
  expect(response.json()).toHaveLength(14);
  expect(response.json()[0].date).toBe(today);
});

test('the slots of an unknown event type are 404 event_type_not_found', async () => {
  const app = build({ now: mondayMorning });

  const response = await listSlots(app, 'evt_missing');

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ code: 'event_type_not_found', message: expect.any(String) });
});

test('an id of any length is a legal id', async () => {
  const app = build({ now: mondayMorning });

  const response = await listSlots(app, 'x'.repeat(500));

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ code: 'event_type_not_found', message: expect.any(String) });
});

test('an id that is not a valid URL component is 400 validation_failed', async () => {
  const app = build({ now: mondayMorning });

  const response = await listSlots(app, '%zz');

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});
