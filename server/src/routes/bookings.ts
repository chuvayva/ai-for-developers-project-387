import type { components } from '@calendar/api';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app.ts';
import { ApiFailure } from '../errors.ts';
import { checkStartTime, toTimestamp } from '../slots.ts';
import { requireEventType, type Store } from '../store.ts';

type Booking = components['schemas']['Booking'];
type RescheduleBookingRequest = components['schemas']['RescheduleBookingRequest'];
type CreateBookingRequest = components['schemas']['CreateBookingRequest'];

// The field limits of `CreateBookingRequest` in `api/main.tsp`.
const createBookingBody = {
  type: 'object',
  required: ['eventTypeId', 'startTime', 'guestName', 'guestEmail'],
  properties: {
    eventTypeId: { type: 'string' },
    startTime: { type: 'string', format: 'date-time' },
    guestName: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    guestEmail: { type: 'string', maxLength: 254, format: 'email' },
  },
} as const;

const rescheduleBookingBody = {
  type: 'object',
  required: ['startTime'],
  properties: {
    startTime: { type: 'string', format: 'date-time' },
    eventTypeId: { type: 'string' },
  },
} as const;

export default async function bookingRoutes(
  fastify: FastifyInstance,
  opts: { store: Store; now: Clock },
) {
  const { store, now } = opts;

  fastify.get<{ Reply: Booking[] }>('/bookings', (_request, reply) => {
    const moment = now().getTime();
    // A call in progress has not ended, so it is still upcoming.
    const upcoming = store
      .listBookings()
      .filter((booking) => Date.parse(booking.endTime) > moment)
      // Soonest first. Bookings never overlap, so no two share a start time.
      .toSorted((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    reply.send(upcoming);
  });

  // The handler has no `await`, so it runs from its first line to its last
  // before the process takes up another request. The overlap check and the
  // write are one step, and two requests cannot both find the interval free.
  fastify.post<{ Body: CreateBookingRequest; Reply: Booking }>(
    '/bookings',
    { schema: { body: createBookingBody } },
    (request, reply) => {
      // Only the named fields are read, so any other property is dropped here.
      const { eventTypeId, startTime, guestName, guestEmail } = request.body;

      // The format checks the spelling. A spelling it accepts and `Date` cannot
      // read, such as the offset `+03`, names no moment for the server.
      const start = new Date(startTime);
      if (Number.isNaN(start.getTime())) {
        throw new ApiFailure('validation_failed', 'body/startTime must name a moment');
      }

      const eventType = requireEventType(store, eventTypeId);

      const current = now();
      const check = checkStartTime(
        {
          durationMinutes: eventType.durationMinutes,
          now: current,
          bookings: store.listBookings(),
        },
        start,
      );
      if (check.status === 'not-a-slot') {
        throw new ApiFailure(
          'not_a_slot',
          `${JSON.stringify(startTime)} is not the start of a slot of this event type.`,
        );
      }
      if (check.status === 'taken') {
        throw new ApiFailure(
          'slot_taken',
          `The slot starting at ${toTimestamp(start.getTime())} is already booked.`,
        );
      }

      const booking = store.createBooking({
        eventType,
        startTime: check.slot.startTime,
        endTime: check.slot.endTime,
        guestName,
        guestEmail,
        createdAt: toTimestamp(current.getTime()),
      });
      reply.status(201).send(booking);
    },
  );

  // Synchronous like the handler above: the checks and the write are one step.
  fastify.patch<{ Params: { bookingId: string }; Body: RescheduleBookingRequest; Reply: Booking }>(
    '/bookings/:bookingId',
    { schema: { body: rescheduleBookingBody } },
    (request, reply) => {
      const { startTime, eventTypeId } = request.body;

      const start = new Date(startTime);
      if (Number.isNaN(start.getTime())) {
        throw new ApiFailure('validation_failed', 'body/startTime must name a moment');
      }

      const { bookingId } = request.params;
      const booking = store.getBooking(bookingId);
      if (!booking) {
        throw new ApiFailure(
          'booking_not_found',
          `No booking has the id ${JSON.stringify(bookingId)}.`,
        );
      }

      const eventType =
        eventTypeId === undefined ? booking.eventType : requireEventType(store, eventTypeId);

      const check = checkStartTime(
        {
          durationMinutes: eventType.durationMinutes,
          now: now(),
          // The booking's own interval is free for the move.
          bookings: store.listBookings().filter((other) => other.id !== booking.id),
        },
        start,
      );
      if (check.status === 'not-a-slot') {
        throw new ApiFailure(
          'not_a_slot',
          `${JSON.stringify(startTime)} is not the start of a slot of this event type.`,
        );
      }
      if (check.status === 'taken') {
        throw new ApiFailure(
          'slot_taken',
          `The slot starting at ${toTimestamp(start.getTime())} is already booked.`,
        );
      }

      const rescheduled: Booking = {
        ...booking,
        eventType,
        startTime: check.slot.startTime,
        endTime: check.slot.endTime,
      };
      store.replaceBooking(rescheduled);
      reply.send(rescheduled);
    },
  );
}
