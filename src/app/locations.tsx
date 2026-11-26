import { useCallback, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Button, Card, Notice, PresetIcon, Screen, Txt, styles } from '@/components/ui';
import { useApp } from '@/state/app';
import { monitoringStatus } from '@/lib/location';
import { usesGoogleSearch } from '@/lib/places';
export default function Locations() {
  const { places, presets, colors } = useApp();
  const [status, setStatus] = useState('');
  // Home is the place most worth a departure reminder, so it's offered until one is saved.
  const hasHome = places.some((p) => p.presetId === 'home' || /^home$/i.test(p.name.trim()));
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () =>
        monitoringStatus()
          .then((value) => {
            if (active) setStatus(value);
          })
          .catch(() => {
            if (active) setStatus('Monitoring is unavailable. Manual check-ins still work.');
          });
      void refresh();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        active = false;
        listener.remove();
      };
    }, []),
  );
  return (
    <Screen
      modal
      title="Locations"
      subtitle="Places you go often. Arrive can remind you to check in when you leave or arrive."
    >
      {!hasHome && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add Home"
          onPress={() => router.push({ pathname: '/location', params: { home: '1' } })}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: 13 })}
        >
          <Card
            style={{
              flexDirection: 'row',
              gap: 14,
              alignItems: 'center',
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: 'transparent',
            }}
          >
            <PresetIcon preset={{ icon: 'home', color: 'peach' }} />
            <View style={{ flex: 1 }}>
              <Txt weight="rounded" style={{ fontSize: 18 }}>
                Home
              </Txt>
              <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
                Add it to get a nudge to check in when you head out.
              </Txt>
            </View>
            <Plus size={18} color={colors.green} />
          </Card>
        </Pressable>
      )}
      {!!places.length && (
        <View style={{ gap: 13 }}>
          {places.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/location', params: { id: p.id } })}
            >
              <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <PresetIcon
                  preset={
                    presets.find((x) => x.id === p.presetId) || { icon: 'pin', color: 'mint' }
                  }
                />
                <View style={{ flex: 1 }}>
                  <Txt weight="rounded" style={{ fontSize: 18 }}>
                    {p.name}
                  </Txt>
                  <Txt tone="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                    {p.address}
                  </Txt>
                  <View style={[styles.row, { gap: 5, marginTop: 7 }]}>
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: p.enabled ? colors.green : colors.muted,
                      }}
                    />
                    <Txt tone={p.enabled ? 'green' : 'muted'} style={{ fontSize: 10 }}>
                      {p.enabled ? 'Remembered' : 'Not remembered'}
                    </Txt>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.muted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
      <Button
        label="Add a location"
        icon={Plus}
        onPress={() => router.push('/location')}
        style={{ marginTop: 24 }}
      />
      {places.length > 0 && <Notice text={status} />}
      <Txt
        tone="muted"
        style={{ textAlign: 'center', fontSize: 11, lineHeight: 18, marginTop: 18 }}
      >
        Always optional. Your check-ins work without a location.{'\n'}Your location is never shared.
        Address searches go to {usesGoogleSearch ? 'Google' : 'Apple'} to find the place.
      </Txt>
    </Screen>
  );
}
