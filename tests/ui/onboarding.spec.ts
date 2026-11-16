import { test, expect } from '@playwright/test';

test('a new install starts with onboarding, and finishing it lands on Home', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Check in fast.', { exact: true })).toBeVisible();
  await expect(page.getByText('New here? Make yourself at home')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('2 OF 4', { exact: true })).toBeVisible();
  // Back returns to the previous step instead of leaving onboarding.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Check in fast.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  // Your words: the default message, counted against its limit.
  await expect(page.getByText('Make it your own.', { exact: true })).toBeVisible();
  await page.getByLabel('Default check-in message', { exact: true }).fill('Home safe ❤️');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // Reminders is the last step now; there's no widget step.
  await expect(page.getByText('4 OF 4', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Enable notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  // Done for good.
  await page.reload();
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
});

test('Skip finishes onboarding straight away', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip setup', exact: true }).click();
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Check in fast.', { exact: true })).toHaveCount(0);
});

test('someone upgrading with saved check-ins never sees onboarding', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('arrive:local-version', '6');
    localStorage.setItem('arrive:preferences', JSON.stringify({ defaultMessage: 'Hi' }));
  });
  await page.goto('/');
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
});

test('deleting all data starts onboarding again', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip setup', exact: true }).click();
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  await page.goto('/settings');
  await page.goto('/settings/privacy');
  await page.getByRole('button', { name: 'Clear app data', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, clear everything', exact: true }).click();
  await expect(page.getByText('Check in fast.', { exact: true })).toBeVisible();
  // And it stays that way: the cleared app is a new install.
  await page.goto('/');
  await expect(page.getByText('Check in fast.', { exact: true })).toBeVisible();
});

test('the message you set in onboarding is the default', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await page.getByLabel('Default check-in message', { exact: true }).fill('Made it ❤️');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('arrive:preferences') || '{}').defaultMessage,
  );
  expect(saved).toBe('Made it ❤️');
});

test('choosing your person shows them in place of the options, and Remove brings them back', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Manually', exact: true }).click();
  await page.getByLabel('Person’s name', { exact: true }).fill('Kelly');
  await page.getByLabel('Phone number', { exact: true }).fill('+1 312 555 0123');
  await page.getByRole('button', { name: 'Confirm and save person' }).click();
  await expect(page.getByText('2 OF 4', { exact: true })).toBeVisible();
  await expect(page.getByText('+1 312 555 0123', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter Manually', exact: true })).toHaveCount(0);
  await expect(page.getByText(/saved on this device|was added/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove Kelly', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter Manually', exact: true })).toBeVisible();
});
