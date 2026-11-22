import type { components } from '@calendar/api';

export type ErrorCode = components['schemas']['ErrorCode'];
export type EventType = components['schemas']['EventType'];
export type Slot = components['schemas']['Slot'];
export type SlotDay = components['schemas']['SlotDay'];
export type CreateEventTypeRequest = components['schemas']['CreateEventTypeRequest'];
export type Booking = components['schemas']['Booking'];
export type CreateBookingRequest = components['schemas']['CreateBookingRequest'];

/**
 * A request the server answered with a failure. `code` is the `ApiError` code,
 * or `undefined` when the answer was not an `ApiError`.
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | undefined;

  constructor(status: number, code: ErrorCode | undefined) {
    super(`The API answered ${status}${code ? ` ${code}` : ''}`);
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

async function readErrorCode(response: Response): Promise<ErrorCode | undefined> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'code' in body) {
      // An unknown code has no text of its own, so the general text is shown.
      return body.code as ErrorCode;
    }
  } catch {
    // The body is not JSON, so it is not an `ApiError`.
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    throw new ApiRequestError(response.status, await readErrorCode(response));
  }
  return (await response.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function listEventTypes(): Promise<EventType[]> {
  return request('/event-types');
}

export function getEventType(eventTypeId: string): Promise<EventType> {
  return request(`/event-types/${encodeURIComponent(eventTypeId)}`);
}

/** The 14 days of the booking window, each with the slots of the event type. */
export function listSlots(eventTypeId: string): Promise<SlotDay[]> {
  return request(`/event-types/${encodeURIComponent(eventTypeId)}/slots`);
}

export function createEventType(body: CreateEventTypeRequest): Promise<EventType> {
  return post('/event-types', body);
}

/** The upcoming bookings, which have not ended yet, the soonest first. */
export function listBookings(): Promise<Booking[]> {
  return request('/bookings');
}

export function createBooking(body: CreateBookingRequest): Promise<Booking> {
  return post('/bookings', body);
}
