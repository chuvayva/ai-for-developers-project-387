import { randomUUID } from 'node:crypto';
import type { components } from '@calendar/api';
import { ApiFailure } from './errors.ts';

type EventType = components['schemas']['EventType'];
type Booking = components['schemas']['Booking'];

export type NewEventType = Omit<EventType, 'id'>;
export type NewBooking = Omit<Booking, 'id'>;

/**
 * Everything the server remembers. It lives in memory, so it starts empty and
 * is lost when the process stops.
 */
export type Store = {
  createEventType(input: NewEventType): EventType;
  /** In order of creation, oldest first. */
  listEventTypes(): EventType[];
  /** `undefined` when no event type has this id. Any string is a legal id. */
  getEventType(id: string): EventType | undefined;
  /** Stores the booking as given. The caller has checked that it overlaps no other. */
  createBooking(input: NewBooking): Booking;
  /** `undefined` when no booking has this id. */
  getBooking(id: string): Booking | undefined;
  /** Replaces the booking that has the same id. The caller has checked that it overlaps no other. */
  replaceBooking(booking: Booking): void;
  /** Every booking, ended ones too, in order of creation. */
  listBookings(): Booking[];
};

export function createStore(): Store {
  // A Map iterates in insertion order, which is the order of creation.
  const eventTypes = new Map<string, EventType>();
  const bookings: Booking[] = [];

  return {
    createEventType(input) {
      const eventType: EventType = { id: `evt_${randomUUID()}`, ...input };
      eventTypes.set(eventType.id, eventType);
      return eventType;
    },
    listEventTypes() {
      return [...eventTypes.values()];
    },
    getEventType(id) {
      return eventTypes.get(id);
    },
    createBooking(input) {
      const booking: Booking = { id: `bkg_${randomUUID()}`, ...input };
      bookings.push(booking);
      return booking;
    },
    getBooking(id) {
      return bookings.find((booking) => booking.id === id);
    },
    replaceBooking(booking) {
      const index = bookings.findIndex((existing) => existing.id === booking.id);
      if (index !== -1) {
        bookings[index] = booking;
      }
    },
    listBookings() {
      return [...bookings];
    },
  };
}

/** The event type with this id. Fails the request with `event_type_not_found` when there is none. */
export function requireEventType(store: Store, id: string): EventType {
  const eventType = store.getEventType(id);
  if (!eventType) {
    throw new ApiFailure('event_type_not_found', `No event type has the id ${JSON.stringify(id)}.`);
  }
  return eventType;
}
