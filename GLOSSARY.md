# Calendar

A call booking service: a host publishes free time, and a guest books a call in it.

## Language

**Host**:
The one person whose calendar the service books. In Russian, «владелец календаря».
_Avoid_: Owner, organizer, admin

**Guest**:
A visitor who books a call with the host. A guest has no account.
_Avoid_: Client, customer, user, attendee

**Event type**:
A kind of call the host offers, with a name, a description and a duration in minutes. In Russian, «тип события».
_Avoid_: Meeting type, service, booking type

**Booking**:
One guest's reserved interval of the host's time for one event type, always made on a slot. Two bookings never overlap. In Russian, «бронирование».
_Avoid_: Reservation, appointment, meeting, record

**Upcoming booking**:
A booking that has not ended yet. A call in progress is still upcoming. In Russian, «предстоящая встреча».
_Avoid_: Upcoming meeting, future booking, active booking

**Slot**:
A start time a guest can book for an event type. It lasts as long as the event type.
_Avoid_: Time slot, interval, availability

**Conflict**:
A failed attempt to book a start time that was a slot until another booking came to overlap it. An attempt on a start time that was never a slot is not a conflict.
_Avoid_: Collision, clash, double booking

**Booking window**:
The run of 14 calendar days, today and the 13 days after it, in which slots are offered. In Russian, «окно записи».
_Avoid_: Booking period, availability window, horizon

**Working hours**:
The part of each day in which the host takes calls: 09:00 to 18:00, every day of the week.
_Avoid_: Business hours, availability, schedule

**Host time zone**:
The one time zone, Europe/Moscow, in which working hours and calendar days are measured.
_Avoid_: Server time, local time

**Home page**:
The entry page of the service, which leads a guest to the guest event types page.
_Avoid_: Landing page, main page, index

**Guest event types page**:
The page where a guest chooses an event type. It leads to the booking page of that event type.
_Avoid_: Catalogue, services page, booking page

**Booking page**:
The page where a guest picks a slot of one event type and books a call. In Russian, «страница записи».
_Avoid_: Scheduling page, reservation page, appointment page
