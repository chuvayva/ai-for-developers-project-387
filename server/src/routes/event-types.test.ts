import type { FastifyInstance } from 'fastify';
import { expect, test } from 'vitest';
import { build } from '../app.ts';

function createEventType(app: FastifyInstance, payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/event-types', payload: payload as object });
}

function listEventTypes(app: FastifyInstance) {
  return app.inject({ method: 'GET', url: '/api/event-types' });
}

test('a fresh server has no event types', async () => {
  const app = build();

  const response = await listEventTypes(app);

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([]);
});

test('creating an event type returns 201 with the event type', async () => {
  const app = build();

  const response = await createEventType(app, {
    name: 'Intro call',
    description: 'A short call to get acquainted.',
    durationMinutes: 30,
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toEqual({
    id: expect.any(String),
    name: 'Intro call',
    description: 'A short call to get acquainted.',
    durationMinutes: 30,
  });
  expect(response.json().id).not.toBe('');
});

test('a missing description comes back as an empty string', async () => {
  const app = build();

  const response = await createEventType(app, { name: 'Intro call', durationMinutes: 30 });

  expect(response.statusCode).toBe(201);
  expect(response.json().description).toBe('');
});

test('the name comes back exactly as sent, with no trimming', async () => {
  const app = build();

  const response = await createEventType(app, { name: '  Intro Call  ', durationMinutes: 30 });

  expect(response.json().name).toBe('  Intro Call  ');
});

test('the list has every event type in order of creation, oldest first', async () => {
  const app = build();
  const first = await createEventType(app, { name: 'Zebra', durationMinutes: 60 });
  const second = await createEventType(app, { name: 'Apple', durationMinutes: 15 });
  const third = await createEventType(app, { name: 'Mango', durationMinutes: 30 });

  const response = await listEventTypes(app);

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([first.json(), second.json(), third.json()]);
  expect(response.json().map((eventType: { name: string }) => eventType.name)).toEqual([
    'Zebra',
    'Apple',
    'Mango',
  ]);
});

test('two event types may share a name and still get different ids', async () => {
  const app = build();

  const responses = await Promise.all(
    Array.from({ length: 20 }, () => createEventType(app, { name: 'Same', durationMinutes: 30 })),
  );

  const ids = responses.map((response) => response.json().id);
  expect(new Set(ids).size).toBe(20);
});

test('each server keeps its own event types', async () => {
  const app = build();
  await createEventType(app, { name: 'Intro call', durationMinutes: 30 });

  const response = await listEventTypes(build());

  expect(response.json()).toEqual([]);
});

test('properties the contract does not name are ignored and not stored', async () => {
  const app = build();

  const created = await createEventType(app, {
    name: 'Intro call',
    durationMinutes: 30,
    id: 'evt_chosen_by_client',
    color: 'red',
  });

  expect(created.statusCode).toBe(201);
  expect(created.json().id).not.toBe('evt_chosen_by_client');
  expect(Object.keys(created.json()).toSorted()).toEqual([
    'description',
    'durationMinutes',
    'id',
    'name',
  ]);
  const listed = await listEventTypes(app);
  expect(listed.json()).toEqual([created.json()]);
});

test('the field limits accept their edges', async () => {
  const app = build();

  const shortest = await createEventType(app, { name: 'x', description: '', durationMinutes: 5 });
  const longest = await createEventType(app, {
    name: 'x'.repeat(100),
    description: 'd'.repeat(1000),
    durationMinutes: 540,
  });

  expect(shortest.statusCode).toBe(201);
  expect(longest.statusCode).toBe(201);
});

const invalidBodies: [string, unknown][] = [
  ['a missing name', { durationMinutes: 30 }],
  ['an empty name', { name: '', durationMinutes: 30 }],
  ['a name of whitespace only', { name: ' \t ', durationMinutes: 30 }],
  ['a name over 100 characters', { name: 'x'.repeat(101), durationMinutes: 30 }],
  ['a name that is not a string', { name: 42, durationMinutes: 30 }],
  [
    'a description over 1000 characters',
    { name: 'Intro call', description: 'd'.repeat(1001), durationMinutes: 30 },
  ],
  ['a missing duration', { name: 'Intro call' }],
  ['a duration under 5', { name: 'Intro call', durationMinutes: 4 }],
  ['a duration over 540', { name: 'Intro call', durationMinutes: 541 }],
  ['a duration that is not whole', { name: 'Intro call', durationMinutes: 30.5 }],
  ['a duration sent as a string', { name: 'Intro call', durationMinutes: '30' }],
  ['a body that is not an object', ['Intro call', 30]],
];

test.each(invalidBodies)('%s is rejected with validation_failed', async (_case, payload) => {
  const app = build();

  const response = await createEventType(app, payload);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
  expect((await listEventTypes(app)).json()).toEqual([]);
});

test('a body that is not parsable JSON is rejected with validation_failed', async () => {
  const app = build();

  const response = await app.inject({
    method: 'POST',
    url: '/api/event-types',
    headers: { 'content-type': 'application/json' },
    payload: '{"name": "Intro call", ',
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});

function getEventType(app: FastifyInstance, id: string) {
  return app.inject({ method: 'GET', url: `/api/event-types/${id}` });
}

test('an event type can be read by its id', async () => {
  const app = build();
  await createEventType(app, { name: 'Other', durationMinutes: 15 });
  const created = await createEventType(app, {
    name: 'Intro call',
    description: 'A short call to get acquainted.',
    durationMinutes: 30,
  });

  const response = await getEventType(app, created.json().id);

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    id: created.json().id,
    name: 'Intro call',
    description: 'A short call to get acquainted.',
    durationMinutes: 30,
  });
});

test.each(['evt_missing', 'constructor', '%20', 'slots'])(
  'reading the unknown id "%s" is 404 event_type_not_found',
  async (id) => {
    const app = build();
    await createEventType(app, { name: 'Intro call', durationMinutes: 30 });

    const response = await getEventType(app, id);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'event_type_not_found', message: expect.any(String) });
  },
);

test('an id of any length is a legal id', async () => {
  const app = build();

  const response = await getEventType(app, 'x'.repeat(500));

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ code: 'event_type_not_found', message: expect.any(String) });
});

test('an id that is not a valid URL component is rejected with validation_failed', async () => {
  const app = build();

  const response = await getEventType(app, '%zz');

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});

test('a body larger than the server reads is rejected with validation_failed', async () => {
  const app = build({ bodyLimit: 64 });

  const response = await createEventType(app, { name: 'x'.repeat(100), durationMinutes: 30 });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});

test('a body that is not JSON is rejected with validation_failed', async () => {
  const app = build();

  const response = await app.inject({
    method: 'POST',
    url: '/api/event-types',
    headers: { 'content-type': 'text/csv' },
    payload: 'Intro call,30',
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});

test('an empty body is rejected with validation_failed', async () => {
  const app = build();

  const response = await app.inject({
    method: 'POST',
    url: '/api/event-types',
    headers: { 'content-type': 'application/json' },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ code: 'validation_failed', message: expect.any(String) });
});
