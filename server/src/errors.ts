import type { components } from '@calendar/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type ApiError = components['schemas']['ApiError'];
type ErrorCode = components['schemas']['ErrorCode'];

const statusByCode = {
  validation_failed: 400,
  not_a_slot: 400,
  event_type_not_found: 404,
  slot_taken: 409,
} as const satisfies Record<ErrorCode, number>;

/**
 * A failure the contract lists. A route or a module throws it, and the error
 * handler answers with the status of the code and an `ApiError` body.
 */
export class ApiFailure extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
  }
}

function clientErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const { statusCode } = error as Error & { statusCode?: unknown };
  const isClientError = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
  return isClientError ? error.message : undefined;
}

/**
 * Answers a request the router could not read, such as a path with a broken
 * percent escape. It never reaches a route, so the error handler does not see
 * it. `build()` passes this function to Fastify as `frameworkErrors`.
 */
export function sendRouterFailure(error: Error, _request: FastifyRequest, reply: FastifyReply) {
  const body: ApiError = { code: 'validation_failed', message: error.message };
  return reply.status(statusByCode.validation_failed).send(body);
}

/**
 * Makes every failure of a request an `ApiError`. Failures Fastify raises
 * itself while it reads a request, such as a body that breaks the route schema
 * or is not parsable JSON, become `400 validation_failed`.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiFailure) {
      const body: ApiError = { code: error.code, message: error.message };
      return reply.status(statusByCode[error.code]).send(body);
    }

    const message = clientErrorMessage(error);
    if (message !== undefined) {
      const body: ApiError = { code: 'validation_failed', message };
      return reply.status(statusByCode.validation_failed).send(body);
    }

    // The contract has no code for a fault of the server itself.
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong on the server.',
    });
  });
}
