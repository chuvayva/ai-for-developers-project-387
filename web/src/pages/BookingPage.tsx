import { Alert, Anchor, Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ApiRequestError,
  type Booking,
  type EventType,
  getEventType,
  listSlots,
  type Slot,
  type SlotDay,
} from '../api/client.ts';
import { failureText } from '../api/failureText.ts';
import { BookingForm } from '../components/BookingForm.tsx';
import { formatHostDay, formatHostInterval, formatHostTime, HOST_TIME_ZONE } from '../hostTime.ts';

/** How loading the event type and its slots ended. */
type LoadOutcome =
  | {
      state: 'loaded';
      eventType: EventType;
      days: SlotDay[];
      /** The last reload of the slots failed, so `days` may show slots that are gone. */
      slotsAreStale: boolean;
    }
  | { state: 'not-found' }
  | { state: 'failed'; text: string };

function slotCount(day: SlotDay): string {
  if (day.slots.length === 0) {
    return 'No slots';
  }
  return day.slots.length === 1 ? '1 slot' : `${day.slots.length} slots`;
}

function DayPicker(props: { days: SlotDay[]; chosen: string; onChoose: (date: string) => void }) {
  return (
    <Group component="ul" aria-label="Days" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
      {props.days.map((day) => (
        <li key={day.date}>
          <Button
            variant={day.date === props.chosen ? 'filled' : 'default'}
            aria-pressed={day.date === props.chosen}
            onClick={() => props.onChoose(day.date)}
            h="auto"
            py="xs"
          >
            <Stack gap={0} align="center">
              <span>{formatHostDay(day.date)}</span>
              <Text span size="xs" opacity={day.slots.length === 0 ? 0.6 : 1}>
                {slotCount(day)}
              </Text>
            </Stack>
          </Button>
        </li>
      ))}
    </Group>
  );
}

function SlotList(props: { day: SlotDay; chosen?: Slot; onChoose: (slot: Slot) => void }) {
  if (props.day.slots.length === 0) {
    return <Text c="dimmed">There are no slots on this day.</Text>;
  }

  return (
    <Group component="ul" aria-label="Slots" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
      {props.day.slots.map((slot) => (
        <li key={slot.startTime}>
          <Button
            variant={slot === props.chosen ? 'filled' : 'default'}
            aria-pressed={slot === props.chosen}
            onClick={() => props.onChoose(slot)}
          >
            {formatHostTime(slot.startTime)} – {formatHostTime(slot.endTime)}
          </Button>
        </li>
      ))}
    </Group>
  );
}

function Confirmation({ booking, onBookAnother }: { booking: Booking; onBookAnother: () => void }) {
  return (
    <section aria-labelledby="booking-confirmed">
      <Title order={1} id="booking-confirmed">
        Booking confirmed
      </Title>
      <Paper withBorder p="md" mt="lg">
        <Stack gap="xs">
          <div>
            <Text fw={600}>{booking.eventType.name}</Text>
            <Text size="sm" c="dimmed">
              {booking.eventType.durationMinutes} min
            </Text>
          </div>
          <div>
            <Text>{formatHostInterval(booking.startTime, booking.endTime)}</Text>
            <Text size="sm" c="dimmed">
              Host time zone, {HOST_TIME_ZONE}
            </Text>
          </div>
          <div>
            <Text>{booking.guestName}</Text>
            <Text>{booking.guestEmail}</Text>
          </div>
        </Stack>
      </Paper>
      <Button variant="default" mt="lg" onClick={onBookAnother}>
        Book another time
      </Button>
    </section>
  );
}

function GuestBooking(props: {
  eventType: EventType;
  days: SlotDay[];
  /** The slots could not be reloaded, so they are not shown. */
  slotsAreStale: boolean;
  /** Asks the server for the slots again. */
  onSlotsChanged: () => void;
}) {
  const { eventType, days, slotsAreStale, onSlotsChanged } = props;
  // No choice yet means the first day of the booking window, which is today.
  const [chosenDate, setChosenDate] = useState<string>();
  const [chosenStart, setChosenStart] = useState<string>();
  const [booking, setBooking] = useState<Booking>();
  const [notice, setNotice] = useState<string>();

  const chosenDay = days.find((day) => day.date === chosenDate) ?? days[0];
  // A slot that a reload no longer offers stops being chosen.
  const chosenSlot = chosenDay?.slots.find((slot) => slot.startTime === chosenStart);

  if (booking) {
    return <Confirmation booking={booking} onBookAnother={() => setBooking(undefined)} />;
  }

  const heading = (
    <>
      <Title order={1}>{eventType.name}</Title>
      <Text size="sm" c="dimmed">
        {eventType.durationMinutes} min
      </Text>
      {eventType.description && <Text mt="xs">{eventType.description}</Text>}
    </>
  );
  const lostSlotNotice = notice && (
    <Alert color="red" role="alert" mb="sm">
      {notice}
    </Alert>
  );

  if (slotsAreStale) {
    return (
      <>
        {heading}
        <Stack mt="xl" gap={0}>
          {lostSlotNotice}
          <Text c="red">The slots could not be loaded.</Text>
        </Stack>
      </>
    );
  }

  return (
    <>
      {heading}

      <Title order={2} size="h4" mt="xl" mb="sm">
        Choose a day
      </Title>
      <DayPicker
        days={days}
        chosen={chosenDay?.date ?? ''}
        onChoose={(date) => {
          setChosenDate(date);
          setChosenStart(undefined);
        }}
      />

      {chosenDay && (
        <>
          <Title order={2} size="h4" mt="xl">
            {formatHostDay(chosenDay.date)}
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            Times are in the host time zone, {HOST_TIME_ZONE}.
          </Text>
          {lostSlotNotice}
          <SlotList
            day={chosenDay}
            chosen={chosenSlot}
            onChoose={(slot) => {
              setChosenStart(slot.startTime);
              setNotice(undefined);
            }}
          />
        </>
      )}

      {chosenSlot && (
        <>
          <Title order={2} size="h4" mt="xl">
            Your details
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            {formatHostInterval(chosenSlot.startTime, chosenSlot.endTime)}
          </Text>
          <BookingForm
            // A key of its own, so another slot starts with no failure shown.
            key={chosenSlot.startTime}
            eventType={eventType}
            slot={chosenSlot}
            onBooked={(booked) => {
              setBooking(booked);
              setChosenStart(undefined);
              onSlotsChanged();
            }}
            onSlotLost={(text) => {
              setNotice(text);
              setChosenStart(undefined);
              onSlotsChanged();
            }}
          />
        </>
      )}
    </>
  );
}

/** Where a guest sees the slots of one event type and books one. */
export function BookingPage() {
  const { eventTypeId = '' } = useParams();
  // The outcome is kept with the id it is for, so the outcome for another id reads as loading.
  const [load, setLoad] = useState<{ eventTypeId: string; outcome: LoadOutcome }>();
  const outcome = load?.eventTypeId === eventTypeId ? load.outcome : undefined;

  useEffect(() => {
    let current = true;
    const setOutcome = (next: LoadOutcome) => {
      if (current) {
        setLoad({ eventTypeId, outcome: next });
      }
    };

    Promise.all([getEventType(eventTypeId), listSlots(eventTypeId)]).then(
      ([eventType, days]) => setOutcome({ state: 'loaded', eventType, days, slotsAreStale: false }),
      (error: unknown) => {
        const isNotFound =
          error instanceof ApiRequestError && error.code === 'event_type_not_found';
        setOutcome(
          isNotFound ? { state: 'not-found' } : { state: 'failed', text: failureText(error) },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [eventTypeId]);

  function reloadSlots() {
    const setSlots = (slots: { days?: SlotDay[]; slotsAreStale: boolean }) => {
      // A reload that ends after the guest left for another event type is dropped.
      setLoad((current) =>
        current?.eventTypeId === eventTypeId && current.outcome.state === 'loaded'
          ? { eventTypeId, outcome: { ...current.outcome, ...slots } }
          : current,
      );
    };

    listSlots(eventTypeId).then(
      (days) => setSlots({ days, slotsAreStale: false }),
      () => setSlots({ slotsAreStale: true }),
    );
  }

  return (
    <Container size="sm" py="xl">
      {!outcome && <Text c="dimmed">Loading the slots.</Text>}
      {outcome?.state === 'failed' && <Text c="red">{outcome.text}</Text>}
      {outcome?.state === 'not-found' && (
        <>
          <Title order={1}>Event type not found</Title>
          <Text c="dimmed" mt="sm">
            This event type does not exist.
          </Text>
        </>
      )}
      {outcome?.state === 'loaded' && (
        // A key of its own, so another event type starts with no chosen day.
        <GuestBooking
          key={outcome.eventType.id}
          eventType={outcome.eventType}
          days={outcome.days}
          slotsAreStale={outcome.slotsAreStale}
          onSlotsChanged={reloadSlots}
        />
      )}

      <Anchor component={Link} to="/book" mt="xl" display="block">
        See the event types
      </Anchor>
    </Container>
  );
}
