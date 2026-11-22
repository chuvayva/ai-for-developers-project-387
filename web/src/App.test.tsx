import { fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { renderAt } from './testing.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('home page links to the guest event types page', () => {
  renderAt('/');

  expect(screen.getByRole('heading', { name: 'Calendar' })).toBeTruthy();
  const link = screen.getByRole('link', { name: 'Book a call' });
  expect(link.getAttribute('href')).toBe('/book');
});

test('home page links to the host event types page', () => {
  renderAt('/');

  const link = screen.getByRole('link', { name: 'Event types' });
  expect(link.getAttribute('href')).toBe('/host/event-types');
});

test('following the home page link opens the list of event types to book', async () => {
  vi.stubGlobal('fetch', async () => Response.json([]));
  renderAt('/');

  fireEvent.click(screen.getByRole('link', { name: 'Book a call' }));

  expect(screen.getByRole('heading', { name: 'Book a call' })).toBeTruthy();
  expect(await screen.findByText('There are no event types to book yet.')).toBeTruthy();
});

test('unknown path shows the not found page', () => {
  renderAt('/no-such-page');

  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
});
