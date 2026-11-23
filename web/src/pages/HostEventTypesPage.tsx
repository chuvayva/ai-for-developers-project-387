import { Anchor, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { type EventType, listEventTypes, send } from '../api/client.ts';
import { EventTypeForm } from '../components/EventTypeForm.tsx';
import { useLoadOnMount } from '../useLoadOnMount.ts';

function EventTypeList({ eventTypes }: { eventTypes: EventType[] }) {
  if (eventTypes.length === 0) {
    return <Text c="dimmed">No event types yet.</Text>;
  }

  return (
    <Stack component="ul" aria-label="Event types" p={0} m={0} style={{ listStyle: 'none' }}>
      {eventTypes.map((eventType) => (
        <Paper component="li" key={eventType.id} withBorder p="md">
          <Title order={3} size="h4">
            {eventType.name}
          </Title>
          <Text size="sm" c="dimmed">
            {eventType.durationMinutes} min
          </Text>
          {eventType.description && <Text mt="xs">{eventType.description}</Text>}
        </Paper>
      ))}
    </Stack>
  );
}

const load = () => send(listEventTypes());

export function HostEventTypesPage() {
  const { value: eventTypes, loading, update } = useLoadOnMount(load, []);

  return (
    <Container size="sm" py="xl">
      <Title order={1}>Event types</Title>
      <Text c="dimmed" mt="sm">
        The kinds of call guests can book with you.
      </Text>

      <Stack mt="lg">
        {loading === 'loading' && <Text c="dimmed">Loading the event types.</Text>}
        {loading === 'failed' && <Text c="red">The event types could not be loaded.</Text>}
        {loading === 'loaded' && <EventTypeList eventTypes={eventTypes} />}
      </Stack>

      {loading !== 'loading' && (
        <>
          <Title order={2} mt="xl" mb="md">
            New event type
          </Title>
          <EventTypeForm
            // The server lists event types oldest first, so a new one goes last.
            onCreated={(eventType) => update((listed) => [...listed, eventType])}
          />
        </>
      )}

      <Anchor component={Link} to="/" mt="xl" display="inline-block">
        Back to home
      </Anchor>
    </Container>
  );
}
