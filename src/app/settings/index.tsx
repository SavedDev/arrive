import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import {
  Bell,
  Clock,
  HelpCircle,
  FlaskConical,
  MapPin,
  Palette,
  Shield,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Avatar, IconButton, Notice, Screen, Txt } from '@/components/ui';
import { PlusBanner } from '@/components/plus-banner';
import { useApp } from '@/state/app';
import type { SettingsSection } from './[section]';
type Tile = { title: string; icon?: LucideIcon; href: Href };
const section = (id: SettingsSection): Href => ({
  pathname: '/settings/[section]',
  params: { section: id },
});
export default function Settings() {
  const app = useApp(),
    { colors, prefs } = app;
  const person = app.people.find((p) => p.id === prefs.defaultRecipient) || app.people[0];
  const tiles: Tile[] = [
    { title: 'People', icon: person ? undefined : Users, href: '/people' },
    { title: 'Locations', icon: MapPin, href: '/locations' },
    { title: 'Smart Check-In', icon: Bell, href: section('reminders') },
    { title: 'History', icon: Clock, href: '/history' },
    { title: 'Permissions', icon: SlidersHorizontal, href: section('permissions') },
    { title: 'Appearance', icon: Palette, href: section('appearance') },
    { title: 'Privacy & data', icon: Shield, href: section('privacy') },
    { title: 'Help & support', icon: HelpCircle, href: section('support') },
  ];
  return (
    <Screen
      back
      title="Settings"
      action={
        __DEV__ ? (
          <IconButton
            icon={FlaskConical}
            label="Open developer tests"
            onPress={() => router.push(section('developer'))}
            style={{ backgroundColor: colors.subtle, width: 42, height: 42 }}
          />
        ) : undefined
      }
    >
      <Notice text={app.error} error />
      <PlusBanner />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Pressable
              key={t.title}
              accessibilityRole="button"
              accessibilityLabel={t.title}
              onPress={() => router.push(t.href)}
              style={({ pressed }) => ({
                flexBasis: '47%',
                flexGrow: 1,
                minHeight: 112,
                padding: 16,
                borderRadius: 22,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: 'space-between',
                gap: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {Icon ? (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: colors.softGreen,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={colors.green} strokeWidth={1.7} />
                </View>
              ) : (
                <Avatar person={person} size={40} />
              )}
              <Txt weight="rounded" style={{ fontSize: 16, lineHeight: 21 }}>
                {t.title}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt tone="muted" style={{ textAlign: 'center', marginTop: 25, fontSize: 12 }}>
        Arrive {Constants.expoConfig?.version || '1.0.0'} · A little check-in. A lot of love.
      </Txt>
    </Screen>
  );
}
