import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('the host creates an event type and sees it in the list', async ({ page }) => {
  // Other tests add event types to the same server, so this one has a name of its own.
  const name = `Intro call ${randomUUID()}`;

  await page.goto('/');
  await page.getByRole('link', { name: 'Event types' }).click();
  await expect(page.getByRole('heading', { name: 'Event types', level: 1 })).toBeVisible();

  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Description').fill('A short call to get acquainted.');
  await page.getByLabel('Duration').fill('45');
  await page.getByRole('button', { name: 'Create event type' }).click();

  const created = page
    .getByRole('list', { name: 'Event types' })
    .getByRole('listitem')
    .filter({ hasText: name });
  await expect(created).toBeVisible();
  await expect(created).toContainText('45 min');
  await expect(created).toContainText('A short call to get acquainted.');

  // The server keeps it, so it is still listed after a reload.
  await page.reload();
  await expect(created).toBeVisible();
});
