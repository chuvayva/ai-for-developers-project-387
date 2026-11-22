import type { components } from '@calendar/api';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { intro, json, renderAt, review, stubApi } from '../testing.tsx';

type EventType = components['schemas']['EventType'];

type FakeApi = {
  /** The parsed bodies of the `createEventType` requests, in order. */
  created: unknown[];
};

/** A server that keeps the event types it is sent, as the real one does. */
function fakeApi(options: {
  eventTypes?: EventType[];
  list?: () => Response;
  create?: () => Response;
}): FakeApi {
  const eventTypes = [...(options.eventTypes ?? [])];
  const api: FakeApi = { created: [] };

  stubApi({
    'GET /api/event-types': () => (options.list ? options.list() : json(200, eventTypes)),
    'POST /api/event-types': (body) => {
      api.created.push(body);
      if (options.create) {
        return options.create();
      }
      const eventType = { id: `evt_${eventTypes.length + 1}`, ...(body as Omit<EventType, 'id'>) };
      eventTypes.push(eventType);
      return json(201, eventType);
    },
  });

  return api;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openPage() {
  renderAt('/host/event-types');
  // The form is usable once the list has loaded or failed to load.
  await screen.findByRole('button', { name: 'Create event type' });
}

function fillForm(values: { name?: string; description?: string; duration?: string }) {
  if (values.name !== undefined) {
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: values.name } });
  }
  if (values.description !== undefined) {
    fireEvent.change(screen.getByLabelText(/^Description/), {
      target: { value: values.description },
    });
  }
  if (values.duration !== undefined) {
    fireEvent.change(screen.getByLabelText(/^Duration/), { target: { value: values.duration } });
  }
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Create event type' }));
}

async function listedNames() {
  const list = await screen.findByRole('list', { name: 'Event types' });
  return within(list)
    .getAllByRole('heading')
    .map((heading) => heading.textContent);
}

test('the page lists the event types in the order the server returns them', async () => {
  fakeApi({ eventTypes: [review, intro] });

  await openPage();

  expect(await listedNames()).toEqual(['Code review', 'Intro call']);
  const list = screen.getByRole('list', { name: 'Event types' });
  expect(within(list).getByText('A short call to get acquainted.')).toBeTruthy();
  expect(within(list).getByText('30 min')).toBeTruthy();
  expect(within(list).getByText('45 min')).toBeTruthy();
});

test('the page says so when there are no event types', async () => {
  fakeApi({});

  await openPage();

  expect(await screen.findByText('No event types yet.')).toBeTruthy();
});

test('the host creates an event type and sees it at the end of the list', async () => {
  const api = fakeApi({ eventTypes: [intro] });
  await openPage();

  fillForm({ name: 'Deep dive', description: 'A long one.', duration: '90' });
  submit();

  expect(await screen.findByRole('heading', { name: 'Deep dive' })).toBeTruthy();
  expect(await listedNames()).toEqual(['Intro call', 'Deep dive']);
  expect(api.created).toEqual([
    { name: 'Deep dive', description: 'A long one.', durationMinutes: 90 },
  ]);
});

test('the form is empty again after an event type is created', async () => {
  fakeApi({});
  await openPage();

  fillForm({ name: 'Deep dive', duration: '90' });
  submit();
  await screen.findByRole('heading', { name: 'Deep dive' });

  expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('');
});

test('the name is sent exactly as typed', async () => {
  const api = fakeApi({});
  await openPage();

  fillForm({ name: '  Deep dive ', duration: '90' });
  submit();
  await screen.findByRole('list', { name: 'Event types' });

  expect(api.created).toEqual([{ name: '  Deep dive ', description: '', durationMinutes: 90 }]);
});

const brokenLimits: [string, { name: string; description?: string; duration: string }, string][] = [
  ['an empty name', { name: '', duration: '30' }, 'Enter a name.'],
  ['a name of spaces only', { name: '   ', duration: '30' }, 'Enter a name.'],
  [
    'a name over 100 characters',
    { name: 'x'.repeat(101), duration: '30' },
    'The name can be at most 100 characters.',
  ],
  [
    'a description over 1000 characters',
    { name: 'Intro call', description: 'd'.repeat(1001), duration: '30' },
    'The description can be at most 1000 characters.',
  ],
  ['an empty duration', { name: 'Intro call', duration: '' }, 'Enter a duration in minutes.'],
  [
    'a duration under 5',
    { name: 'Intro call', duration: '4' },
    'The duration must be from 5 to 540 minutes.',
  ],
  [
    'a duration over 540',
    { name: 'Intro call', duration: '541' },
    'The duration must be from 5 to 540 minutes.',
  ],
];

test.each(brokenLimits)(
  '%s is reported on its field and not sent',
  async (_case, values, message) => {
    const api = fakeApi({});
    await openPage();

    fillForm(values);
    submit();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(api.created).toEqual([]);
  },
);

test('the error is attached to the field that is wrong', async () => {
  fakeApi({});
  await openPage();

  fillForm({ name: '', duration: '30' });
  submit();

  const name = screen.getByLabelText(/^Name/);
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText(/^Duration/).getAttribute('aria-invalid')).not.toBe('true');
});

test('the values at the limits are accepted', async () => {
  const api = fakeApi({});
  await openPage();

  fillForm({ name: 'x'.repeat(100), description: 'd'.repeat(1000), duration: '540' });
  submit();
  await screen.findByRole('list', { name: 'Event types' });

  expect(api.created).toHaveLength(1);
});

test('a rejected event type shows the text for the error code, not the server message', async () => {
  fakeApi({
    create: () =>
      json(400, { code: 'validation_failed', message: 'body/name must match pattern "\\S"' }),
  });
  await openPage();

  fillForm({ name: 'Intro call', duration: '30' });
  submit();

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('The server did not accept these values.');
  expect(alert.textContent).not.toContain('must match pattern');
  expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Intro call');
});

test('a failure with no error code shows a general message', async () => {
  fakeApi({ create: () => new Response('Bad gateway', { status: 502 }) });
  await openPage();

  fillForm({ name: 'Intro call', duration: '30' });
  submit();

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('Something went wrong. Try again.');
});

test('the page says so when the list cannot be loaded', async () => {
  fakeApi({ list: () => new Response('Bad gateway', { status: 502 }) });

  await openPage();

  expect(await screen.findByText('The event types could not be loaded.')).toBeTruthy();
});
