import { test, expect, type Locator, type Page } from '@playwright/test';
// Home's check-ins send on tap and open the editor on a long press.
async function hold(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}
test('backendless home and native messaging unavailable on web are honest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  await expect(page.getByText('LAST CHECK-IN')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await expect(page.getByText('Hold to edit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send Gym', exact: true }).click();
  await expect(page.getByText('Add your person first', { exact: false })).toBeVisible();
  await page.goto('/person');
  await page.getByLabel('Person’s name', { exact: true }).fill('Sarah');
  await page.getByLabel('Phone number', { exact: true }).fill('+1 (312) 555-0123');
  await page.getByRole('button', { name: 'Confirm and save person' }).click();
  await page.goto('/');
  await expect(page.getByText('Keeping 1 person in the loop', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send Gym', exact: true }).click();
  await expect(page.getByText(/Messaging is unavailable/)).toBeVisible();
  await page.goto('/history');
  await expect(page.getByText('No check-ins yet!')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Lock Screen preview reorders before the dragged icon is released', async ({ page }) => {
  await page.goto('/');
  const other = page.locator('[aria-label^="Other, position"]');
  const work = page.locator('[aria-label^="Work, position"]');
  await expect(other).toHaveAttribute('aria-label', /position 1 of 3/);
  const from = await other.boundingBox();
  const to = await work.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2 + 8, to!.y + to!.height / 2, { steps: 8 });
  // The held item stays under the pointer while its neighbor animates into the open slot.
  await expect
    .poll(async () => (await work.boundingBox())?.x ?? Number.POSITIVE_INFINITY)
    .toBeLessThan((from!.x + to!.x) / 2);
  await page.mouse.up();
  await expect(other).toHaveAttribute('aria-label', /position 2 of 3/);
  await page.reload();
  await expect(other).toHaveAttribute('aria-label', /position 2 of 3/);
});
test('create, customize, persist, favorite and delete a shortcut', async ({ page }) => {
  await page.goto('/preset');
  await page.getByLabel('Name', { exact: true }).fill('Pickleball');
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
    "I've arrived at Pickleball! ❤️",
  );
  await page.getByLabel('Message', { exact: true }).fill('Made it! See you later ❤️');
  await page.getByLabel('Name', { exact: true }).fill('Courts');
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
    'Made it! See you later ❤️',
  );
  await page.getByRole('button', { name: 'See more icons', exact: true }).click();
  await expect(page.getByText('Food & drink', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'pizza icon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'pizza icon', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Add check-in', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('arrive:presets') || '[]').find(
            (p: { name: string }) => p.name === 'Courts',
          )?.icon,
      ),
    )
    .toBe('pizza');
  await page.goto('/');
  // A 7th check-in starts a new row under the first column, at the same width.
  const first = await page.getByRole('button', { name: 'Send Home', exact: true }).boundingBox();
  const seventh = await page
    .getByRole('button', { name: 'Send Courts', exact: true })
    .boundingBox();
  expect(Math.round(seventh!.x)).toBe(Math.round(first!.x));
  expect(Math.round(seventh!.width)).toBe(Math.round(first!.width));
  await hold(page, page.getByRole('button', { name: 'Send Courts', exact: true }));
  await page.getByLabel('Name', { exact: true }).fill('Courts!');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Discard your changes?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Courts');
  await page.getByRole('button', { name: 'Add to favorites', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete check-in', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete it', exact: true }).click();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Send Courts', exact: true })).toHaveCount(0);
});
test('settings sections and banner labels persist', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Open Arrive Plus' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up the Lock Screen widget' })).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Smart Check-In', exact: true }).click();
  await page.getByRole('button', { name: '10 min', exact: true }).click();
  // Active days: Saturday off, and it stays off.
  await page.getByRole('checkbox', { name: 'Saturday', exact: true }).click();
  await page.goto('/settings/appearance');
  await page.getByRole('switch', { name: 'Button labels', exact: true }).uncheck();
  await expect(page.getByText('Theme', { exact: true })).toHaveCount(0);
  await page.goto('/settings/reminders');
  await page.reload();
  await expect(page.getByRole('button', { name: '10 min', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('checkbox', { name: 'Saturday', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.getByRole('checkbox', { name: 'Monday', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.goto('/settings/appearance');
  await expect(page.getByRole('switch', { name: 'Button labels', exact: true })).not.toBeChecked();
  // Manual check-ins don't depend on Smart Check-In at all.
  await page.getByRole('switch', { name: 'Smart Check-In' }).uncheck();
  await expect(page.getByText('Active days', { exact: true })).toHaveCount(0);
  await page.goto('/settings');
  await page.screenshot({ path: 'test-results/settings-mobile.png', fullPage: true });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/home-mobile-labels-off.png', fullPage: true });
});
test('save a place from current location without granting monitoring permission', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 41.88, longitude: -87.63 });
  // With no Home saved, Locations offers it first, prefilled.
  await page.goto('/locations');
  await page.getByRole('button', { name: 'Add Home', exact: true }).click();
  await expect(page.getByLabel('Place name', { exact: true })).toHaveValue('Home');
  await page.goto('/location');
  await expect(page.getByLabel('Latitude')).toHaveCount(0);
  await page.getByLabel('Place name', { exact: true }).fill('Home');
  await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(page.getByText('Pinned location', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save location', exact: true }).click();
  await page.goto('/locations');
  await expect(page.getByText('Not remembered', { exact: true })).toBeVisible();
  await expect(page.getByText('Pinned location', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Home', exact: true })).toHaveCount(0);
  // Editing: titled by the place, Save waits for a change, and closing asks first.
  await page.getByText('Pinned location', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete location', exact: true })).toBeVisible();
  const save = page.getByRole('button', { name: 'Save location', exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel('Place name', { exact: true }).fill('Home sweet home');
  await expect(save).toBeEnabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Discard your changes?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Place name', { exact: true })).toHaveValue('Home sweet home');
});
test('check-in links send from Home, and the widget guide returns Home', async ({ page }) => {
  await page.goto('/check-in?preset=coffee');
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  // The link asked to send Coffee; with nobody saved yet, Home explains why it can't.
  await expect(page.getByText('Add your person first', { exact: false })).toBeVisible();
  await page.goto('/widget');
  await expect(page.getByText('Lock screen widget', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
});

test('person editing, default selection and removal persist locally', async ({ page }) => {
  await page.goto('/person');
  await page.getByLabel('Person’s name', { exact: true }).fill('Sarah');
  await page.getByLabel('Phone number', { exact: true }).fill('3125550123');
  await page.getByRole('button', { name: 'Confirm and save person' }).click();
  await expect(page.getByText(/Include the country code, for example/)).toBeVisible();
  await page.getByLabel('Phone number', { exact: true }).fill('+1 312 555 0123');
  await page.getByRole('button', { name: 'Confirm and save person' }).click();
  await page.goto('/people');
  await page.reload();
  await expect(page.getByText('Default person', { exact: true })).toBeVisible();
  await expect(page.getByText('+13125550123')).toHaveCount(0);
  await page.getByRole('button', { name: /Sarah/ }).click();
  await page.getByLabel('Person’s name', { exact: true }).fill('Sara');
  await page.getByRole('button', { name: 'Save person', exact: true }).click();
  await page.goto('/');
  await page.getByRole('button', { name: 'Send Gym', exact: true }).click();
  await expect(page.getByText(/Messaging is unavailable/)).toBeVisible();
  await page.goto('/people');
  await page.getByRole('button', { name: /Sara/ }).click();
  await page.getByRole('button', { name: 'Remove person', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove', exact: true }).click();
  await page.goto('/');
  await page.getByRole('button', { name: 'Send Gym', exact: true }).click();
  await expect(page.getByText('Add your person first', { exact: false })).toBeVisible();
});

test('QR generation requires consent and invitation setup has no pairing claims', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/share-qr');
  await page.getByLabel('Your name', { exact: true }).fill('Andy');
  await page.getByLabel('Your phone number', { exact: true }).fill('+13125550123');
  await expect(page.getByRole('button', { name: 'Create my QR' })).toBeDisabled();
  await page.getByRole('switch', { name: 'I agree to share my name and number' }).check();
  await page.getByRole('button', { name: 'Create my QR' }).click();
  await expect(page.getByText('Ask your person to scan this in Arrive.')).toBeVisible();
  await page.screenshot({ path: 'test-results/contact-qr.png', fullPage: true });
  await page.getByRole('switch', { name: 'I agree to share my name and number' }).uncheck();
  await expect(page.getByText('Ask your person to scan this in Arrive.')).toHaveCount(0);
  await page.goto('/people');
  await expect(page.getByRole('button', { name: 'Share Arrive' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('history persists, expires at launch and can be cleared', async ({ page }) => {
  await page.goto('/history');
  await expect(page.getByText('No check-ins yet!')).toBeVisible();
  await page.evaluate(() => {
    const draft = {
      recipientName: 'Sarah',
      presetName: 'Gym',
      icon: 'gym',
      color: 'mint',
      preparedText: 'Recent prepared text',
      status: 'sent',
    };
    localStorage.setItem(
      'arrive:history',
      JSON.stringify([
        {
          ...draft,
          id: 'old',
          preparedText: 'Expired text',
          timestamp: new Date(Date.now() - 72 * 3600000 - 1000).toISOString(),
        },
        { ...draft, id: 'sent', timestamp: new Date(Date.now() - 3600000).toISOString() },
        {
          ...draft,
          id: 'unknown',
          presetName: 'Coffee',
          status: 'unknown',
          timestamp: new Date(Date.now() - 1000).toISOString(),
        },
      ]),
    );
  });
  await page.reload();
  await expect(page.getByText('Sent via Messages', { exact: true })).toBeVisible();
  await expect(page.getByText('Send unverified · Messages opened')).toBeVisible();
  await expect(page.getByText('Expired text')).toHaveCount(0);
  const ids = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('arrive:history') || '[]').map((e: { id: string }) => e.id),
  );
  expect(ids).toEqual(['unknown', 'sent']);
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, clear history', exact: true }).click();
  await expect(page.getByText('No check-ins yet!')).toBeVisible();
});

test('uncertain arrival chooses no destination', async ({ page }) => {
  await page.goto('/check-in?choose=1');
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  // Nothing is sent: the person picks a destination on Home.
  await expect(page.getByText('Add your person first', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/Messaging is unavailable/)).toHaveCount(0);
});

test('upgrade keeps shortcuts and places but removes obsolete account records', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('My check-ins', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    localStorage.removeItem('arrive:local-version');
    localStorage.setItem(
      'arrive:preferences',
      JSON.stringify({
        name: 'Andy',
        autoSend: true,
        defaultRecipient: 'old-account',
        confirmations: 'all',
      }),
    );
    localStorage.setItem(
      'arrive:presets',
      JSON.stringify([
        {
          id: 'gym',
          name: 'My gym',
          icon: 'gym',
          color: 'mint',
          message: 'Here!',
          recipientId: 'old-account',
          order: 0,
          favorite: true,
        },
      ]),
    );
    localStorage.setItem(
      'arrive:places',
      JSON.stringify([
        {
          id: 'gym',
          name: 'Gym',
          address: 'Local place',
          latitude: 41,
          longitude: -87,
          radius: 150,
          presetId: 'gym',
          recipientId: 'old-account',
          behavior: 'auto',
          enabled: false,
          departureReminder: false,
        },
      ]),
    );
    localStorage.setItem('arrive:private:old-account:messages', '[{"id":"old-server-message"}]');
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Send My gym' })).toBeVisible();
  const data = await page.evaluate(() => ({
    prefs: JSON.parse(localStorage.getItem('arrive:preferences')!),
    places: JSON.parse(localStorage.getItem('arrive:places')!),
    private: localStorage.getItem('arrive:private:old-account:messages'),
  }));
  expect(data.prefs.defaultRecipient).toBe('');
  expect(data.prefs.autoSend).toBeUndefined();
  expect(data.places[0].behavior).toBeUndefined();
  expect(data.private).toBeNull();
});
