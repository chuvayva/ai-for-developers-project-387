import { client, type ErrorCode } from '@calendar/api/client';

// Pages call the SDK that `@calendar/api` generates from the contract, one
// function per operation, and pass each call through `send`.
export {
  createBooking,
  createEventType,
  getEventType,
  listBookings,
  listEventTypes,
  listSlots,
} from '@calendar/api/client';
export type {
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  ErrorCode,
  EventType,
  Slot,
  SlotDay,
} from '@calendar/api/client';

// The paths in the contract start with `/api`, and the API answers on the
// origin that serves the page: the Vite proxy in development, the server in
// the image.
client.setConfig({ baseUrl: globalThis.location.origin });

/**
 * A request the server answered with a failure. `code` is the `ApiError` code,
 * or `undefined` when the answer was not an `ApiError`.
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | undefined;

  constructor(status: number | undefined, code: ErrorCode | undefined) {
    super(`The API answered ${status ?? 'nothing'}${code ? ` ${code}` : ''}`);
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

function errorCode(error: unknown): ErrorCode | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    // An unknown code has no text of its own, so the general text is shown.
    return error.code as ErrorCode;
  }
  return undefined;
}

type SdkResult = { data: unknown; error: unknown; response?: Response };

/** The body of a successful answer, from the branch of the result with no error. */
type Data<R> = R extends { error: undefined; data: infer T } ? T : never;

/**
 * Waits for an SDK call and returns the body of its success. A failure throws
 * `ApiRequestError`.
 */
export async function send<R extends SdkResult>(call: Promise<R>): Promise<Data<R>> {
  const result = await call;
  if (result.error !== undefined) {
    throw new ApiRequestError(result.response?.status, errorCode(result.error));
  }
  return result.data as Data<R>;
}
