import { Alert, Button, Group, NativeSelect, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
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

function fetchSlots(eventTypeId: string): Promise<SlotDay[] | 'failed'> {
  return send(listSlots({ path: { eventTypeId } })).catch(() => 'failed' as const);
}

/**
 * Lets the host move a booking to another slot, another event type, or both.
 * Keeping the current time is the default, so a change of event type alone
 * needs no slot.
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
  const [notice, setNotice] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let current = true;
    send(listEventTypes()).then(
      (loaded) => current && setEventTypes(loaded),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);

  function loadSlots(id: string) {
    fetchSlots(id).then((loaded) => setSlotsByType((all) => ({ ...all, [id]: loaded })));
  }

  useEffect(() => {
    fetchSlots(eventTypeId).then((loaded) =>
      setSlotsByType((all) => ({ ...all, [eventTypeId]: loaded })),
    );
  }, [eventTypeId]);

  const days = slotsByType[eventTypeId];
  const offered = days === undefined || days === 'failed' ? [] : days.flatMap((day) => day.slots);

  async function confirm() {
    setSending(true);
    setNotice(undefined);
    try {
      const moved = await send(
        rescheduleBooking({ path: { bookingId: booking.id }, body: { startTime, eventTypeId } }),
      );
      props.onRescheduled(moved);
    } catch (error) {
      setNotice(failureText(error));
      setStartTime(booking.startTime);
      loadSlots(eventTypeId);
      setSending(false);
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

      <Button
        variant={startTime === booking.startTime ? 'filled' : 'default'}
        aria-pressed={startTime === booking.startTime}
        onClick={() => setStartTime(booking.startTime)}
      >
        Keep the current time
      </Button>

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
