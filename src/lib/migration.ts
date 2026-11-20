import * as storage from './storage';
import {
  initialPreferences,
  initialPresets,
  type Person,
  type Place,
  type Preferences,
} from './types';

// Preserve custom shortcuts and places when upgrading the earlier prototype.
// Old account IDs and server messages are never interpreted as local people or native sends.
export async function migrateLocalData() {
  const version = await storage.read('local-version', 0);
  // Checked before anything below writes defaults: saved data means Arrive was already set up.
  const alreadySetUp =
    version > 0 ||
    (await storage.read<unknown>('presets', null)) !== null ||
    (await storage.read<unknown>('places', null)) !== null ||
    (await storage.read<unknown>('people', null)) !== null;
  if (version < 2) {
    const old = await storage.read<Record<string, unknown>>('preferences', {});
    const prefs = { ...initialPreferences };
    for (const key of Object.keys(prefs) as (keyof Preferences)[]) {
      if (key in old && typeof old[key] === typeof prefs[key])
        Object.assign(prefs, { [key]: old[key] });
    }
    prefs.defaultRecipient = '';
    prefs.confirmations =
      old.confirmations === 'all' || old.confirmations === true || old.confirmations === undefined;
    const presets = await storage.read('presets', initialPresets);
    const places = await storage.read<(Place & { behavior?: string })[]>('places', []);
    await storage.write('preferences', prefs);
    await storage.write(
      'presets',
      presets.map((p) => ({ ...p, recipientId: '' })),
    );
    await storage.write(
      'places',
      places.map((p) => {
        const { behavior: _obsolete, ...place } = p;
        return { ...place, recipientId: '' };
      }),
    );
    await storage.removeLegacyData();
  }
  if (version < 3) {
    const presets = await storage.read('presets', initialPresets);
    await storage.write(
      'presets',
      presets.map((preset) =>
        preset.id === 'elsewhere' && preset.name === 'Somewhere else'
          ? { ...preset, name: 'Else' }
          : preset,
      ),
    );
  }
  if (version < 4) {
    const presets = await storage.read('presets', initialPresets);
    let favorites = 0;
    await storage.write(
      'presets',
      presets.map((preset) => {
        if (!preset.favorite) return preset;
        favorites += 1;
        return favorites <= 5 ? preset : { ...preset, favorite: false };
      }),
    );
  }
  if (version < 5) {
    const preferences = await storage.read('preferences', initialPreferences);
    await storage.write('preferences', { ...initialPreferences, ...preferences });
    const presets = await storage.read('presets', initialPresets);
    const renamed = presets.map((preset) =>
      preset.id === 'elsewhere' && ['Else', 'Somewhere else'].includes(preset.name)
        ? { ...preset, name: 'Other' }
        : preset,
    );
    const other = renamed.find((preset) => preset.id === 'elsewhere');
    const rest = renamed.filter((preset) => preset.id !== 'elsewhere');
    const ordered = other ? [other, ...rest] : rest;
    const hasFavorites = ordered.some((preset) => preset.favorite);
    const defaults = new Set(['elsewhere', 'work', 'grocery']);
    await storage.write(
      'presets',
      ordered.map((preset, order) => ({
        ...preset,
        order,
        favorite: hasFavorites ? preset.favorite : defaults.has(preset.id),
      })),
    );
  }
  if (version < 6) {
    const presets = await storage.read('presets', initialPresets);
    const ordered = [...presets].sort((a, b) => a.order - b.order);
    let favorites = 0;
    const capped = ordered.map((preset) => {
      if (!preset.favorite) return preset;
      favorites += 1;
      return favorites <= 4 ? preset : { ...preset, favorite: false };
    });
    if (favorites < 2) {
      for (let index = 0; index < capped.length && favorites < 2; index += 1) {
        if (capped[index].favorite) continue;
        capped[index] = { ...capped[index], favorite: true };
        favorites += 1;
      }
    }
    await storage.write('presets', capped);
  }
  if (version < 7 && alreadySetUp) {
    // Onboarding now opens on its own for new installs. Anyone upgrading has used Arrive
    // already, so they skip it.
    const prefs = await storage.read<Partial<Preferences>>('preferences', {});
    if (!prefs.onboardingDone)
      await storage.write('preferences', { ...prefs, onboardingDone: true });
  }
  if (version < 8) {
    // Arrive now keeps one person. Keep the default person (or else the first) and remove the
    // rest; check-ins and places that named someone go to the kept person.
    const people = await storage.read<Person[]>('people', []);
    const prefs = await storage.read<Preferences>('preferences', initialPreferences);
    const kept = people.find((p) => p.id === prefs.defaultRecipient) ?? people[0];
    if (people.length > 1 || (kept && prefs.defaultRecipient !== kept.id)) {
      await storage.write('people', kept ? [kept] : []);
      // A pairing belonged to someone who was removed: Smart Reminders end with them.
      const pairingRemoved = people.some((p) => p.smartPaired && p.id !== kept?.id);
      await storage.write('preferences', {
        ...prefs,
        defaultRecipient: kept?.id ?? '',
        ...(pairingRemoved ? { smartReminders: false } : {}),
      });
    }
    const presets = await storage.read('presets', initialPresets);
    await storage.write(
      'presets',
      presets.map((p) => ({ ...p, recipientId: '' })),
    );
    const places = await storage.read<Place[]>('places', []);
    await storage.write(
      'places',
      places.map((p) => ({ ...p, recipientId: '' })),
    );
  }
  await storage.write('local-version', 8);
}
