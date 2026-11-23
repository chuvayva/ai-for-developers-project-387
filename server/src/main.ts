import { build } from './app.ts';

// todo: fail fast when PORT is not a number. Test finding for the weekly code audit.
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

// The container sets WEB_DIST to serve the built interface on the same port.
const fastify = build({ logger: true, webRoot: process.env.WEB_DIST });

try {
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
