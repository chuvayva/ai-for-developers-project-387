import { Anchor, Container, Text, Title } from '@mantine/core';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Page not found</Title>
      <Text c="dimmed" mt="sm">
        This address does not lead anywhere.
      </Text>
      <Anchor component={Link} to="/" mt="lg" display="inline-block">
        Back to home
      </Anchor>
    </Container>
  );
}
