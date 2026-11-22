import type { components } from '@calendar/api';
import type { FastifyInstance } from 'fastify';
import { requireEventType, type Store } from '../store.ts';

type EventType = components['schemas']['EventType'];
type CreateEventTypeRequest = components['schemas']['CreateEventTypeRequest'];

// The field limits of `CreateEventTypeRequest` in `api/main.tsp`.
const createEventTypeBody = {
  type: 'object',
  required: ['name', 'durationMinutes'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    description: { type: 'string', maxLength: 1000 },
    durationMinutes: { type: 'integer', minimum: 5, maximum: 540 },
  },
} as const;

export default async function eventTypeRoutes(fastify: FastifyInstance, opts: { store: Store }) {
  const { store } = opts;

  fastify.get('/event-types', async (): Promise<EventType[]> => store.listEventTypes());

  fastify.post<{ Body: CreateEventTypeRequest }>(
    '/event-types',
    { schema: { body: createEventTypeBody } },
    async (request, reply): Promise<EventType> => {
      // Only the named fields are read, so any other property is dropped here.
      const { name, description = '', durationMinutes } = request.body;
      reply.status(201);
      return store.createEventType({ name, description, durationMinutes });
    },
  );

  fastify.get<{ Params: { eventTypeId: string }; Reply: EventType }>(
    '/event-types/:eventTypeId',
    (request, reply) => {
      reply.send(requireEventType(store, request.params.eventTypeId));
    },
  );
}
