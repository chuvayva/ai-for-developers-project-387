import type { components } from '@calendar/api';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { intro, json, renderAt, shownSlots, stubApi } from '../testing.tsx';

// A guest books a slot on the booking page, `/book/:eventTypeId`.

type Booking = components['schemas']['Booking'];
type SlotDay = components['schemas']['SlotDay'];

// A booking window that starts on Monday 23 November 2026. Moscow is UTC+3.
const laterDays: SlotDay[] = [
  ...['25', '26', '27', '28', '29', '30'].map((day) => ({ date: `2026-11-${day}`, slots: [] })),
  ...['01', '02', '03', '04', '05', '06'].map((day) => ({ date: `2026-12-${day}`, slots: [] })),
];
const afternoon = { startTime: '2026-11-23T13:30:00Z', endTime: '2026-11-23T14:00:00Z' };
const evening = { startTime: '2026-11-23T14:30:00Z', endTime: '2026-11-23T15:00:00Z' };
const tuesdayMorning = { startTime: '2026-11-24T06:00:00Z', endTime: '2026-11-24T06:30:00Z' };

function bookingWindow(monday: SlotDay['slots'], tuesday: SlotDay['slots']): SlotDay[] {
  return [
    { date: '2026-11-23', slots: monday },
    { date: '2026-11-24', slots: tuesday },
    ...laterDays,
  ];
}

const allSlots = bookingWindow([afternoon, evening], [tuesdayMorning]);

const annaAtTuesday: Booking = {
  id: 'bkg_1',
  eventType: intro,
  ...tuesdayMorning,
  guestName: 'Anna Petrova',
  guestEmail: 'anna@example.com',
  createdAt: '2026-11-21T12:15:42Z',
};

const slotTaken = () =>
  json(409, { code: 'slot_taken', message: 'The slot starting at that time is already booked.' });

type Server = {
  /**
   * What `listSlots` answers now. A test changes it to stand for another guest's
   * booking, or to `undefined` to make the request fail.
   */
  days: SlotDay[] | undefined;
  /** What `createBooking` answers. */
  book: () => Response;
  /** The bodies of the `createBooking` requests, in order. */
  sent: unknown[];
  /** How many times the slots were asked for. */
  slotLoads: number;
};

/** A server with one event type, whose slots and booking answer a test can change. */
function fakeServer(book: () => Response = () => json(201, annaAtTuesday)): Server {
  const server: Server = { days: allSlots, book, sent: [], slotLoads: 0 };

  stubApi({
    'GET /api/event-types/evt_a': () => json(200, intro),
    'GET /api/event-types/evt_a/slots': () => {
      server.slotLoads += 1;
      return server.days ? json(200, server.days) : new Response('Bad gateway', { status: 502 });
    },
    'POST /api/bookings': (body) => {
      server.sent.push(body);
      return server.book();
    },
  });

  return server;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderBookingPage() {
  renderAt('/book/evt_a');
}

async function chooseTuesdayMorning() {
  fireEvent.click(await screen.findByRole('button', { name: /Tue 24 Nov/ }));
  fireEvent.click(screen.getByRole('button', { name: '09:00 – 09:30' }));
}

function fillIn(name: string, email: string) {
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: email } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Book' }));
}

test('the guest picks a slot, gives a name and an email and sees the confirmation', async () => {
  const server = fakeServer();
  renderBookingPage();

  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');
  submit();

  const confirmation = await screen.findByRole('region', { name: 'Booking confirmed' });
  expect(server.sent).toEqual([
    {
      eventTypeId: 'evt_a',
      startTime: '2026-11-24T06:00:00Z',
      guestName: 'Anna Petrova',
      guestEmail: 'anna@example.com',
    },
  ]);
  expect(confirmation.textContent).toContain('Intro call');
  expect(confirmation.textContent).toContain('Tue 24 Nov, 09:00 – 09:30');
  expect(confirmation.textContent).toContain('Europe/Moscow');
  expect(confirmation.textContent).toContain('Anna Petrova');
  expect(confirmation.textContent).toContain('anna@example.com');
  // The slots give way to the confirmation.
  expect(screen.queryByRole('list', { name: 'Slots' })).toBeNull();
});

test('the form appears only once a slot is chosen', async () => {
  fakeServer();
  renderBookingPage();

  await screen.findByRole('list', { name: 'Slots' });
  expect(screen.queryByRole('button', { name: 'Book' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '16:30 – 17:00' }));

  expect(screen.getByRole('button', { name: 'Book' })).toBeTruthy();
  expect(screen.getByText('Mon 23 Nov, 16:30 – 17:00')).toBeTruthy();
  expect(screen.getByRole('button', { name: '16:30 – 17:00' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
});

test('after a booking the slot list is fresh and the booked slot is gone', async () => {
  const server = fakeServer(() => {
    server.days = bookingWindow([afternoon, evening], []);
    return json(201, annaAtTuesday);
  });
  renderBookingPage();
  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');
  submit();
  await screen.findByRole('region', { name: 'Booking confirmed' });

  fireEvent.click(screen.getByRole('button', { name: 'Book another time' }));

  // The day the guest chose is still chosen.
  expect(await screen.findByText('There are no slots on this day.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Tue 24 Nov/ }).textContent).toContain('No slots');
  expect(screen.queryByRole('button', { name: 'Book' })).toBeNull();
  expect(server.slotLoads).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: /Mon 23 Nov/ }));
  expect(shownSlots()).toEqual(['16:30 – 17:00', '17:30 – 18:00']);
});

test('the name and the email are sent exactly as typed', async () => {
  const server = fakeServer();
  renderBookingPage();
  await chooseTuesdayMorning();

  fillIn(`  ${'я'.repeat(96)}  `, 'Anna.Petrova@Example.COM');
  submit();

  await screen.findByRole('region', { name: 'Booking confirmed' });
  expect(server.sent).toEqual([
    {
      eventTypeId: 'evt_a',
      startTime: '2026-11-24T06:00:00Z',
      guestName: `  ${'я'.repeat(96)}  `,
      guestEmail: 'Anna.Petrova@Example.COM',
    },
  ]);
});

test.each([
  ['', 'anna@example.com', 'Enter your name.'],
  ['   ', 'anna@example.com', 'Enter your name.'],
  ['a'.repeat(101), 'anna@example.com', 'The name can be at most 100 characters.'],
  ['Anna', '', 'Enter your email.'],
  ['Anna', 'anna.example.com', 'Enter an email such as anna@example.com.'],
  ['Anna', 'anna petrova@example.com', 'Enter an email such as anna@example.com.'],
  ['Anna', 'anna@example', 'Enter an email such as anna@example.com.'],
  ['Anna', `${'a'.repeat(243)}@example.com`, 'The email can be at most 254 characters.'],
])('the form holds back the name %j with the email %j', async (name, email, message) => {
  const server = fakeServer();
  renderBookingPage();
  await chooseTuesdayMorning();

  fillIn(name, email);
  submit();

  expect(await screen.findByText(message)).toBeTruthy();
  expect(server.sent).toEqual([]);
  expect(screen.queryByRole('region', { name: 'Booking confirmed' })).toBeNull();
});

test.each([
  ['slot_taken', 409, 'Someone else has just booked this time. Choose another one.'],
  ['not_a_slot', 400, 'This time cannot be booked. Choose another one.'],
])('after %s the guest sees its message and a fresh slot list', async (code, status, message) => {
  const server = fakeServer(() => {
    // By now the server offers other slots than the page shows.
    server.days = bookingWindow([afternoon], [evening]);
    // The wording of `message` is the server's own and must not reach the guest.
    return json(status, { code, message: 'A sentence for developers.' });
  });
  server.days = bookingWindow([afternoon, evening], [tuesdayMorning]);
  renderBookingPage();
  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');

  submit();

  expect((await screen.findByRole('alert')).textContent).toBe(message);
  expect(screen.queryByText('A sentence for developers.')).toBeNull();
  // Tuesday is still the chosen day, now with the slots of the second answer.
  await waitFor(() => expect(shownSlots()).toEqual(['17:30 – 18:00']));
  expect(server.slotLoads).toBe(2);
  // The lost slot is no longer chosen, so the form is gone.
  expect(screen.queryByRole('button', { name: 'Book' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Booking confirmed' })).toBeNull();
});

test('when the reload after a conflict fails the stale slots give way to the failure', async () => {
  const server = fakeServer(() => {
    server.days = undefined;
    return slotTaken();
  });
  renderBookingPage();
  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');

  submit();

  expect(await screen.findByText('The slots could not be loaded.')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toBe(
    'Someone else has just booked this time. Choose another one.',
  );
  expect(screen.queryByRole('list', { name: 'Slots' })).toBeNull();
  expect(screen.queryByRole('list', { name: 'Days' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Book' })).toBeNull();
});

test('when the reload after a booking fails the confirmation stays', async () => {
  const server = fakeServer(() => {
    server.days = undefined;
    return json(201, annaAtTuesday);
  });
  renderBookingPage();
  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');

  submit();

  await screen.findByRole('region', { name: 'Booking confirmed' });
  await waitFor(() => expect(server.slotLoads).toBe(2));
  expect(screen.getByRole('region', { name: 'Booking confirmed' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Book another time' }));

  expect(await screen.findByText('The slots could not be loaded.')).toBeTruthy();
  expect(screen.queryByRole('list', { name: 'Slots' })).toBeNull();
});

test('choosing another slot after a conflict clears the message', async () => {
  const server = fakeServer(() => {
    server.days = bookingWindow([afternoon, evening], []);
    return slotTaken();
  });
  renderBookingPage();
  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');
  submit();
  await screen.findByRole('alert');

  fireEvent.click(screen.getByRole('button', { name: /Mon 23 Nov/ }));
  fireEvent.click(screen.getByRole('button', { name: '16:30 – 17:00' }));

  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Book' })).toBeTruthy();
});

test('another failure is shown by its code and leaves the form and the slots as they are', async () => {
  const server = fakeServer(() =>
    json(400, { code: 'validation_failed', message: 'body/guestEmail must match format "email"' }),
  );
  renderBookingPage();
  await chooseTuesdayMorning();
  fillIn('Anna Petrova', 'anna@example.com');

  submit();

  expect((await screen.findByRole('alert')).textContent).toBe(
    'The server did not accept these values. Check the fields and try again.',
  );
  expect(screen.getByRole('button', { name: 'Book' })).toBeTruthy();
  expect((screen.getByLabelText(/Your name/) as HTMLInputElement).value).toBe('Anna Petrova');
  expect(shownSlots()).toEqual(['09:00 – 09:30']);
  expect(server.slotLoads).toBe(1);
});
