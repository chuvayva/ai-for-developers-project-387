import { Alert, Button, Group, NativeSelect, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import {
  type Booking,
  type EventType,
  listEventTypes,
  listSlots,
  rescheduleBooking,
  send,
  type SlotDay,
} from '../api/client.ts';
import { failureText } from '../api/failureText.ts';
import { formatHostInterval } from '../hostTime.ts';

/** The slots of an event type as if the booking did not exist, so its own interval is offered. */
function fetchSlots(eventTypeId: string, bookingId: string): Promise<SlotDay[] | 'failed'> {
  return send(listSlots({ path: { eventTypeId }, query: { excludeBookingId: bookingId } })).catch(
    () => 'failed' as const,
  );
}

/**
 * Lets the host reschedule a booking to another slot, another event type, or both.
 * The current time is selected at first, so a change of event type alone
 * needs no other choice.
 */
export function RescheduleForm(props: {
  booking: Booking;
  onRescheduled: (booking: Booking) => void;
  onClose: () => void;
}) {
  const { booking } = props;
  const [eventTypes, setEventTypes] = useState<EventType[]>([booking.eventType]);
  const [eventTypeId, setEventTypeId] = useState(booking.eventType.id);
  // The slots are kept by event type, so another type reads as loading until its answer comes.
  const [slotsByType, setSlotsByType] = useState<Record<string, SlotDay[] | 'failed'>>({});
  const [startTime, setStartTime] = useState(booking.startTime);
  const [eventTypesFailed, setEventTypesFailed] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let current = true;
    send(listEventTypes()).then(
      (loaded) => current && setEventTypes(loaded),
      () => current && setEventTypesFailed(true),
    );
    return () => {
      current = false;
    };
  }, []);

  const loadSlots = useCallback(
    (id: string) =>
      fetchSlots(id, booking.id).then((loaded) => {
        setSlotsByType((all) => ({ ...all, [id]: loaded }));
        return loaded;
      }),
    [booking.id],
  );

  useEffect(() => {
    void loadSlots(eventTypeId);
  }, [eventTypeId, loadSlots]);

  const days = slotsByType[eventTypeId];
  const offered = days === undefined || days === 'failed' ? [] : days.flatMap((day) => day.slots);

  async function confirm() {
    setSending(true);
    setNotice(undefined);
    try {
      const rescheduled = await send(
        rescheduleBooking({ path: { bookingId: booking.id }, body: { startTime, eventTypeId } }),
      );
      props.onRescheduled(rescheduled);
    } catch (error) {
      setNotice(failureText(error));
      setSending(false);
      // The choice stays unless the refreshed slots no longer offer it.
      const loaded = await loadSlots(eventTypeId);
      if (
        loaded !== 'failed' &&
        !loaded.some((day) => day.slots.some((slot) => slot.startTime === startTime))
      ) {
        setStartTime(booking.startTime);
      }
    }
  }

  return (
    <Stack mt="md" gap="sm">
      <NativeSelect
        label="Event type"
        value={eventTypeId}
        onChange={(event) => {
          setEventTypeId(event.currentTarget.value);
          setNotice(undefined);
        }}
        data={eventTypes.map((eventType) => ({
          value: eventType.id,
          label: `${eventType.name} (${eventType.durationMinutes} min)`,
        }))}
      />

      {eventTypesFailed && <Text c="red">The event types could not be loaded.</Text>}

      {days === undefined && <Text c="dimmed">Loading the slots.</Text>}
      {days === 'failed' && <Text c="red">The slots could not be loaded.</Text>}
      {days !== undefined && days !== 'failed' && offered.length === 0 && (
        <Text c="dimmed">There are no free slots for this event type.</Text>
      )}
      {offered.length > 0 && (
        <Group component="ul" aria-label="Slots" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
          {offered.map((slot) => (
            <li key={slot.startTime}>
              <Button
                variant={slot.startTime === startTime ? 'filled' : 'default'}
                aria-pressed={slot.startTime === startTime}
                onClick={() => {
                  setStartTime(slot.startTime);
                  setNotice(undefined);
                }}
              >
                {formatHostInterval(slot.startTime, slot.endTime)}
              </Button>
            </li>
          ))}
        </Group>
      )}

      {notice && (
        <Alert color="red" role="alert">
          {notice}
        </Alert>
      )}

      <Group>
        <Button onClick={confirm} loading={sending}>
          Confirm
        </Button>
        <Button variant="default" onClick={props.onClose} disabled={sending}>
          Close
        </Button>
      </Group>
    </Stack>
  );
}
