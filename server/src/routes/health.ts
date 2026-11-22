import type { components } from '@calendar/api';
import type { FastifyInstance } from 'fastify';

type Health = components['schemas']['Health'];

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (): Promise<Health> => ({ status: 'ok' }));
}
