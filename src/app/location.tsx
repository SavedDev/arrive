import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Field,
  IconButton,
  Row,
  Screen,
  Section,
  Toggle,
  Txt,
  goBack,
  styles,
} from '@/components/ui';
import { errorMessage, validCoordinates } from '@/lib/domain';
import { onMapPicked, setMapStart } from '@/lib/map-picker';
import { requestMonitoring, syncGeofences } from '@/lib/location';
import {
  formatAddress,
  resolvePlace,
  searchPlaces,
  usesGoogleSearch,
  type PlaceSuggestion,
} from '@/lib/places';
import type { Place } from '@/lib/types';
import { useApp } from '@/state/app';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { LocateFixed, Map as MapIcon, MapPin, Search, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
type Coordinate = { latitude: number; longitude: number };
export default function LocationEditor() {
  const { id, home } = useLocalSearchParams<{ id?: string; home?: string }>();
  const app = useApp();
  const existing = app.places.find((p) => p.id === id);
  // "Add Home" from the Locations list starts with the name and Home check-in filled in.
  const homePreset = home === '1' ? app.presets.find((p) => p.id === 'home') : undefined;
  const [editorId] = useState(() => existing?.id || Crypto.randomUUID());
  const [start] = useState(() => ({
    name: existing?.name || (home === '1' ? 'Home' : ''),
    presetId: existing?.presetId || homePreset?.id || app.presets[0]?.id || '',
  }));
  const [name, setName] = useState(start.name),
    [address, setAddress] = useState(existing?.address || ''),
    [coordinate, setCoordinate] = useState<Coordinate | undefined>(
      existing ? { latitude: existing.latitude, longitude: existing.longitude } : undefined,
    );
  const [preset, setPreset] = useState(start.presetId),
    [enabled, setEnabled] = useState(existing?.enabled || false),
    departure = existing?.departureReminder || false;
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<PlaceSuggestion[]>([]),
    [searching, setSearching] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [leaving, setLeaving] = useState(false);
  const navigation = useNavigation();
  const [discard, setDiscard] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);
  // Edits in progress: Save turns on, and closing the sheet asks first.
  const dirty =
    name !== start.name ||
    address !== (existing?.address || '') ||
    coordinate?.latitude !== existing?.latitude ||
    coordinate?.longitude !== existing?.longitude ||
    preset !== start.presetId ||
    enabled !== (existing?.enabled || false) ||
    departure !== (existing?.departureReminder || false);
  // Once you choose to discard, the guard steps aside and the close goes through.
  const [discarded, setDiscarded] = useState<typeof discard>(null);
  usePreventRemove(dirty && !leaving && !discarded, ({ data }) => setDiscard(data.action));
  useEffect(() => {
    if (discarded) navigation.dispatch(discarded);
  }, [discarded, navigation]);
  useEffect(() => {
    if (leaving) goBack();
  }, [leaving]);
  // The map sheet hands back the pin it was left on.
  useEffect(() => onMapPicked((c) => void describe(c)));
  // One billing session per search-and-pick, as Google Places expects.
  const session = useRef(Crypto.randomUUID());
  const near = useRef<Coordinate | undefined>(undefined);
  const picked = useRef('');
  useEffect(() => {
    // Bias results near the user only if location access was already granted. Never prompt here.
    if (Platform.OS === 'web') return;
    void Location.getForegroundPermissionsAsync()
      .then((p) => (p.granted ? Location.getLastKnownPositionAsync() : null))
      .then((pos) => {
        if (pos) near.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3 || text === picked.current) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(
      () => {
        setSearching(true);
        searchPlaces(text, session.current, near.current)
          .then((r) => {
            if (!active) return;
            setResults(r);
            if (!r.length)
              setError('No match found. Try a fuller address, or set the pin in the map.');
            else setError('');
          })
          .catch((e) => active && setError(errorMessage(e)))
          .finally(() => active && setSearching(false));
      },
      // The phone's geocoder is rate limited, so wait longer between searches without Google.
      usesGoogleSearch ? 300 : 700,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  async function choose(s: PlaceSuggestion) {
    setError('');
    setSearching(true);
    try {
      const place = await resolvePlace(s, session.current);
      session.current = Crypto.randomUUID();
      setCoordinate({ latitude: place.latitude, longitude: place.longitude });
      setAddress(place.address);
      if (!name.trim()) setName(place.name.slice(0, 40));
      picked.current = place.address;
      setQuery(place.address);
      setResults([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSearching(false);
    }
  }
  async function describe(c: Coordinate) {
    setCoordinate(c);
    if (Platform.OS === 'web') {
      setAddress('Pinned location');
      return;
    }
    const [a] = await Location.reverseGeocodeAsync(c).catch(() => []);
    const line = a ? formatAddress(a) : 'Pinned location';
    setAddress(line);
    picked.current = line;
    setQuery(line);
    setResults([]);
  }
  async function locateMe() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          'Location access is off. Search for an address or set the pin in the map instead.',
        );
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await describe({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setError('');
    setBusy(true);
    try {
      if (!name.trim()) throw new Error('Give this place a name.');
      if (name.length > 40) throw new Error('That name is too long. Try a shorter one.');
      if (!coordinate || !validCoordinates(coordinate.latitude, coordinate.longitude))
        throw new Error(
          'Search for an address, use your current location, or set the pin in the map.',
        );
      if (!preset) throw new Error('Create a check-in first.');
      if (enabled) await requestMonitoring();
      const p: Place = {
        id: editorId,
        name: name.trim(),
        address: address.trim() || 'Pinned location',
        ...coordinate,
        radius: 150,
        presetId: preset,
        // Check-ins from this place go to your one person.
        recipientId: '',
        enabled,
        departureReminder: departure,
      };
      const next = [...app.places.filter((x) => x.id !== p.id), p];
      if (next.filter((x) => x.enabled).length > 20)
        throw new Error('Arrive monitors up to 20 places. Turn off another place first.');
      await app.savePlace(p);
      await syncGeofences(next);
      setLeaving(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      modal
      footer={
        <Button
          label="Save location"
          onPress={save}
          loading={busy}
          // Nothing to save until something changes.
          disabled={!!existing && !dirty}
        />
      }
      message={{ text: error, error: true, onHide: () => setError('') }}
      title={existing ? existing.name : 'Add a place'}
      action={
        existing && (
          <IconButton
            icon={Trash2}
            label="Delete location"
            color={app.colors.danger}
            onPress={() => setDeleting(true)}
          />
        )
      }
    >
      <Field
        label="Place name"
        strongLabel
        placeholder="e.g. Home"
        value={name}
        maxLength={40}
        onChangeText={setName}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Search for a place"
            strongLabel
            placeholder="Address or place name"
            value={query}
            onChangeText={(v) => {
              picked.current = '';
              setQuery(v);
            }}
            autoCorrect={false}
            returnKeyType="search"
            style={{ marginBottom: 0 }}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          {busy ? (
            <View style={{ width: 54, height: 54, justifyContent: 'center' }}>
              <ActivityIndicator color={app.colors.green} />
            </View>
          ) : (
            <IconButton
              icon={LocateFixed}
              label="Use my current location"
              color={app.colors.green}
              onPress={() => void locateMe()}
              style={{
                width: 54,
                height: 54,
                borderRadius: 15,
                backgroundColor: app.colors.softGreen,
              }}
            />
          )}
        </View>
      </View>
      {(searching || results.length > 0) && (
        <Card style={{ padding: 6, marginTop: -8, marginBottom: 16 }}>
          {searching && !results.length && (
            <ActivityIndicator color={app.colors.green} style={{ padding: 14 }} />
          )}
          {results.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${r.title}${r.subtitle ? `, ${r.subtitle}` : ''}`}
              onPress={() => choose(r)}
              style={({ pressed }) => [
                styles.row,
                { padding: 12, borderRadius: 16, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Search size={17} color={app.colors.muted} />
              <View style={{ flex: 1 }}>
                <Txt weight="medium" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
                  {r.title}
                </Txt>
                {!!r.subtitle && (
                  <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17 }} numberOfLines={1}>
                    {r.subtitle}
                  </Txt>
                )}
              </View>
            </Pressable>
          ))}
          {usesGoogleSearch && results.length > 0 && (
            <Txt tone="muted" style={{ fontSize: 10, textAlign: 'right', paddingHorizontal: 12 }}>
              Powered by Google
            </Txt>
          )}
        </Card>
      )}
      {coordinate && (
        <View style={[styles.row, { marginBottom: 14 }]}>
          <MapPin size={18} color={app.colors.green} />
          <Txt style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
            {address || 'Pinned location'}
          </Txt>
        </View>
      )}
      <Button
        label="View in map"
        icon={MapIcon}
        variant="secondary"
        onPress={() => {
          setMapStart(coordinate);
          router.push('/map');
        }}
      />
      <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17, marginTop: 8 }}>
        You can drag the pin on the map to mark the exact spot.
      </Txt>
      <Section title="Your check-in" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {app.presets.map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            active={preset === p.id}
            onPress={() => setPreset(p.id)}
          />
        ))}
      </View>
      <Section title="Smart Check-In" />
      <Row
        title="Remember this place"
        subtitle="When you leave, Arrive reminds you on your Lock Screen to check in. Needs location access set to Always."
        right={<Toggle value={enabled} onChange={setEnabled} label="Remember this place" />}
      />
      <Txt
        tone="muted"
        style={{ textAlign: 'center', fontSize: 11, lineHeight: 18, marginTop: 18 }}
      >
        Your location is never shared.
      </Txt>
      <ConfirmDialog
        visible={!!discard}
        title="Discard your changes?"
        message="Your edits to this place won’t be saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => setDiscard(null)}
        onConfirm={() => {
          // Turn the unsaved-changes guard off first, then close (see the effect above);
          // closing straight away would be caught by the guard and ask again.
          setDiscarded(discard);
          setDiscard(null);
        }}
      />
      {existing && (
        <ConfirmDialog
          visible={deleting}
          title="Delete this place?"
          message="Arrive will stop reminding you about it."
          confirmLabel="Yes, delete it"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false);
            app
              .deletePlace(existing.id)
              .then(() => syncGeofences(app.places.filter((p) => p.id !== existing.id)))
              .then(() => setLeaving(true))
              .catch((e) => setError(errorMessage(e)));
          }}
        />
      )}
    </Screen>
  );
}
