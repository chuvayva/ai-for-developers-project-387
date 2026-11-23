import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

/**
 * A call booking service with one host and anonymous guests. The host creates
 * event types, and a guest books a slot of one of them.
 *
 * Time. Every moment is a UTC timestamp. Responses write it with `Z` and whole
 * seconds, as in `2026-11-23T06:00:00Z`. Requests accept any offset and read it
 * as the moment it names. A whole day is a plain date such as `2026-11-23` and
 * means that day in the host time zone.
 *
 * Host time zone. Working hours and calendar days are measured in
 * `Europe/Moscow`. The zone is a constant and no endpoint returns it.
 *
 * Slots. A slot is a start time a guest can book for an event type. The server
 * offers it when all of these hold:
 *
 * 1. It starts in the booking window, which is today and the 13 days after it.
 * 2. It starts on the step. Starts are counted from 09:00 in steps of the event
 *    type's duration.
 * 3. It fits in working hours, 09:00 to 18:00 on every day of the week, so it
 *    ends by 18:00.
 * 4. It starts in the future. There is no minimum notice.
 * 5. Its interval overlaps no booking of any event type. An interval includes
 *    its start and excludes its end, so a slot may start at the moment a
 *    booking ends.
 *
 * Errors. Every failure returns an `ApiError`. A request body may carry
 * properties this contract does not name. The server ignores them and does not
 * store them.
 *
 * The version `0.0.0` is a placeholder. Releases do not update it.
 */
@service(#{ title: "Calendar API" })
@info(#{ version: "0.0.0" })
@route("/api")
namespace CalendarApi;

model Health {
  status: "ok";
}

/**
 * Why a request failed.
 *
 * - `validation_failed`, status 400. The request body breaks a field rule or is
 *   not parsable JSON.
 * - `not_a_slot`, status 400. The start time breaks a slot rule other than the
 *   overlap. It is outside the booking window or working hours, off the step,
 *   already passed, or has a fractional second.
 * - `booking_not_found`, status 404. No booking has this id.
 * - `event_type_not_found`, status 404. No event type has this id.
 * - `slot_taken`, status 409. The start time passes every other slot rule, and
 *   its interval overlaps an existing booking.
 */
union ErrorCode {
  validationFailed: "validation_failed",
  notASlot: "not_a_slot",
  bookingNotFound: "booking_not_found",
  eventTypeNotFound: "event_type_not_found",
  slotTaken: "slot_taken",
}

/** The body of every failed request. */
@example(#{
  code: ErrorCode.slotTaken,
  message: "The slot starting at 2026-11-23T06:00:00Z is already booked.",
})
model ApiError {
  /** The reason, for a client to branch on. */
  code: ErrorCode;

  /**
   * An English sentence for developers. Its wording may change. A client
   * chooses the text it shows a guest from `code`.
   */
  message: string;
}

alias BadRequest = BadRequestResponse & ApiError;
alias NotFound = NotFoundResponse & ApiError;
alias Conflict = ConflictResponse & ApiError;

/** A kind of call the host offers. */
@example(#{
  id: "evt_4f9a2c",
  name: "Intro call",
  description: "A short call to get acquainted.",
  durationMinutes: 30,
})
model EventType {
  /**
   * An opaque id the server generates. It is unique and the server never
   * reuses it.
   */
  id: string;

  /** The name as the host sent it, with no trimming. Two event types may share a name. */
  name: string;

  /** An empty string when the host gave no description. */
  description: string;

  /** The length of the call in whole minutes. */
  durationMinutes: int32;
}

model CreateEventTypeRequest {
  /** 1 to 100 characters, at least one of them not whitespace. */
  @minLength(1)
  @maxLength(100)
  @pattern("\\S")
  name: string;

  /** At most 1000 characters. */
  @maxLength(1000)
  description?: string;

  /**
   * A whole number of minutes from 5 to 540. 540 is the length of working
   * hours, so a longer call would have no slot.
   */
  @minValue(5)
  @maxValue(540)
  durationMinutes: int32;
}

/** A start time a guest can book for an event type. */
@example(#{
  startTime: utcDateTime.fromISO("2026-11-23T06:00:00Z"),
  endTime: utcDateTime.fromISO("2026-11-23T06:30:00Z"),
})
model Slot {
  startTime: utcDateTime;

  /** `startTime` plus the duration of the event type. */
  endTime: utcDateTime;
}

/** One day of the booking window and the slots that start on it. */
@example(#{
  date: plainDate.fromISO("2026-11-23"),
  slots: #[
    #{
      startTime: utcDateTime.fromISO("2026-11-23T06:00:00Z"),
      endTime: utcDateTime.fromISO("2026-11-23T06:30:00Z"),
    },
    #{
      startTime: utcDateTime.fromISO("2026-11-23T06:30:00Z"),
      endTime: utcDateTime.fromISO("2026-11-23T07:00:00Z"),
    }
  ],
})
model SlotDay {
  /** The day in the host time zone. */
  date: plainDate;

  /** The slots of this day, earliest first. Empty when the day has none. */
  slots: Slot[];
}

/**
 * One guest's reserved interval of the host's time for one event type. Two
 * bookings never overlap.
 */
@example(#{
  id: "bkg_81d07e",
  eventType: #{
    id: "evt_4f9a2c",
    name: "Intro call",
    description: "A short call to get acquainted.",
    durationMinutes: 30,
  },
  startTime: utcDateTime.fromISO("2026-11-23T06:00:00Z"),
  endTime: utcDateTime.fromISO("2026-11-23T06:30:00Z"),
  guestName: "Anna Petrova",
  guestEmail: "anna@example.com",
  createdAt: utcDateTime.fromISO("2026-11-21T12:15:42Z"),
})
model Booking {
  /**
   * An opaque id the server generates. It is unique and the server never
   * reuses it.
   */
  id: string;

  /** The event type the guest booked. */
  eventType: EventType;

  startTime: utcDateTime;

  /** `startTime` plus the duration of the event type. */
  endTime: utcDateTime;

  /** The name as the guest sent it, with no trimming. */
  guestName: string;

  /** The email as the guest sent it, with no change of case. */
  guestEmail: string;

  /** The moment the server created the booking. */
  createdAt: utcDateTime;
}

model CreateBookingRequest {
  /** The id of an existing event type. */
  eventTypeId: string;

  /**
   * The start of a slot of that event type. The server derives the end from
   * the event type's duration.
   */
  startTime: utcDateTime;

  /** 1 to 100 characters, at least one of them not whitespace. */
  @minLength(1)
  @maxLength(100)
  @pattern("\\S")
  guestName: string;

  /** At most 254 characters. One email may hold any number of bookings. */
  @maxLength(254)
  @format("email")
  guestEmail: string;
}

model RescheduleBookingRequest {
  /**
   * The start of a slot of the event type that the booking has after the
   * reschedule. The server derives the end from that event type's duration.
   */
  startTime: utcDateTime;

  /**
   * The id of an existing event type. Without it the booking keeps its event
   * type.
   */
  eventTypeId?: string;
}

@route("/health")
@tag("Service")
@operationId("getHealth")
@get
op getHealth(): Health;

@route("/event-types")
@tag("Event types")
namespace EventTypes {
  /** Returns every event type in the order of creation, oldest first. */
  @operationId("listEventTypes")
  @get
  op list(): EventType[];

  /**
   * Creates an event type.
   *
   * Fails with 400 `validation_failed` when the body breaks a field rule.
   */
  @operationId("createEventType")
  @post
  op create(@body body: CreateEventTypeRequest): {
    @statusCode _: 201;
    @body body: EventType;
  } | BadRequest;

  /**
   * Returns one event type.
   *
   * Fails with 404 `event_type_not_found` when no event type has this id. Any
   * string is a legal id.
   */
  @operationId("getEventType")
  @get
  op read(@path eventTypeId: string): EventType | NotFound;
}

@route("/event-types/{eventTypeId}/slots")
@tag("Slots")
namespace Slots {
  /**
   * Returns the slots of an event type for the whole booking window.
   *
   * The response always has 14 days in order, starting with today in the host
   * time zone. A day with no slot is present with an empty list. The server
   * leaves out start times that a booking overlaps or that have passed.
   *
   * Fails with 404 `event_type_not_found` when no event type has this id.
   */
  @operationId("listSlots")
  @get
  op list(@path eventTypeId: string): SlotDay[] | NotFound;
}

@route("/bookings")
@tag("Bookings")
namespace Bookings {
  /**
   * Returns the upcoming bookings, which are the bookings whose `endTime` is
   * after now, ordered by `startTime` with the soonest first. A call in
   * progress is on the list.
   */
  @operationId("listBookings")
  @get
  op list(): Booking[];

  /**
   * Books a slot for a guest.
   *
   * The server checks the request in this order and returns the first failure:
   *
   * 1. 400 `validation_failed` when the body breaks a field rule.
   * 2. 404 `event_type_not_found` when no event type has `eventTypeId`.
   * 3. 400 `not_a_slot` when `startTime` breaks a slot rule other than the
   *    overlap.
   * 4. 409 `slot_taken` when the interval overlaps an existing booking. Because
   *    this check comes last, the start time was a slot until another guest
   *    booked it.
   */
  @operationId("createBooking")
  @post
  op create(@body body: CreateBookingRequest): {
    @statusCode _: 201;
    @body body: Booking;
  } | BadRequest | NotFound | Conflict;

  /**
   * Reschedules a booking: gives it a new start time, a new event type, or
   * both. Its id, guest name, guest email and `createdAt` stay as they are, and
   * its end is derived from the duration of the event type it has afterwards.
   * Any booking can be rescheduled, an ended one too. A failed request leaves
   * the booking unchanged.
   *
   * The server checks the request in this order and returns the first failure:
   *
   * 1. 400 `validation_failed` when the body breaks a field rule.
   * 2. 404 `booking_not_found` when no booking has `bookingId`.
   * 3. 404 `event_type_not_found` when `eventTypeId` is given and no event type
   *    has it.
   * 4. 400 `not_a_slot` when `startTime` breaks a slot rule other than the
   *    overlap.
   * 5. 409 `slot_taken` when the interval overlaps a booking other than this
   *    one. The booking's own interval is free for the move.
   */
  @operationId("rescheduleBooking")
  @patch
  @route("/{bookingId}")
  op reschedule(@path bookingId: string, @body body: RescheduleBookingRequest): Booking | BadRequest | NotFound | Conflict;
}
