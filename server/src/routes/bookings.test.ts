import type { FastifyInstance } from 'fastify';
import { expect, test } from 'vitest';
import { build } from '../app.ts';

// 05:00Z on Monday 23 November 2026 is 08:00 in Europe/Moscow.
const mondayMorning = () => new Date('2026-11-23T05:00:00Z');

async function createEventType(
  app: FastifyInstance,
  durationMinutes: number,
  name = 'Intro call',
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/event-types',
    payload: { name, description: 'A short call.', durationMinutes },
  });
  return response.json().id;
}

function createBooking(app: FastifyInstance, payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/bookings', payload: payload as object });
}

const anna = { guestName: 'Anna Petrova', guestEmail: 'anna@example.com' };

// The first slot of Monday, 09:00 in Moscow, booked by Anna.
const valid = { startTime: '2026-11-23T06:00:00Z', ...anna };

async function slotStarts(app: FastifyInstance, eventTypeId: string): Promise<string[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/event-types/${eventTypeId}/slots`,
  });
  const days: { slots: { startTime: string }[] }[] = response.json();
  return days.flatMap((day) => day.slots.map((slot) => slot.startTime));
}

test('booking a slot returns 201 with the booking', async () => {
  // The clock has milliseconds, and the contract writes whole seconds.
  const app = build({ now: () => new Date('2026-11-21T12:15:42.731Z') });
  const eventTypeId = await createEventType(app, 30);

  const response = await createBooking(app, {
    eventTypeId,
    startTime: '2026-11-23T06:00:00Z',
    ...anna,
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toEqual({
    id: expect.any(String),
    eventType: {
      id: eventTypeId,
      name: 'Intro call',
      description: 'A short call.',
      durationMinutes: 30,
    },
    startTime: '2026-11-23T06:00:00Z',
    endTime: '2026-11-23T06:30:00Z',
    guestName: 'Anna Petrova',
    guestEmail: 'anna@example.com',
    createdAt: '2026-11-21T12:15:42Z',
  });
  expect(response.json().id).not.toBe('');
});

test('a booked interval leaves the slots of every event type', async () => {
  const app = build({ now: mondayMorning });
  const halfHour = await createEventType(app, 30);
  const hour = await createEventType(app, 60, 'Long call');
  const twentyMinutes = await createEventType(app, 20, 'Short call');

  // 09:00 to 09:30 in Moscow.
  await createBooking(app, { eventTypeId: halfHour, ...valid });

  expect((await slotStarts(app, halfHour)).slice(0, 2)).toEqual([
    '2026-11-23T06:30:00Z',
    '2026-11-23T07:00:00Z',
  ]);
  expect((await slotStarts(app, hour)).slice(0, 2)).toEqual([
    '2026-11-23T07:00:00Z',
    '2026-11-23T08:00:00Z',
  ]);
  // 09:20 to 09:40 overlaps the booking, and 09:40 starts after it ends.
  expect((await slotStarts(app, twentyMinutes)).slice(0, 2)).toEqual([
    '2026-11-23T06:40:00Z',
    '2026-11-23T07:00:00Z',
  ]);
  // Only that one interval is gone: 14 days of 18 half-hour slots, less one.
  expect(await slotStarts(app, halfHour)).toHaveLength(14 * 18 - 1);
});

test('a slot that starts where a booking ends can be booked', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);
  await createBooking(app, { eventTypeId, ...valid });

  const response = await createBooking(app, {
    eventTypeId,
    ...anna,
    startTime: '2026-11-23T06:30:00Z',
  });

  expect(response.statusCode).toBe(201);
});

test('a start time with another offset books the moment it names', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);

  // Noon in Moscow, written with the Moscow offset.
  const response = await createBooking(app, {
    eventTypeId,
    ...anna,
    startTime: '2026-11-23T12:00:00+03:00',
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().startTime).toBe('2026-11-23T09:00:00Z');
  expect(response.json().endTime).toBe('2026-11-23T09:30:00Z');
  expect(await slotStarts(app, eventTypeId)).not.toContain('2026-11-23T09:00:00Z');
});

test('the guest name and email come back exactly as sent', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);

  const response = await createBooking(app, {
    eventTypeId,
    startTime: '2026-11-23T06:00:00Z',
    guestName: '  Anna  Petrova ',
    guestEmail: 'Anna.Petrova@Example.COM',
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().guestName).toBe('  Anna  Petrova ');
  expect(response.json().guestEmail).toBe('Anna.Petrova@Example.COM');
});

test('properties the contract does not name are ignored', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);

  const response = await createBooking(app, {
    eventTypeId,
    ...valid,
    endTime: '2026-11-23T09:00:00Z',
    id: 'bkg_mine',
    note: 'Call me',
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().endTime).toBe('2026-11-23T06:30:00Z');
  expect(response.json().id).not.toBe('bkg_mine');
  expect(response.json()).not.toHaveProperty('note');
});

test('a name of 100 characters and an email of 254 are accepted', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);
  const longEmail = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
  expect(longEmail).toHaveLength(254);

  const response = await createBooking(app, {
    eventTypeId,
    startTime: '2026-11-23T06:00:00Z',
    // A character outside the basic plane is one character, though two UTF-16 units.
    guestName: '😀'.repeat(100),
    guestEmail: longEmail,
  });

  expect(response.statusCode).toBe(201);
});

test.each([
  ['no event type id', { eventTypeId: undefined }],
  ['an event type id that is not a string', { eventTypeId: 7 }],
  ['no start time', { startTime: undefined }],
  ['a start time that is not a string', { startTime: 1795413600 }],
  ['a start time that is not a timestamp', { startTime: 'tomorrow at nine' }],
  ['a start time with no offset', { startTime: '2026-11-23T09:00:00' }],
  ['a start time that names no moment', { startTime: '2026-13-45T06:00:00Z' }],
  ['a plain date as the start time', { startTime: '2026-11-23' }],
  ['no guest name', { guestName: undefined }],
  ['an empty guest name', { guestName: '' }],
  ['a guest name of whitespace', { guestName: '   ' }],
  ['a guest name of 101 characters', { guestName: 'a'.repeat(101) }],
  ['a guest name that is not a string', { guestName: 5 }],
  ['no guest email', { guestEmail: undefined }],
  ['an empty guest email', { guestEmail: '' }],
  ['a guest email with no @', { guestEmail: 'anna.example.com' }],
  ['a guest email with a space', { guestEmail: 'anna petrova@example.com' }],
  ['a guest email of 255 characters', { guestEmail: `${'a'.repeat(243)}@example.com` }],
  ['a guest email that is not a string', { guestEmail: 5 }],
])('%s is 400 validation_failed', async (_case, changed) => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);

  const response = await createBooking(app, { eventTypeId, ...valid, ...changed });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
  // Nothing was booked.
  expect(await slotStarts(app, eventTypeId)).toHaveLength(14 * 18);
});

test('a body that is not parsable JSON is 400 validation_failed', async () => {
  const app = build({ now: mondayMorning });

  const response = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { 'content-type': 'application/json' },
    payload: '{"eventTypeId": ',
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});

test('an unknown event type is 404 event_type_not_found', async () => {
  const app = build({ now: mondayMorning });

  const response = await createBooking(app, { eventTypeId: 'evt_missing', ...valid });

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ code: 'event_type_not_found', message: expect.any(String) });
});

test.each([
  ['off the step', '2026-11-23T06:10:00Z'],
  ['before working hours', '2026-11-23T05:30:00Z'],
  ['at the end of working hours', '2026-11-23T15:00:00Z'],
  ['already passed', '2026-11-22T06:00:00Z'],
  ['on the day after the booking window', '2026-12-07T06:00:00Z'],
  ['with a fractional second', '2026-11-23T06:00:00.500Z'],
  ['with a second off the step', '2026-11-23T06:00:01Z'],
])('a start time %s is 400 not_a_slot', async (_case, startTime) => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);

  const response = await createBooking(app, { eventTypeId, ...anna, startTime });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'not_a_slot', message: expect.any(String) });
  expect(await slotStarts(app, eventTypeId)).toHaveLength(14 * 18);
});

test('a slot can be booked until the moment it starts', async () => {
  let now = new Date('2026-11-23T05:59:59Z');
  const app = build({ now: () => now });
  const eventTypeId = await createEventType(app, 30);

  const before = await createBooking(app, { eventTypeId, ...valid });
  now = new Date('2026-11-23T06:30:00Z');
  const atTheStart = await createBooking(app, {
    eventTypeId,
    ...anna,
    startTime: '2026-11-23T06:30:00Z',
  });

  expect(before.statusCode).toBe(201);
  expect(atTheStart.statusCode).toBe(400);
  expect(atTheStart.json().code).toBe('not_a_slot');
});

test('the last slot of the booking window can be booked', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);

  // 17:30 in Moscow on the 14th day.
  const response = await createBooking(app, {
    eventTypeId,
    ...anna,
    startTime: '2026-12-06T14:30:00Z',
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().endTime).toBe('2026-12-06T15:00:00Z');
});

test('a booked slot is 409 slot_taken', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);
  await createBooking(app, { eventTypeId, ...valid });

  const response = await createBooking(app, {
    eventTypeId,
    ...valid,
    guestName: 'Boris',
    guestEmail: 'boris@example.com',
  });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toEqual({ code: 'slot_taken', message: expect.any(String) });
});

test('a slot that overlaps a booking of another event type is 409 slot_taken', async () => {
  const app = build({ now: mondayMorning });
  const halfHour = await createEventType(app, 30);
  const hour = await createEventType(app, 60, 'Long call');
  // 09:30 to 10:00 in Moscow, inside the first hour.
  await createBooking(app, { eventTypeId: halfHour, ...anna, startTime: '2026-11-23T06:30:00Z' });

  const response = await createBooking(app, { eventTypeId: hour, ...valid });

  expect(response.statusCode).toBe(409);
  expect(response.json().code).toBe('slot_taken');
});

// The check order: validation, unknown event type, not a slot, conflict.

test('a bad field with an unknown event type is validation_failed', async () => {
  const app = build({ now: mondayMorning });

  const response = await createBooking(app, {
    eventTypeId: 'evt_missing',
    ...valid,
    guestEmail: 'not an email',
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().code).toBe('validation_failed');
});

test('an unknown event type with a start time that is no slot is event_type_not_found', async () => {
  const app = build({ now: mondayMorning });

  const response = await createBooking(app, {
    eventTypeId: 'evt_missing',
    ...anna,
    startTime: '2026-11-23T06:10:00Z',
  });

  expect(response.statusCode).toBe(404);
  expect(response.json().code).toBe('event_type_not_found');
});

test('a start time that is no slot and overlaps a booking is not_a_slot', async () => {
  let now = mondayMorning();
  const app = build({ now: () => now });
  const eventTypeId = await createEventType(app, 30);
  await createBooking(app, { eventTypeId, ...valid });

  const offTheStep = await createBooking(app, {
    eventTypeId,
    ...anna,
    startTime: '2026-11-23T06:10:00Z',
  });
  // The booked slot has started by now.
  now = new Date('2026-11-23T06:05:00Z');
  const passed = await createBooking(app, { eventTypeId, ...valid });

  expect(offTheStep.statusCode).toBe(400);
  expect(offTheStep.json().code).toBe('not_a_slot');
  expect(passed.statusCode).toBe(400);
  expect(passed.json().code).toBe('not_a_slot');
});

test('of overlapping bookings sent together exactly one succeeds', async () => {
  const app = build({ now: mondayMorning });
  const halfHour = await createEventType(app, 30);
  const hour = await createEventType(app, 60, 'Long call');
  const twentyMinutes = await createEventType(app, 20, 'Short call');
  const fiveMinutes = await createEventType(app, 5, 'Check-in');

  // Every interval covers 09:20 to 09:25 in Moscow, so each pair overlaps.
  const attempts = [
    { eventTypeId: halfHour, startTime: '2026-11-23T06:00:00Z' },
    { eventTypeId: halfHour, startTime: '2026-11-23T06:00:00Z' },
    { eventTypeId: hour, startTime: '2026-11-23T06:00:00Z' },
    { eventTypeId: hour, startTime: '2026-11-23T09:00:00+03:00' },
    { eventTypeId: twentyMinutes, startTime: '2026-11-23T06:20:00Z' },
    { eventTypeId: fiveMinutes, startTime: '2026-11-23T06:20:00Z' },
    { eventTypeId: halfHour, startTime: '2026-11-23T06:00:00Z' },
    { eventTypeId: twentyMinutes, startTime: '2026-11-23T06:20:00Z' },
  ];
  const responses = await Promise.all(
    attempts.map((attempt) => createBooking(app, { ...attempt, ...anna })),
  );

  const statuses = responses.map((response) => response.statusCode);
  expect(statuses.filter((status) => status === 201)).toHaveLength(1);
  expect(statuses.filter((status) => status === 409)).toHaveLength(attempts.length - 1);
  const refused = responses.filter((response) => response.statusCode !== 201);
  expect(refused.map((response) => response.json().code)).toEqual(refused.map(() => 'slot_taken'));

  // Only the interval of the one booking is taken, so no second booking was stored.
  const booked = responses.find((response) => response.statusCode === 201)?.json();
  const minutesBooked = (Date.parse(booked.endTime) - Date.parse(booked.startTime)) / 60_000;
  const fiveMinuteSlotsADay = 108;
  expect(await slotStarts(app, fiveMinutes)).toHaveLength(
    14 * fiveMinuteSlotsADay - minutesBooked / 5,
  );
});

function listBookings(app: FastifyInstance) {
  return app.inject({ method: 'GET', url: '/api/bookings' });
}

async function upcomingStarts(app: FastifyInstance): Promise<string[]> {
  const bookings: { startTime: string }[] = (await listBookings(app)).json();
  return bookings.map((booking) => booking.startTime);
}

test('listing the bookings returns an empty list when there are none', async () => {
  const app = build({ now: mondayMorning });

  const response = await listBookings(app);

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([]);
});

test('listing the bookings returns each upcoming booking in full', async () => {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, 30);
  const created = await createBooking(app, { eventTypeId, ...valid });

  const response = await listBookings(app);

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([
    {
      id: created.json().id,
      eventType: {
        id: eventTypeId,
        name: 'Intro call',
        description: 'A short call.',
        durationMinutes: 30,
      },
      startTime: '2026-11-23T06:00:00Z',
      endTime: '2026-11-23T06:30:00Z',
      guestName: 'Anna Petrova',
      guestEmail: 'anna@example.com',
      createdAt: '2026-11-23T05:00:00Z',
    },
  ]);
});

test('the upcoming bookings are ordered by start time, whatever the order of booking', async () => {
  const app = build({ now: mondayMorning });
  const halfHour = await createEventType(app, 30);
  const hour = await createEventType(app, 60, 'Long call');

  await createBooking(app, { eventTypeId: halfHour, ...anna, startTime: '2026-11-25T06:00:00Z' });
  await createBooking(app, { eventTypeId: hour, ...anna, startTime: '2026-11-23T10:00:00Z' });
  await createBooking(app, { eventTypeId: halfHour, ...anna, startTime: '2026-11-24T06:00:00Z' });
  await createBooking(app, { eventTypeId: halfHour, ...anna, startTime: '2026-11-23T06:00:00Z' });

  expect(await upcomingStarts(app)).toEqual([
    '2026-11-23T06:00:00Z',
    '2026-11-23T10:00:00Z',
    '2026-11-24T06:00:00Z',
    '2026-11-25T06:00:00Z',
  ]);
});

test('a booking stays on the list while its call is in progress and leaves when it ends', async () => {
  let now = mondayMorning();
  const app = build({ now: () => now });
  const eventTypeId = await createEventType(app, 30);
  // 09:00 to 09:30 and 09:30 to 10:00 in Moscow.
  const first = '2026-11-23T06:00:00Z';
  const second = '2026-11-23T06:30:00Z';
  await createBooking(app, { eventTypeId, ...anna, startTime: first });
  await createBooking(app, { eventTypeId, ...anna, startTime: second });

  // The first call has just started.
  now = new Date('2026-11-23T06:00:00Z');
  expect(await upcomingStarts(app)).toEqual([first, second]);

  // One second before the first call ends.
  now = new Date('2026-11-23T06:29:59Z');
  expect(await upcomingStarts(app)).toEqual([first, second]);

  // The first call ends at this moment, so it is no longer upcoming.
  now = new Date('2026-11-23T06:30:00Z');
  expect(await upcomingStarts(app)).toEqual([second]);

  now = new Date('2026-11-23T07:00:00Z');
  expect(await upcomingStarts(app)).toEqual([]);
});

function reschedule(app: FastifyInstance, bookingId: string, payload: unknown) {
  return app.inject({
    method: 'PATCH',
    url: `/api/bookings/${bookingId}`,
    payload: payload as object,
  });
}

async function bookedApp(durationMinutes = 30) {
  const app = build({ now: mondayMorning });
  const eventTypeId = await createEventType(app, durationMinutes);
  const created = await createBooking(app, { eventTypeId, ...valid });
  return { app, eventTypeId, booking: created.json() };
}

test('rescheduling to a free slot keeps the identity and moves the interval', async () => {
  const { app, booking } = await bookedApp();

  const response = await reschedule(app, booking.id, { startTime: '2026-11-23T07:00:00Z' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    ...booking,
    startTime: '2026-11-23T07:00:00Z',
    endTime: '2026-11-23T07:30:00Z',
  });
  const list = await app.inject({ method: 'GET', url: '/api/bookings' });
  expect(list.json()).toEqual([response.json()]);
});

test('rescheduling to another event type recomputes the end', async () => {
  const { app, booking } = await bookedApp(30);
  const hourId = await createEventType(app, 60, 'Long call');

  const response = await reschedule(app, booking.id, {
    startTime: '2026-11-23T07:00:00Z',
    eventTypeId: hourId,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    id: booking.id,
    eventType: { id: hourId, durationMinutes: 60 },
    startTime: '2026-11-23T07:00:00Z',
    endTime: '2026-11-23T08:00:00Z',
  });
});

test('the own interval is free: the type changes at the same time', async () => {
  const { app, booking } = await bookedApp(30);
  const hourId = await createEventType(app, 60, 'Long call');

  const response = await reschedule(app, booking.id, {
    startTime: booking.startTime,
    eventTypeId: hourId,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().endTime).toBe('2026-11-23T07:00:00Z');
});

test('a shift inside the own interval is not a conflict', async () => {
  // 15-minute steps of a 15-minute type overlap a 30-minute booking's interval.
  const { app, booking } = await bookedApp(30);
  const quarterId = await createEventType(app, 15, 'Quick call');

  const response = await reschedule(app, booking.id, {
    startTime: '2026-11-23T06:15:00Z',
    eventTypeId: quarterId,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().startTime).toBe('2026-11-23T06:15:00Z');
});

test('the old interval is a slot again after a reschedule', async () => {
  const { app, eventTypeId, booking } = await bookedApp();
  expect(await slotStarts(app, eventTypeId)).not.toContain(booking.startTime);

  await reschedule(app, booking.id, { startTime: '2026-11-23T07:00:00Z' });

  const starts = await slotStarts(app, eventTypeId);
  expect(starts).toContain(booking.startTime);
  expect(starts).not.toContain('2026-11-23T07:00:00Z');
});

test.each([
  ['a missing startTime', {}],
  ['a startTime that is not a date', { startTime: 'soon' }],
  ['an eventTypeId that is not a string', { startTime: '2026-11-23T07:00:00Z', eventTypeId: 5 }],
])('%s fails with validation_failed before the booking is looked up', async (_name, payload) => {
  const { app } = await bookedApp();

  const response = await reschedule(app, 'bkg_missing', payload);

  expect(response.statusCode).toBe(400);
  expect(response.json().code).toBe('validation_failed');
});

test('an unknown booking fails with booking_not_found before the event type is looked up', async () => {
  const { app } = await bookedApp();

  const response = await reschedule(app, 'bkg_missing', {
    startTime: '2026-11-23T07:00:00Z',
    eventTypeId: 'evt_missing',
  });

  expect(response.statusCode).toBe(404);
  expect(response.json().code).toBe('booking_not_found');
});

test.each([
  ['event_type_not_found', 404, { startTime: '2026-11-23T05:30:00Z', eventTypeId: 'evt_missing' }],
  ['not_a_slot', 400, { startTime: '2026-11-23T06:07:00Z' }],
  ['slot_taken', 409, { startTime: '2026-11-23T07:00:00Z' }],
])('%s leaves the booking and the slots unchanged', async (code, status, payload) => {
  const { app, eventTypeId, booking } = await bookedApp();
  const other = await createBooking(app, {
    eventTypeId,
    startTime: '2026-11-23T07:00:00Z',
    ...anna,
  });
  const slotsBefore = await slotStarts(app, eventTypeId);
  const listBefore = (await app.inject({ method: 'GET', url: '/api/bookings' })).json();

  const response = await reschedule(app, booking.id, payload);

  expect(response.statusCode).toBe(status);
  expect(response.json().code).toBe(code);
  expect(other.statusCode).toBe(201);
  expect(await slotStarts(app, eventTypeId)).toEqual(slotsBefore);
  expect((await app.inject({ method: 'GET', url: '/api/bookings' })).json()).toEqual(listBefore);
});

test('a missing event type is reported before a start time that is not a slot', async () => {
  const { app, booking } = await bookedApp();

  const response = await reschedule(app, booking.id, {
    startTime: '2026-11-23T06:07:00Z',
    eventTypeId: 'evt_missing',
  });

  expect(response.json().code).toBe('event_type_not_found');
});

test('two simultaneous reschedules to the same slot leave one winner', async () => {
  const { app, eventTypeId, booking } = await bookedApp();
  const second = (
    await createBooking(app, { eventTypeId, startTime: '2026-11-23T08:00:00Z', ...anna })
  ).json();

  const responses = await Promise.all([
    reschedule(app, booking.id, { startTime: '2026-11-23T09:00:00Z' }),
    reschedule(app, second.id, { startTime: '2026-11-23T09:00:00Z' }),
  ]);

  expect(responses.map((r) => r.statusCode).toSorted()).toEqual([200, 409]);
});
