import { Anchor, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { type Booking, listBookings } from '../api/client.ts';
import { formatHostInterval, HOST_TIME_ZONE } from '../hostTime.ts';
import { useLoadOnMount } from '../useLoadOnMount.ts';

function BookingList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return <Text c="dimmed">No upcoming bookings.</Text>;
  }

  return (
    <Stack component="ul" aria-label="Upcoming bookings" p={0} m={0} style={{ listStyle: 'none' }}>
      {bookings.map((booking) => (
        <Paper component="li" key={booking.id} withBorder p="md">
          <Title order={2} size="h4">
            {booking.eventType.name}
          </Title>
          <Text>{formatHostInterval(booking.startTime, booking.endTime)}</Text>
          <Text mt="xs">{booking.guestName}</Text>
          <Text size="sm" c="dimmed">
            {booking.guestEmail}
          </Text>
        </Paper>
      ))}
    </Stack>
  );
}

export function HostBookingsPage() {
  const { value: bookings, loading } = useLoadOnMount(listBookings, []);

  return (
    <Container size="sm" py="xl">
      <Title order={1}>Upcoming bookings</Title>
      <Text c="dimmed" mt="sm">
        The calls guests have booked with you, the soonest first. Times are in the host time zone,{' '}
        {HOST_TIME_ZONE}.
      </Text>

      <Stack mt="lg">
        {loading === 'loading' && <Text c="dimmed">Loading the bookings.</Text>}
        {loading === 'failed' && <Text c="red">The bookings could not be loaded.</Text>}
        {loading === 'loaded' && <BookingList bookings={bookings} />}
      </Stack>

      <Anchor component={Link} to="/" mt="xl" display="inline-block">
        Back to home
      </Anchor>
    </Container>
  );
}
