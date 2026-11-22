import type { components } from '@calendar/api';
import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App } from './App.tsx';

// What the component tests share. A test file calls `vi.unstubAllGlobals()`
// after each test to take the stubbed `fetch` away.

type EventType = components['schemas']['EventType'];

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Stands in for the server at the `fetch` boundary. Each key is a method and a
 * path, as in `GET /api/bookings`. Its function gets the parsed JSON body of
 * the request, or `undefined` when there is none.
 */
export function stubApi(routes: Record<string, (body: unknown) => Response>) {
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const respond = routes[`${init?.method ?? 'GET'} ${input}`];
    if (!respond) {
      return new Response('Not stubbed', { status: 500 });
    }
    return respond(init?.body === undefined ? undefined : JSON.parse(String(init.body)));
  });
}

/** Renders the whole app at a path, inside the providers it needs. */
export function renderAt(path: string) {
  render(
    <MantineProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </MantineProvider>,
  );
}

/** The texts of the slots the booking page shows, in order. */
export function shownSlots(): (string | null)[] {
  return within(screen.getByRole('list', { name: 'Slots' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

export const intro: EventType = {
  id: 'evt_a',
  name: 'Intro call',
  description: 'A short call to get acquainted.',
  durationMinutes: 30,
};
export const review: EventType = {
  id: 'evt_b',
  name: 'Code review',
  description: '',
  durationMinutes: 45,
};
