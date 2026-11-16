import { useAddContact } from '@/components/add-contact';
import {
  CheckInArt,
  CheckInFlowArt,
  MessageArt,
  PeopleArt,
  Scribble,
} from '@/components/onboarding-art';
import { Avatar, Button, Field, Notice, Screen, Toggle, Txt } from '@/components/ui';
import { accents } from '@/design/theme';
import { errorMessage } from '@/lib/domain';
import { enableNotifications } from '@/lib/notifications';
import type { Person } from '@/lib/types';
import { useApp } from '@/state/app';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import * as Notifications from 'expo-notifications';
import { Redirect, router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Keyboard,
  ScanLine,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
/** Onboarding's steps: what Arrive does, your person, your words, reminders. */
const STEPS = 4;
const MESSAGE_MAX = 120;
export default function Welcome() {
  const app = useApp();
  const contact = useAddContact();
  const [step, setStep] = useState(0),
    [message, setMessage] = useState(app.prefs.defaultMessage),
    [error, setError] = useState('');
  const { width } = useWindowDimensions();
  // Onboarding sets up one person: whoever was added last. Picking someone else replaces them.
  const chosen = app.people.at(-1);
  const { people, prefs, deletePerson, updatePrefs } = app;
  useEffect(() => {
    if (prefs.onboardingDone || !chosen) return;
    for (const p of people) if (p.id !== chosen.id) void deletePerson(p.id).catch(() => {});
    if (prefs.defaultRecipient !== chosen.id)
      void updatePrefs({ defaultRecipient: chosen.id }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id, people.length]);
  // Already set up (an upgrade, or opened from a stale link): straight to Home.
  if (app.prefs.onboardingDone) return <Redirect href="/" />;
  async function next() {
    try {
      setError('');
      if (step === 2) {
        if (!message.trim()) throw new Error('Write a default message first.');
        await app.updatePrefs({ defaultMessage: message.trim() });
      }
      if (step === STEPS - 1) await finish();
      else setStep((s) => s + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  // Onboarding is the first thing a new install shows; finishing or skipping lands on Home.
  async function finish() {
    await app.updatePrefs({ onboardingDone: true });
    router.replace('/');
  }
  return (
    <Screen
      // Back and Continue stay at the bottom while the step scrolls above them.
      footer={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {step > 0 && (
            <Button
              label="Back"
              variant="secondary"
              onPress={() => setStep((s) => s - 1)}
              style={{ flex: 1 }}
            />
          )}
          <Button
            label={step === 1 && !app.people.length ? 'Skip for now' : 'Continue'}
            onPress={next}
            style={{ flex: 3 }}
          />
        </View>
      }
    >
      {/* Step count, progress centred at the top, and Skip. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: 8 }}>
        <Txt tone="green" weight="medium" style={{ flex: 1, fontSize: 12, letterSpacing: 0.4 }}>
          {step + 1} OF {STEPS}
        </Txt>
        <Progress step={step} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip setup"
          hitSlop={12}
          onPress={() => void finish().catch((e) => setError(errorMessage(e)))}
          style={{ flex: 1, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Txt tone="muted" weight="medium" style={{ fontSize: 14 }}>
            Skip
          </Txt>
        </Pressable>
      </View>
      {step === 0 && (
        <View style={{ alignItems: 'center' }}>
          <CheckInFlowArt width={Math.min(350, width - 32)} to="Andy" />
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <Txt weight="display" style={{ fontSize: 40, lineHeight: 48, textAlign: 'center' }}>
              Check in fast.
            </Txt>
            {/* A hand-drawn line under "fast". */}
            <View style={{ marginTop: -6, marginLeft: 120 }}>
              <Scribble width={96} />
            </View>
          </View>
          <Txt
            tone="muted"
            style={{
              textAlign: 'center',
              fontSize: 16,
              lineHeight: 24,
              marginTop: 14,
              marginBottom: 26,
            }}
          >
            Arrive helps you quickly let your person know where you made it, without manually
            typing.
          </Txt>
        </View>
      )}
      {step === 1 && (
        <>
          <View style={{ alignItems: 'center' }}>
            <PeopleArt width={Math.min(250, width - 64)} />
            <Txt
              weight="display"
              style={{
                fontSize: 30,
                lineHeight: 37,
                textAlign: 'center',
                marginTop: 14,
                marginBottom: 24,
              }}
            >
              Who do you want to keep in the loop?
            </Txt>
            {/* <Txt
              tone="muted"
              style={{
                textAlign: 'center',
                fontSize: 15,
                lineHeight: 22,
                marginTop: 8,
                marginBottom: 22,
              }}
            >
              Choose one person for your check-ins. They don’t need Arrive to get your texts.
            </Txt> */}
          </View>
          {chosen ? (
            <ChosenPerson
              person={chosen}
              onRemove={() =>
                void app.deletePerson(chosen.id).catch((e) => setError(errorMessage(e)))
              }
            />
          ) : (
            <View style={{ gap: 12 }}>
              <Option
                icon={UserRound}
                title="Choose Contact"
                recommended
                busy={contact.busy}
                onPress={contact.start}
              />
              <Option
                icon={ScanLine}
                tint="peach"
                title="Connect with Arrive"
                subtitle="Use QR for Smart Reminders"
                onPress={() => router.push('/scan')}
              />
              <Option
                icon={Keyboard}
                title="Enter Manually"
                subtitle="Type a phone number"
                onPress={() => router.push('/person')}
              />
            </View>
          )}
          <Notice text={contact.error} error />
          {contact.sheet}
        </>
      )}
      {step === 2 && (
        <>
          <View style={{ alignItems: 'center' }}>
            <MessageArt width={Math.min(330, width - 32)} to="Kelly" />
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Txt weight="display" style={{ fontSize: 36, lineHeight: 44, textAlign: 'center' }}>
                Make it your own.
              </Txt>
              {/* A hand-drawn line under "your". */}
              <View style={{ marginTop: -6, marginLeft: 50 }}>
                <Scribble width={80} />
              </View>
            </View>
            <Txt
              tone="muted"
              style={{
                textAlign: 'center',
                fontSize: 16,
                lineHeight: 24,
                marginTop: 12,
                marginBottom: 22,
              }}
            >
              Set a default check-in message, ready whenever you check in.
            </Txt>
          </View>
          <Field
            label="Default check-in message"
            multiline
            value={message}
            onChangeText={setMessage}
            maxLength={MESSAGE_MAX}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
          <Txt
            tone="muted"
            style={{ alignSelf: 'flex-end', fontSize: 12, marginTop: -14, marginBottom: 4 }}
          >
            {message.length} / {MESSAGE_MAX}
          </Txt>
        </>
      )}
      {step === 3 && (
        <>
          <View style={{ alignItems: 'center' }}>
            <CheckInArt width={Math.min(330, width - 32)} tap={false} bell />
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <View>
                <Txt weight="display" style={{ fontSize: 32, lineHeight: 40, textAlign: 'center' }}>
                  Get a quick reminder
                </Txt>
                {/* A hand-drawn line under "reminder", drawn over the gap between lines. */}
                <View style={{ position: 'absolute', right: 4, bottom: -2 }}>
                  <Scribble width={118} />
                </View>
              </View>
              <Txt weight="display" style={{ fontSize: 32, lineHeight: 40, textAlign: 'center' }}>
                when it’s time.
              </Txt>
            </View>
            <Txt
              tone="muted"
              style={{
                textAlign: 'center',
                fontSize: 16,
                lineHeight: 24,
                marginTop: 12,
                marginBottom: 22,
              }}
            >
              Turn on notifications so Arrive can nudge you to check in at the right time (e.g.,
              when you leave a saved place).
            </Txt>
          </View>
          <NotificationsToggle onError={setError} />
        </>
      )}
      <Notice text={error} error />
    </Screen>
  );
}

/** Progress through onboarding: a short bar that fills step by step. */
function Progress({ step, count = STEPS }: { step: number; count?: number }) {
  const { colors } = useApp();
  const fill = useAnimatedStyle(() => ({
    width: withTiming(`${((step + 1) / count) * 100}%`, { duration: 250 }),
  }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: step + 1 }}
      style={{
        width: 120,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        backgroundColor: colors.softGreen,
      }}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: 3, backgroundColor: colors.green }, fill]}
      />
    </View>
  );
}

/** One way to add your person: icon, label, and a chevron. The recommended one is tinted. */
function Option({
  icon: Icon,
  title,
  subtitle,
  recommended = false,
  tint = 'mint',
  busy = false,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  recommended?: boolean;
  tint?: 'mint' | 'peach';
  busy?: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useApp();
  const accent = accents[tint];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recommended ? `${title}, recommended` : title}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 78,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: recommended ? 'transparent' : colors.border,
        backgroundColor: recommended ? colors.softGreen : colors.surface,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          // The recommended card is already green, so its circle is a shade deeper to stand out.
          backgroundColor: recommended
            ? isDark
              ? '#3A5A44'
              : '#D3E6CC'
            : isDark
              ? accent.dark
              : accent.bg,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.green} />
        ) : (
          <Icon
            size={21}
            color={tint === 'peach' ? accent.ink : colors.green}
            fill={recommended ? colors.green : 'none'}
            strokeWidth={2}
          />
        )}
      </View>
      <View
        style={{
          width: 1,
          alignSelf: 'stretch',
          backgroundColor: colors.border,
          marginVertical: 6,
        }}
      />
      <View style={{ flex: 1, gap: 5 }}>
        <Txt weight="rounded" style={{ fontSize: 17, lineHeight: 22 }}>
          {title}
        </Txt>
        {recommended ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 12,
              backgroundColor: isDark ? colors.subtle : '#DCEBD6',
            }}
          >
            <Sparkles size={11} color={colors.green} />
            <Txt tone="green" weight="medium" style={{ fontSize: 12, lineHeight: 16 }}>
              Recommended
            </Txt>
          </View>
        ) : (
          !!subtitle && (
            <Txt tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>
              {subtitle}
            </Txt>
          )
        )}
      </View>
      <ChevronRight size={20} color={colors.text} />
    </Pressable>
  );
}

/**
 * Notifications on or off. Turning it on asks iOS; turning it off just means "not now".
 * iOS only asks once, so if it was declined before, this explains how to turn it on instead.
 */
function NotificationsToggle({ onError }: { onError: (message: string) => void }) {
  const { colors } = useApp();
  const [on, setOn] = useState(false),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    void Notifications.getPermissionsAsync()
      .then((p) => setOn(p.granted))
      .catch(() => {});
  }, []);
  async function change(value: boolean) {
    onError('');
    setBlocked(false);
    setOn(value);
    if (!value) return;
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return;
      if (!current.canAskAgain) {
        setOn(false);
        setBlocked(true);
        return;
      }
      await enableNotifications();
    } catch (e) {
      setOn(false);
      onError(errorMessage(e));
    }
  }
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 20,
          backgroundColor: colors.softGreen,
        }}
      >
        <Bell size={21} color={colors.green} />
        <Txt weight="rounded" style={{ flex: 1, fontSize: 16 }}>
          Enable notifications
        </Txt>
        <Toggle label="Enable notifications" value={on} onChange={(v) => void change(v)} />
      </View>
      {blocked && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings()}
          style={{ marginTop: 10, minHeight: 36, justifyContent: 'center' }}
        >
          <Txt tone="muted" style={{ fontSize: 13, textAlign: 'center' }}>
            Notifications are off for Arrive.{' '}
            <Txt tone="green" weight="medium" style={{ fontSize: 13 }}>
              Turn them on in Settings
            </Txt>
          </Txt>
        </Pressable>
      )}
    </>
  );
}

/** Step 2 once someone is chosen: who they are, and Remove to pick again. */
function ChosenPerson({ person, onRemove }: { person: Person; onRemove: () => void }) {
  const { colors } = useApp();
  const phone = parsePhoneNumberFromString(person.phone)?.formatInternational() ?? person.phone;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Avatar person={person} size={52} />
      <View style={{ flex: 1 }}>
        <Txt weight="rounded" numberOfLines={1} style={{ fontSize: 18, lineHeight: 24 }}>
          {person.name}
        </Txt>
        <Txt tone="muted" numberOfLines={1} style={{ fontSize: 14, lineHeight: 20 }}>
          {phone}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${person.name}`}
        hitSlop={10}
        onPress={onRemove}
        style={({ pressed }) => ({
          minHeight: 44,
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Txt tone="green" weight="medium" style={{ fontSize: 14 }}>
          Remove
        </Txt>
      </Pressable>
    </View>
  );
}
