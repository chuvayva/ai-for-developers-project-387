import { Anchor, Button, Container, Group, Text, Title } from '@mantine/core';
import { Link } from 'react-router';

export function HomePage() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Calendar</Title>
      <Text c="dimmed" mt="sm">
        Book a call in a free time slot.
      </Text>
      <Button component={Link} to="/book" mt="lg">
        Book a call
      </Button>

      <Title order={2} size="h4" mt="xl">
        For the host
      </Title>
      <Group mt="xs">
        <Anchor component={Link} to="/host/event-types">
          Event types
        </Anchor>
        <Anchor component={Link} to="/host/bookings">
          Upcoming bookings
        </Anchor>
      </Group>
    </Container>
  );
}
