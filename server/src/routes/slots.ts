import type { components } from '@calendar/api';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app.ts';
import { listSlotDays } from '../slots.ts';
import { requireEventType, type Store } from '../store.ts';

type SlotDay = components['schemas']['SlotDay'];

export default async function slotRoutes(
  fastify: FastifyInstance,
  opts: { store: Store; now: Clock },
) {
  const { store, now } = opts;

  fastify.get<{ Params: { eventTypeId: string }; Reply: SlotDay[] }>(
    '/event-types/:eventTypeId/slots',
    (request, reply) => {
      const eventType = requireEventType(store, request.params.eventTypeId);
      reply.send(
        listSlotDays({
          durationMinutes: eventType.durationMinutes,
          now: now(),
          bookings: store.listBookings(),
        }),
      );
    },
  );
}
