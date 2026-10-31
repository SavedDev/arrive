import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import {
  initialPreferences,
  initialPresets,
  type Preset,
  type Place,
  type Preferences,
  type Person,
  type HistoryEntry,
} from '@/lib/types';
import * as storage from '@/lib/storage';
import { migrateLocalData } from '@/lib/migration';
import { recentHistory } from '@/lib/history';
import { validatePerson } from '@/lib/people';
import {
  MAX_ACTIVITY_SHORTCUTS,
  MIN_ACTIVITY_SHORTCUTS,
  sortedPresets,
  validatePreset,
  errorMessage,
} from '@/lib/domain';
import { dark, light } from '@/design/theme';
import { stopMonitoring } from '@/lib/location';
import { clearNotifications } from '@/lib/notifications';
import { reconcileReminder } from '@/lib/reminder-runtime';
import { disconnectSmartReminders } from '@/lib/smart-reminders';

type Model = {
  ready: boolean;
  error: string;
  dismissError: () => void;
  prefs: Preferences;
  presets: Preset[];
  places: Place[];
  people: Person[];
  history: HistoryEntry[];
  colors: typeof light;
  isDark: boolean;
  updatePrefs: (p: Partial<Preferences>) => Promise<void>;
  savePreset: (p: Preset) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  reorderPreset: (id: string, direction: number) => Promise<void>;
  savePlace: (p: Place) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  savePerson: (p: Person, makeDefault: boolean) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  /** Marks who this phone is paired with for Smart Reminders, or nobody. */
  setSmartPartner: (id: string | null) => Promise<void>;
  reorderPeople: (ids: string[]) => Promise<void>;
  refreshHistory: () => Promise<void>;
  recordHistory: (e: HistoryEntry) => Promise<void>;
  clearHistory: () => Promise<void>;
  clearAppData: () => Promise<void>;
};
const Context = createContext<Model | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [prefs, setPrefs] = useState(initialPreferences),
    [presets, setPresets] = useState(initialPresets),
    [places, setPlaces] = useState<Place[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [history, setHistory] = useState<HistoryEntry[]>([]);
  const state = useRef({ prefs, presets, places, people });
  useEffect(() => {
    state.current = { prefs, presets, places, people };
  }, [prefs, presets, places, people]);
  const scheme = useColorScheme();
  const isDark = prefs.theme === 'dark' || (prefs.theme === 'system' && scheme === 'dark');
  const refreshHistory = useCallback(async () => {
    setHistory(await storage.update<HistoryEntry[]>('history', [], recentHistory));
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      await migrateLocalData();
      const [p, pr, pl, pe] = await Promise.all([
        storage.read('preferences', initialPreferences),
        storage.read('presets', initialPresets),
        storage.read<Place[]>('places', []),
        storage.read<Person[]>('people', []),
      ]);
      await refreshHistory();
      if (!active) return;
      setPrefs({ ...initialPreferences, ...p });
      setPresets(pr);
      setPlaces(pl);
      setPeople(pe);
      setReady(true);
    })().catch((e) => setError(`Local storage: ${errorMessage(e)}`));
    return () => {
      active = false;
    };
  }, [refreshHistory]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshHistory().catch((e) => setError(errorMessage(e)));
    });
    // Also expire entries when the app is left open on Home or History.
    const timer = setInterval(() => {
      void refreshHistory().catch((e) => setError(errorMessage(e)));
    }, 60000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [refreshHistory]);
  async function updatePrefs(p: Partial<Preferences>) {
    const next = await storage.update('preferences', initialPreferences, (current) => ({
      ...current,
      ...p,
    }));
    state.current.prefs = next;
    setPrefs(next);
  }
  async function savePreset(p: Preset) {
    validatePreset(p);
    const existing = state.current.presets.find((preset) => preset.id === p.id);
    const favoriteCount = state.current.presets.filter((preset) => preset.favorite).length;
    if (
      p.favorite &&
      !existing?.favorite &&
      favoriteCount >= MAX_ACTIVITY_SHORTCUTS
    )
      throw new Error('Keep no more than 4 favorite check-ins for your Lock Screen banner.');
    if (existing?.favorite && !p.favorite && favoriteCount <= MIN_ACTIVITY_SHORTCUTS)
      throw new Error('Keep at least 2 favorite check-ins for your Lock Screen banner.');
    const next = [
      ...state.current.presets.filter((x) => x.id !== p.id),
      { ...p, name: p.name.trim(), message: p.message.trim() },
    ];
    await storage.write('presets', next);
    state.current.presets = next;
    setPresets(next);
    // The Lock Screen reminder shows check-ins as buttons.
    void reconcileReminder().catch(() => {});
  }
  async function deletePreset(id: string) {
    const preset = state.current.presets.find((item) => item.id === id);
    if (
      preset?.favorite &&
      state.current.presets.filter((item) => item.favorite).length <= MIN_ACTIVITY_SHORTCUTS
    )
      throw new Error('Keep at least 2 favorite check-ins for your Lock Screen banner.');
    if (state.current.places.some((p) => p.presetId === id))
      throw new Error('Remove this check-in from its saved locations first.');
    const next = state.current.presets.filter((p) => p.id !== id);
    await storage.write('presets', next);
    state.current.presets = next;
    setPresets(next);
    void reconcileReminder().catch(() => {});
    if (state.current.prefs.defaultPreset === id) await updatePrefs({ defaultPreset: '' });
  }
  async function reorderPreset(id: string, direction: number) {
    const list = sortedPresets(state.current.presets);
    const index = list.findIndex((p) => p.id === id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const next = list.map((p, order) => ({ ...p, order }));
    await storage.write('presets', next);
    state.current.presets = next;
    setPresets(next);
  }
  async function savePlace(p: Place) {
    const next = [...state.current.places.filter((x) => x.id !== p.id), p];
    await storage.write('places', next);
    state.current.places = next;
    setPlaces(next);
  }
  async function deletePlace(id: string) {
    const next = state.current.places.filter((p) => p.id !== id);
    await storage.write('places', next);
    state.current.places = next;
    setPlaces(next);
  }

  async function savePerson(p: Person, makeDefault: boolean) {
    const clean: Person = {
      id: p.id,
      ...validatePerson(p),
      ...(p.photo ? { photo: p.photo } : {}),
      // Editing someone's name or number keeps their Smart Reminders pairing.
      ...((p.smartPaired ?? state.current.people.find((x) => x.id === p.id)?.smartPaired)
        ? { smartPaired: true }
        : {}),
    };
    if (state.current.people.some((x) => x.phone === clean.phone && x.id !== p.id))
      throw new Error('This phone number is already saved. Edit the existing person instead.');
    // Edits keep their place in the list; new people go to the end.
    const next = await storage.update<Person[]>('people', [], (current) =>
      current.some((x) => x.id === p.id)
        ? current.map((x) => (x.id === p.id ? clean : x))
        : [...current, clean],
    );
    state.current.people = next;
    setPeople(next);
    if (makeDefault) await updatePrefs({ defaultRecipient: p.id });
    else if (state.current.prefs.defaultRecipient === p.id)
      await updatePrefs({ defaultRecipient: '' });
  }
  async function reorderPeople(ids: string[]) {
    const next = await storage.update<Person[]>('people', [], (current) => [
      ...ids.flatMap((id) => current.filter((p) => p.id === id)),
      ...current.filter((p) => !ids.includes(p.id)),
    ]);
    state.current.people = next;
    setPeople(next);
  }
  async function deletePerson(id: string) {
    // Removing the paired person ends the pair; nobody else is affected.
    if (state.current.people.find((p) => p.id === id)?.smartPaired) {
      await disconnectSmartReminders();
      await updatePrefs({ smartReminders: false });
    }
    const next = await storage.update<Person[]>('people', [], (current) =>
      current.filter((p) => p.id !== id),
    );
    state.current.people = next;
    setPeople(next);
    const pr = state.current.presets.map((p) =>
      p.recipientId === id ? { ...p, recipientId: '' } : p,
    );
    const pl = state.current.places.map((p) =>
      p.recipientId === id ? { ...p, recipientId: '' } : p,
    );
    await storage.write('presets', pr);
    await storage.write('places', pl);
    state.current.presets = pr;
    state.current.places = pl;
    setPresets(pr);
    setPlaces(pl);
    if (state.current.prefs.defaultRecipient === id) await updatePrefs({ defaultRecipient: '' });
  }
  async function setSmartPartner(id: string | null) {
    const next = await storage.update<Person[]>('people', [], (current) =>
      current.map(({ smartPaired: _, ...p }) => (p.id === id ? { ...p, smartPaired: true } : p)),
    );
    state.current.people = next;
    setPeople(next);
  }
  async function recordHistory(entry: HistoryEntry) {
    setHistory(
      await storage.update<HistoryEntry[]>('history', [], (current) =>
        recentHistory([entry, ...current.filter((e) => e.id !== entry.id)]),
      ),
    );
  }
  async function clearHistory() {
    await storage.write('history', []);
    setHistory([]);
  }
  async function clearAppData() {
    await disconnectSmartReminders();
    await stopMonitoring();
    await clearNotifications();
    await storage.clearAll();
    await storage.write('local-version', 6);
    setPrefs(initialPreferences);
    setPresets(initialPresets);
    setPlaces([]);
    setPeople([]);
    setHistory([]);
    setError('');
  }
  return (
    <Context.Provider
      value={{
        ready,
        error,
        dismissError: () => setError(''),
        prefs,
        presets: sortedPresets(presets),
        places,
        people,
        history,
        colors: isDark ? dark : light,
        isDark,
        updatePrefs,
        savePreset,
        deletePreset,
        reorderPreset,
        savePlace,
        deletePlace,
        savePerson,
        deletePerson,
        setSmartPartner,
        reorderPeople,
        refreshHistory,
        recordHistory,
        clearHistory,
        clearAppData,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider is required');
  return value;
}
