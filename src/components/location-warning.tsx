import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { MapPinOff } from 'lucide-react-native';
import { Txt } from '@/components/ui';
import { syncGeofences } from '@/lib/location';
import { useApp } from '@/state/app';

/**
 * Smart Check-In starts on its own when you leave a place, which needs Always location. When
 * that's off, Home says so plainly and offers the fix. Manual check-ins still work either way.
 */
export function LocationWarning() {
  const { colors, prefs, places } = useApp();
  const [always, setAlways] = useState<boolean | null>(null);
  const refresh = useCallback(() => {
    void Location.getBackgroundPermissionsAsync()
      .then((p) => setAlways(p.granted))
      .catch(() => setAlways(null));
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    refresh();
    // Coming back from iOS Settings is when the permission usually changes.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  if (Platform.OS === 'web' || !prefs.smartCheckIn || always !== false) return null;

  async function fix() {
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      const background = foreground.granted
        ? await Location.requestBackgroundPermissionsAsync()
        : null;
      // iOS asks for Always only once; after that it can only be changed in Settings.
      if (!background?.granted) await Linking.openSettings();
      else await syncGeofences(places);
    } catch {
      await Linking.openSettings().catch(() => {});
    } finally {
      refresh();
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Always location is off. Turn it on for Smart Check-In"
      onPress={() => void fix()}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 14,
        padding: 14,
        borderRadius: 20,
        backgroundColor: colors.softOrange,
        borderWidth: 1,
        borderColor: `${colors.orange}55`,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${colors.orange}22`,
        }}
      >
        <MapPinOff size={19} color={colors.orange} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="rounded" style={{ fontSize: 15, lineHeight: 21 }}>
          Always location is off
        </Txt>
        <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
          Smart Check-In can’t notice when you leave. Tap to turn it on.
        </Txt>
      </View>
      <Txt weight="bold" style={{ fontSize: 13, color: colors.orange }}>
        Fix
      </Txt>
    </Pressable>
  );
}
