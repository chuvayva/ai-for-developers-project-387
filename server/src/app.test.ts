import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { build } from './app.ts';

test('GET /api/health responds with ok', async () => {
  const app = build();

  const response = await app.inject({ method: 'GET', url: '/api/health' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});

describe('with a web root', () => {
  const root = mkdtempSync(join(tmpdir(), 'calendar-web-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Calendar</title>');
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'assets', 'app.js'), 'console.log(1);');
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  test('serves a file of the interface', async () => {
    const app = build({ webRoot: root });

    const response = await app.inject({ method: 'GET', url: '/assets/app.js' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('console.log(1);');
  });

  test('answers a page path with index.html', async () => {
    const app = build({ webRoot: root });

    const response = await app.inject({ method: 'GET', url: '/host/bookings' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<title>Calendar</title>');
  });

  test('keeps the API working', async () => {
    const app = build({ webRoot: root });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.json()).toEqual({ status: 'ok' });
  });

  test('answers an unknown API path with 404, not the interface', async () => {
    const app = build({ webRoot: root });

    const response = await app.inject({ method: 'GET', url: '/api/unknown' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
