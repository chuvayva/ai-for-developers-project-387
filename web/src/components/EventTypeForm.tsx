import { Alert, Button, NumberInput, Stack, Textarea, TextInput } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { createEventType, type EventType } from '../api/client.ts';
import { failureText } from '../api/failureText.ts';
import { characters } from './characters.ts';

type Values = {
  name: string;
  description: string;
  /** A number once the field holds one, and the typed text until then. */
  duration: number | string;
};

type FieldErrors = Partial<Record<keyof Values, string>>;

const emptyValues: Values = { name: '', description: '', duration: 30 };

/** The field limits of `CreateEventTypeRequest` in the contract. */
function checkLimits({ name, description, duration }: Values): FieldErrors {
  const errors: FieldErrors = {};

  if (!/\S/.test(name)) {
    errors.name = 'Enter a name.';
  } else if (characters(name) > 100) {
    errors.name = 'The name can be at most 100 characters.';
  }

  if (characters(description) > 1000) {
    errors.description = 'The description can be at most 1000 characters.';
  }

  if (typeof duration !== 'number') {
    errors.duration = 'Enter a duration in minutes.';
  } else if (!Number.isInteger(duration) || duration < 5 || duration > 540) {
    errors.duration = 'The duration must be from 5 to 540 minutes.';
  }

  return errors;
}

export function EventTypeForm({ onCreated }: { onCreated: (eventType: EventType) => void }) {
  const [values, setValues] = useState(emptyValues);
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
    if (Object.keys(found).length > 0 || typeof values.duration !== 'number') {
      return;
    }

    setSending(true);
    try {
      const eventType = await createEventType({
        name: values.name,
        description: values.description,
        durationMinutes: values.duration,
      });
      setValues(emptyValues);
      onCreated(eventType);
    } catch (error) {
      setFailure(failureText(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        <TextInput
          label="Name"
          required
          value={values.name}
          onChange={(event) => change({ name: event.currentTarget.value })}
          error={errors.name}
        />
        <Textarea
          label="Description"
          rows={3}
          value={values.description}
          onChange={(event) => change({ description: event.currentTarget.value })}
          error={errors.description}
        />
        <NumberInput
          label="Duration"
          description="In minutes, from 5 to 540."
          required
          allowDecimal={false}
          allowNegative={false}
          value={values.duration}
          onChange={(duration) => change({ duration })}
          error={errors.duration}
        />
        {failure && (
          <Alert color="red" role="alert">
            {failure}
          </Alert>
        )}
        <Button type="submit" loading={sending} style={{ alignSelf: 'flex-start' }}>
          Create event type
        </Button>
      </Stack>
    </form>
  );
}
