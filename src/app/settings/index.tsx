import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import {
  ArrowRight,
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
import { LockScreenArt, PlusArt } from '@/components/illustrations';
import { useApp } from '@/state/app';
import { accents } from '@/design/theme';
import type { SettingsSection } from './[section]';
type Tile = { title: string; icon?: LucideIcon; href: Href };
const section = (id: SettingsSection): Href => ({
  pathname: '/settings/[section]',
  params: { section: id },
});
export default function Settings() {
  const app = useApp(),
    { colors, isDark, prefs } = app;
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
  const cream = accents.cream;
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
      <Banner
        label="Open Arrive Plus"
        onPress={() => router.push('/subscription')}
        background={isDark ? cream.dark : cream.bg}
        eyebrow="ARRIVE PLUS"
        eyebrowColor={isDark ? '#F2D071' : cream.ink}
        title={'Little check-ins.\nA closer you.'}
        cta="See what’s included"
        art={<PlusArt width={132} height={112} />}
      />
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
      <View style={{ marginTop: 22 }}>
        <Banner
          label="Set up the Lock Screen widget"
          onPress={() => router.push('/widget')}
          background={colors.softGreen}
          eyebrow="LOCK SCREEN WIDGET"
          eyebrowColor={colors.green}
          title={'Start a check-in\nfrom your Lock Screen.'}
          cta="Set up the widget"
          art={<LockScreenArt width={112} height={122} />}
        />
      </View>
      <Txt tone="muted" style={{ textAlign: 'center', marginTop: 25, fontSize: 12 }}>
        Arrive {Constants.expoConfig?.version || '1.0.0'} · A little check-in. A lot of love.
      </Txt>
    </Screen>
  );
}
function Banner({
  label,
  onPress,
  background,
  eyebrow,
  eyebrowColor,
  title,
  cta,
  art,
}: {
  label: string;
  onPress: () => void;
  background: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  cta: string;
  art: ReactNode;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: background,
        borderRadius: 26,
        padding: 21,
        minHeight: 150,
        overflow: 'hidden',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ position: 'absolute', right: 0, bottom: 0 }}>{art}</View>
      <View style={{ maxWidth: '60%', gap: 6 }}>
        <Txt weight="bold" style={{ fontSize: 10, letterSpacing: 1.6, color: eyebrowColor }}>
          {eyebrow}
        </Txt>
        <Txt weight="rounded" style={{ fontSize: 20, lineHeight: 26 }}>
          {title}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <Txt weight="bold" style={{ fontSize: 12, color: colors.green }}>
            {cta}
          </Txt>
          <ArrowRight size={14} color={colors.green} />
        </View>
      </View>
    </Pressable>
  );
}
