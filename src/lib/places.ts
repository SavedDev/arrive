import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';

// Google Places (New) autocomplete when EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is set.
// Without a key, search falls back to the phone's built-in geocoder.
const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
const BASE = 'https://places.googleapis.com/v1';
export const usesGoogleSearch = Boolean(KEY);

export type PlaceSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  /** Present when the result already has coordinates (device geocoder). */
  coordinate?: { latitude: number; longitude: number };
};
export type ResolvedPlace = { latitude: number; longitude: number; address: string; name: string };
type Near = { latitude: number; longitude: number };

function googleHeaders(fieldMask?: string) {
  const bundle = Constants.expoConfig?.ios?.bundleIdentifier;
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': KEY,
    // Lets the key be restricted to this iOS app in Google Cloud.
    ...(Platform.OS === 'ios' && bundle ? { 'X-Ios-Bundle-Identifier': bundle } : {}),
    ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
  };
}
async function googleJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `Place search is unavailable right now${body?.error?.message ? ` (${body.error.message})` : ''}. Try again, or tap the map to drop a pin.`,
    );
  return body as T;
}

export async function searchPlaces(
  query: string,
  session: string,
  near?: Near,
): Promise<PlaceSuggestion[]> {
  const input = query.trim();
  if (input.length < 3) return [];
  if (KEY) {
    const body = await googleJson<{
      suggestions?: {
        placePrediction?: {
          placeId: string;
          text?: { text: string };
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        };
      }[];
    }>(
      await fetch(`${BASE}/places:autocomplete`, {
        method: 'POST',
        headers: googleHeaders(),
        body: JSON.stringify({
          input,
          sessionToken: session,
          ...(near ? { locationBias: { circle: { center: near, radius: 50000 } } } : {}),
        }),
      }),
    );
    return (body.suggestions || []).flatMap(({ placePrediction: p }) =>
      p
        ? [
            {
              id: p.placeId,
              title: p.structuredFormat?.mainText?.text || p.text?.text || '',
              subtitle: p.structuredFormat?.secondaryText?.text || '',
            },
          ]
        : [],
    );
  }
  if (Platform.OS === 'web')
    throw new Error('Address search is available in the mobile app. Tap the map to drop a pin.');
  const found = (await Location.geocodeAsync(input)).slice(0, 5);
  return Promise.all(
    found.map(async (c, i) => {
      const [a] = await Location.reverseGeocodeAsync(c).catch(() => []);
      const line = a ? formatAddress(a) : input;
      const [title, ...rest] = line.split(', ');
      return {
        id: `device-${i}`,
        title,
        subtitle: rest.join(', '),
        coordinate: { latitude: c.latitude, longitude: c.longitude },
      };
    }),
  );
}

export async function resolvePlace(s: PlaceSuggestion, session: string): Promise<ResolvedPlace> {
  const address = [s.title, s.subtitle].filter(Boolean).join(', ');
  if (s.coordinate) return { ...s.coordinate, address, name: s.title };
  const place = await googleJson<{
    location?: { latitude: number; longitude: number };
    formattedAddress?: string;
    displayName?: { text: string };
  }>(
    await fetch(
      `${BASE}/places/${encodeURIComponent(s.id)}?sessionToken=${encodeURIComponent(session)}`,
      { headers: googleHeaders('location,formattedAddress,displayName') },
    ),
  );
  if (!place.location) throw new Error('That place has no map location. Try another result.');
  return {
    ...place.location,
    address: place.formattedAddress || address,
    name: place.displayName?.text || s.title,
  };
}

export function formatAddress(a: Location.LocationGeocodedAddress) {
  if (a.formattedAddress) return a.formattedAddress;
  const street = [a.streetNumber, a.street].filter(Boolean).join(' ') || a.name;
  const region = [a.region, a.postalCode].filter(Boolean).join(' ');
  return [street, a.city, region].filter(Boolean).join(', ') || 'Selected location';
}
