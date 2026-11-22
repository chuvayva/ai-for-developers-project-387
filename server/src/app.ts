import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { registerErrorHandling, sendRouterFailure } from './errors.ts';
import bookingRoutes from './routes/bookings.ts';
import eventTypeRoutes from './routes/event-types.ts';
import healthRoutes from './routes/health.ts';
import slotRoutes from './routes/slots.ts';
import { createStore } from './store.ts';

/** Reads the current moment. */
export type Clock = () => Date;

export type AppOptions = FastifyServerOptions & {
  /** The clock of the app. Tests set it. The default is the system clock. */
  now?: Clock;
  /**
   * The folder of the built interface, `web/dist`. When it is set, the app
   * serves the interface next to the API on the same port. Tests and
   * `mise run dev` leave it out.
   */
  webRoot?: string;
};

export function build(opts: AppOptions = {}): FastifyInstance {
  const { now = () => new Date(), webRoot, ...fastifyOptions } = opts;

  const app = Fastify({
    ...fastifyOptions,
    // The contract's types are exact: the string "30" is not a duration.
    ajv: { customOptions: { coerceTypes: false } },
    // Any string is a legal id, so the router does not cap the length of one.
    routerOptions: { ...fastifyOptions.routerOptions, maxParamLength: Number.MAX_SAFE_INTEGER },
    frameworkErrors: sendRouterFailure,
  });

  registerErrorHandling(app);

  // One store for each app, so every `build()` starts empty.
  const store = createStore();

  app.register(healthRoutes, { prefix: '/api' });
  app.register(eventTypeRoutes, { prefix: '/api', store });
  app.register(slotRoutes, { prefix: '/api', store, now });
  app.register(bookingRoutes, { prefix: '/api', store, now });

  if (webRoot !== undefined) {
    registerWeb(app, webRoot);
  }

  return app;
}

/**
 * Serves the built interface. A GET outside `/api` that names no file gets
 * `index.html`, and the interface's router chooses the page.
 */
function registerWeb(app: FastifyInstance, root: string): void {
  app.register(fastifyStatic, { root, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url === '/api' || request.url.startsWith('/api/');
    if (request.method === 'GET' && !isApi) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });
}
