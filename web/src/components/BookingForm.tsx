import { Alert, Button, Stack, TextInput } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import {
  ApiRequestError,
  type Booking,
  createBooking,
  type EventType,
  type Slot,
} from '../api/client.ts';
import { failureText } from '../api/failureText.ts';
import { characters } from './characters.ts';

type Values = { guestName: string; guestEmail: string };

type FieldErrors = Partial<Record<keyof Values, string>>;

// What the server takes for an email: dot-separated words, an @ and a host name with a dot.
const word = "[a-z0-9!#$%&'*+/=?^_`{|}~-]+";
const label = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';
const email = new RegExp(`^${word}(?:\\.${word})*@(?:${label}\\.)+${label}$`, 'i');

/** The field limits of `CreateBookingRequest` in the contract. */
function checkLimits({ guestName, guestEmail }: Values): FieldErrors {
  const errors: FieldErrors = {};

  if (!/\S/.test(guestName)) {
    errors.guestName = 'Enter your name.';
  } else if (characters(guestName) > 100) {
    errors.guestName = 'The name can be at most 100 characters.';
  }

  if (guestEmail === '') {
    errors.guestEmail = 'Enter your email.';
  } else if (characters(guestEmail) > 254) {
    errors.guestEmail = 'The email can be at most 254 characters.';
  } else if (!email.test(guestEmail)) {
    errors.guestEmail = 'Enter an email such as anna@example.com.';
  }

  return errors;
}

/** The codes that say the chosen start time cannot be booked any more. */
function isSlotLost(error: unknown): boolean {
  return (
    error instanceof ApiRequestError && (error.code === 'slot_taken' || error.code === 'not_a_slot')
  );
}

export function BookingForm(props: {
  eventType: EventType;
  slot: Slot;
  onBooked: (booking: Booking) => void;
  /** The server answered that the slot is taken or is no slot any more. */
  onSlotLost: (text: string) => void;
}) {
  const { eventType, slot, onBooked, onSlotLost } = props;
  const [values, setValues] = useState<Values>({ guestName: '', guestEmail: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string>();
  const [sending, setSending] = useState(false);

  function change(changed: Partial<Values>) {
    setValues((current) => ({ ...current, ...changed }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);

    const found = checkLimits(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    setSending(true);
    try {
      // The name and the email go as typed. The server stores them as sent.
      const booking = await createBooking({
        eventTypeId: eventType.id,
        startTime: slot.startTime,
        guestName: values.guestName,
        guestEmail: values.guestEmail,
      });
      onBooked(booking);
    } catch (error) {
      if (isSlotLost(error)) {
        onSlotLost(failureText(error));
      } else {
        setFailure(failureText(error));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        <TextInput
          label="Your name"
          required
          autoComplete="name"
          value={values.guestName}
          onChange={(event) => change({ guestName: event.currentTarget.value })}
          error={errors.guestName}
        />
        <TextInput
          label="Your email"
          type="email"
          required
          autoComplete="email"
          value={values.guestEmail}
          onChange={(event) => change({ guestEmail: event.currentTarget.value })}
          error={errors.guestEmail}
        />
        {failure && (
          <Alert color="red" role="alert">
            {failure}
          </Alert>
        )}
        <Button type="submit" loading={sending} style={{ alignSelf: 'flex-start' }}>
          Book
        </Button>
      </Stack>
    </form>
  );
}
