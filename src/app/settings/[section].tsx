import { ActivityBannerPreview } from '@/components/activity-banner-preview';
import { LockScreenStylePicker } from '@/components/lock-screen-style';
import {
  Button,
  Chip,
  ConfirmDialog,
  Field,
  Notice,
  PlacesLink,
  Row,
  Screen,
  Section,
  Toggle,
  Txt,
  goBack,
} from '@/components/ui';
import { hasAccessCached } from '@/lib/access';
import { activityShortcuts, errorMessage } from '@/lib/domain';
import {
  requestMonitoring,
  simulatePlaceEvent,
  stopStillWatch,
  testDepartureReminder,
} from '@/lib/location';
import { cancelReminders, enableNotifications } from '@/lib/notifications';
import {
  afterCheckIn,
  cancelPendingReminder,
  completeReminder,
  dismissReminder,
  expireReminder,
  liveActivityProblem,
  reconcileReminder,
  simulateDeparture,
  startReminder,
  updateTestActivity,
} from '@/lib/reminder-runtime';
import { telUrl } from '@/lib/send-request';
import { separationTriggerOn } from '@/lib/smart-checkin';
import {
  disableSmartReminders,
  disconnectSmartReminders,
  enableSmartReminders,
  getSmartStatus,
  simulateSmartScenario,
  smartRuntimeError,
  updateSmartSettings,
  type SmartStatus,
} from '@/lib/smart-reminders';
import { initialPreferences } from '@/lib/types';
import { useApp } from '@/state/app';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, HelpCircle, Mail, Settings2, Shield, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
export type SettingsSection =
  'reminders' | 'permissions' | 'appearance' | 'privacy' | 'support' | 'developer';
const titles: Record<SettingsSection, string> = {
  reminders: 'Smart Check-In',
  permissions: 'Permissions',
  appearance: 'Appearance',
  privacy: 'Privacy & data',
  support: 'Help & support',
  developer: 'Developer tests',
};
// The week as shown, Monday first. Values are the phone's day numbers (0 = Sunday).
const WEEK = [
  { day: 1, label: 'M', name: 'Monday' },
  { day: 2, label: 'T', name: 'Tuesday' },
  { day: 3, label: 'W', name: 'Wednesday' },
  { day: 4, label: 'T', name: 'Thursday' },
  { day: 5, label: 'F', name: 'Friday' },
  { day: 6, label: 'S', name: 'Saturday' },
  { day: 0, label: 'S', name: 'Sunday' },
];
/**
 * The words behind a Lock Screen button (Leaving or Homebound). Saved when you finish typing; an
 * empty field puts the default back.
 */
function ButtonMessage(props: {
  label: string;
  value: string;
  fallback: string;
  note: string;
  onSave: (message: string) => void;
}) {
  const [text, setText] = useState(props.value);
  const save = () => {
    const next = text.trim() || props.fallback;
    setText(next);
    if (next !== props.value) props.onSave(next);
  };
  return (
    <View style={{ marginTop: 6, marginBottom: 10 }}>
      <Field
        label={props.label}
        value={text}
        maxLength={500}
        onChangeText={setText}
        onEndEditing={save}
        onBlur={save}
        returnKeyType="done"
      />
      <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17, marginTop: -12 }}>
        {props.note}
      </Txt>
    </View>
  );
}
function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void; }) {
  const { colors } = useApp();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {WEEK.map(({ day, label, name }) => {
        const on = days.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={name}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            onPress={() =>
              onChange(on ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b))
            }
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.green : colors.subtle,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Txt weight="bold" style={{ fontSize: 14, color: on ? '#FFFFFF' : colors.muted }}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
export default function SettingsSheet() {
  // Home opens Appearance from the top, leaving its Lock Screen banner preview in view below,
  // and says how much room there is above that preview and where the preview sits on screen.
  const { section, from, room, px, py, pw, p0 } = useLocalSearchParams<{
    section: SettingsSection;
    from?: 'top';
    room?: string;
    px?: string;
    p0?: string;
    py?: string;
    pw?: string;
  }>();
  const app = useApp(),
    { prefs } = app;
  const [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [confirmClear, setConfirmClear] = useState(false),
    [busy, setBusy] = useState(false);
  const [smartStatus, setSmartStatus] = useState<SmartStatus | null>(null);
  // Smart Reminders only apply to someone who also has Arrive and has been paired.
  const partner = app.people.find((p) => p.smartPaired);
  const separation = separationTriggerOn(prefs);
  const remembered = app.places.filter((p) => p.enabled).length;
  const fitContent = section !== 'developer' && (section !== 'reminders' || !prefs.smartCheckIn);
  const refreshSmart = async () => {
    if (!process.env.EXPO_PUBLIC_SMART_REMINDERS_URL) return;
    const [status, runtimeError] = await Promise.all([getSmartStatus(), smartRuntimeError()]);
    setSmartStatus(status);
    if (runtimeError) setError(runtimeError);
  };
  useEffect(() => {
    if (
      section !== 'reminders' ||
      !prefs.smartReminders ||
      !process.env.EXPO_PUBLIC_SMART_REMINDERS_URL
    )
      return;
    let active = true;
    void Promise.all([getSmartStatus(), smartRuntimeError()])
      .then(([status, runtimeError]) => {
        if (!active) return;
        setSmartStatus(status);
        if (runtimeError) setError(runtimeError);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [section, prefs.smartReminders]);
  // Developer test: says whether the Live Activity really started, and why not if it didn't.
  async function startTest(coming: boolean) {
    // Reminder work runs one task at a time; a stuck earlier one would otherwise look like nothing.
    const where = await Promise.race([
      startReminder('test', coming),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Still waiting after 15 seconds: an earlier reminder task hasn’t finished.',
              ),
            ),
          15_000,
        ),
      ),
    ]);
    if (where === 'lockScreen')
      return `Started${coming ? ' with Homebound' : ''}. Lock your phone to see it.${(await hasAccessCached())
          ? ''
          : ' Arrive Plus isn’t active, so it ends when Arrive reopens.'
        }`;
    throw new Error(
      `The Live Activity didn’t start: ${liveActivityProblem() || 'no reason given.'} A fallback notification is set for ${Math.max(1, prefs.reminderMinutes)} min.`,
    );
  }
  async function run(fn: () => Promise<unknown>) {
    setError('');
    setNote('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const title = titles[section] || 'Settings';
  // The banner's call button phones your person, so it needs one with a number.
  const callee = app.people[0];
  const canCall = !!callee && !!telUrl(callee.phone);
  const callUnavailable = !callee
    ? 'Add your person to use the call button.'
    : !canCall
      ? `Add a phone number for ${callee.name} to use the call button.`
      : '';
  const [toast, setToast] = useState('');
  // A copy of Home's banner preview, drawn exactly over it and above the dimmed backdrop, so
  // changes show at full brightness as they're made.
  const bannerCopy =
    section === 'appearance' && py && px && pw ? (
      <Glide
        from={p0 ? Number(p0) - Number(py) : 0}
        style={{ position: 'absolute', left: Number(px), top: Number(py), width: Number(pw) }}
      >
        <ActivityBannerPreview
          presets={activityShortcuts(app.presets, prefs.activityPresetOrder)}
          design={prefs.lockScreenStyle}
          showLabels={prefs.activityButtonLabels}
          showCall={prefs.activityCallButton && canCall}
          width={Number(pw)}
          onReorder={() => { }}
          onAppearance={() => { }}
          onDragChange={() => { }}
        />
      </Glide>
    ) : undefined;
  return (
    <Screen
      modal
      overlaySheet={Platform.OS !== 'web'}
      sheetFrom={from === 'top' ? 'top' : 'bottom'}
      sheetMaxHeight={room ? Number(room) : undefined}
      aboveBackdrop={bannerCopy}
      message={{
        text: error || toast || note,
        error: !!(error || toast),
        onHide: () => {
          setError('');
          setToast('');
          setNote('');
        },
      }}
      fitContent={Platform.OS !== 'web' && fitContent}
      title={title}
    >
      {section === 'reminders' && (
        <>
          <Row
            title="Smart Check-In"
            subtitle="A reminder on your Lock Screen to check in. Check-ins from Home always work."
            right={
              <Toggle
                label="Smart Check-In"
                value={prefs.smartCheckIn}
                onChange={(on) =>
                  run(async () => {
                    await app.updatePrefs({ smartCheckIn: on });
                    // Going separate ways is judged on the server, so it's told too.
                    if (prefs.smartReminders && partner)
                      await updateSmartSettings(on, prefs.reminderMinutes);
                    if (!on) await Promise.all([cancelReminders(), cancelPendingReminder()]);
                  })
                }
              />
            }
          />
          {prefs.smartCheckIn && (
            <>
              {/* Arrive keeps one person, so there's no one to choose here. */}
              <Txt weight="medium" style={{ fontSize: 13, marginTop: 6, marginBottom: 9 }}>
                Active days
              </Txt>
              <DayPicker
                days={prefs.activeDays}
                onChange={(activeDays) => run(() => app.updatePrefs({ activeDays }))}
              />
              <Txt weight="medium" style={{ fontSize: 13, marginTop: 18, marginBottom: 9 }}>
                Show after
              </Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([1, 5, 10] as const).map((n) => (
                  <Chip
                    key={n}
                    label={`${n} min`}
                    active={prefs.reminderMinutes === n}
                    onPress={() =>
                      run(async () => {
                        await app.updatePrefs({ reminderMinutes: n });
                        if (separation) await updateSmartSettings(true, n);
                      })
                    }
                  />
                ))}
              </View>
              <Section title="Triggers" />
              {Platform.OS === 'ios' && (
                <Row
                  title="Going separate ways"
                  subtitle={
                    partner
                      ? `When you and ${partner.name} clearly head different ways, anywhere.`
                      : 'For someone who also uses Arrive. Pair when you share your QR from People.'
                  }
                  right={
                    <Toggle
                      label="Going separate ways"
                      disabled={!partner && !prefs.smartReminders}
                      value={prefs.smartReminders}
                      onChange={(value) =>
                        run(async () => {
                          if (value) await enableSmartReminders(prefs.reminderMinutes);
                          else await disableSmartReminders(prefs.reminderMinutes);
                          await app.updatePrefs({ smartReminders: value });
                          if (value) await refreshSmart();
                          else setSmartStatus(null);
                        })
                      }
                    />
                  }
                />
              )}
              {separation && (
                <>
                  <Notice
                    text={
                      smartStatus?.pair
                        ? `Paired${partner ? ` with ${partner.name}` : ''} · current signal: ${smartStatus.pair.proximityState || 'unknown'}. Only each phone's latest location is kept, never a history.`
                        : 'Waiting for your person to scan your invitation. Nothing is uploaded until they do.'
                    }
                  />
                  {smartStatus?.pair && (
                    <Button
                      label="Disconnect"
                      variant="secondary"
                      onPress={() =>
                        run(async () => {
                          await disconnectSmartReminders();
                          // They stay in People as a normal recipient.
                          await app.setSmartPartner(null);
                          await app.updatePrefs({ smartReminders: false });
                          setSmartStatus(null);
                        })
                      }
                    />
                  )}
                </>
              )}
              <Row
                title="Leaving places"
                subtitle={
                  <>
                    Reminds you to check in {prefs.reminderMinutes} min after you leave{' '}
                    {remembered > 1 ? `one of your ${remembered} ` : remembered ? 'your ' : 'a '}
                    <PlacesLink>{remembered > 1 ? 'saved places' : 'saved place'}</PlacesLink> or
                    the spot where you last checked in.
                  </>
                }
                right={
                  <Toggle
                    label="Leaving places"
                    value={prefs.departureReminders}
                    onChange={(v) =>
                      run(async () => {
                        await app.updatePrefs({ departureReminders: v });
                        if (!v) await Promise.all([cancelReminders(), cancelPendingReminder()]);
                      })
                    }
                  />
                }
              />
              {prefs.departureReminders && (
                <>
                  <ButtonMessage
                    label="“Leaving” message"
                    value={prefs.leavingMessage}
                    fallback={initialPreferences.leavingMessage}
                    note="Sent from your Lock Screen when you leave somewhere you checked in. [location] becomes that place, like “Leaving Work now”."
                    onSave={(leavingMessage) => run(() => app.updatePrefs({ leavingMessage }))}
                  />
                  <ButtonMessage
                    label="“Homebound” message"
                    value={prefs.comingMessage}
                    fallback={initialPreferences.comingMessage}
                    note="Sent from your Lock Screen when you're heading home. It shows only when you've saved Home and aren't there. Your Home check-in is for when you get there."
                    onSave={(comingMessage) => run(() => app.updatePrefs({ comingMessage }))}
                  />
                  {/* After "Coming": arriving at a saved place always asks "Made it?". This
                      also asks once you've stopped moving anywhere else. */}
                  <Row
                    title="Ask “Made it?” when I stop"
                    subtitle={
                      <>
                        After you send Leaving or Homebound, Arrive asks once you&apos;ve stayed in
                        one spot for {prefs.madeItStillMinutes} min. Arriving at one of your{' '}
                        <PlacesLink>saved places</PlacesLink> always asks right away.
                      </>
                    }
                    right={
                      <Toggle
                        label="Ask Made it when I stop"
                        value={prefs.madeItWhenStill}
                        onChange={(v) =>
                          run(async () => {
                            // Needs Always location and notifications; asks for them if needed.
                            if (v) await requestMonitoring();
                            else await stopStillWatch();
                            await app.updatePrefs({ madeItWhenStill: v });
                          })
                        }
                      />
                    }
                  />
                  {prefs.madeItWhenStill && (
                    <>
                      <Txt weight="medium" style={{ fontSize: 13, marginTop: 4, marginBottom: 9 }}>
                        Ask after staying put for
                      </Txt>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {([5, 10, 15] as const).map((n) => (
                          <Chip
                            key={n}
                            label={`${n} min`}
                            active={prefs.madeItStillMinutes === n}
                            onPress={() => run(() => app.updatePrefs({ madeItStillMinutes: n }))}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}
          <Txt
            tone="muted"
            style={{ textAlign: 'center', fontSize: 11, lineHeight: 18, marginTop: 22 }}
          >
            Your location is never shared.
            {prefs.smartReminders &&
              ' Smart Reminders sends only your latest location to Arrive’s service, to tell when you and your person go separate ways. They never see it.'}
          </Txt>
        </>
      )}
      {section === 'developer' && __DEV__ && (
        <>
          <Txt weight="medium" style={{ fontSize: 13, marginTop: 14, marginBottom: 9 }}>
            Developer tests
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(
              [
                ['Start Live Activity', () => startTest(false), ''],
                ['Start with Homebound', () => startTest(true), ''],
                ['Update', () => updateTestActivity(), 'Updated the Live Activity.'],
                [
                  'Checked in (simulated)',
                  async () => {
                    const preset = app.presets.find((x) => x.id === 'work') ?? app.presets[0];
                    await afterCheckIn({ kind: 'arrival', presetId: preset.id, name: preset.name });
                    return `As if you sent your ${preset.name} check-in. Lock your phone to see Leaving and Homebound.`;
                  },
                  '',
                ],
                [
                  'Leaving (simulated)',
                  async () => {
                    await afterCheckIn({ kind: 'leaving' });
                    return 'As if you sent Leaving. Lock your phone to see your check-ins.';
                  },
                  '',
                ],
                [
                  'Arrive at a place',
                  async () => {
                    const name = await simulatePlaceEvent('enter');
                    return `Arrived at ${name}. A traveling banner puts it first now; the notification shows in 10 seconds.`;
                  },
                  '',
                ],
                [
                  'Leave a place',
                  async () => {
                    const name = await simulatePlaceEvent('exit');
                    return `Left ${name}. Smart Check-In shows in ${prefs.reminderMinutes} min, unless a banner is already up.`;
                  },
                  '',
                ],
                ['Expire now', () => expireReminder(), 'Expired, as if its time had run out.'],
                ['Complete', () => completeReminder(), 'Completed. It ends in a few seconds.'],
                ['Dismiss', () => dismissReminder(), 'Dismissed.'],
                [
                  'Simulate departure',
                  () => simulateDeparture(10),
                  'In 10 seconds a reminder is due. Open Arrive to see it start.',
                ],
                [
                  'Fallback notification',
                  () => testDepartureReminder(prefs.defaultRecipient),
                  'Lock your phone now. The fallback notification appears in 10 seconds.',
                ],
                ['Open from Live Activity', async () => router.push('/check-in?from=reminder'), ''],
                ['Paywall with trial', async () => router.push('/paywall?preview=trial'), ''],
              ] as const
            ).map(([label, fn, done]) => (
              <Chip
                key={label}
                label={label}
                onPress={() =>
                  run(async () => {
                    setNote('Working…');
                    const said = await fn();
                    setNote(typeof said === 'string' ? said : done);
                  })
                }
              />
            ))}
          </View>
          {prefs.smartReminders && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {(
                [
                  ['Smart: together', 'together'],
                  ['Smart: one moves', 'oneMovingAway'],
                  ['Smart: leave together', 'bothLeavingTogether'],
                  ['Smart: later diverge', 'laterDiverging'],
                  ['Smart: stale fix', 'stale'],
                  ['Smart: poor accuracy', 'poorAccuracy'],
                  ['Smart: reunion', 'reunion'],
                  ['Smart: separation confirmed', 'separationConfirmed'],
                  ['Smart: reminder due', 'reminderDue'],
                  ['Smart: push-to-start', 'pushToStart'],
                ] as const
              ).map(([label, scenario]) => (
                <Chip
                  key={scenario}
                  label={label}
                  onPress={() =>
                    run(async () => {
                      const result = await simulateSmartScenario(scenario);
                      setNote(
                        `${label} → ${result.state}${result.scheduled ? ' · reminder queued' : ''}`,
                      );
                      await refreshSmart();
                    })
                  }
                />
              ))}
            </View>
          )}
        </>
      )}
      {section === 'permissions' && (
        <>
          <Row
            title="Enable local notifications"
            subtitle="Reminders when you leave a place or make it home"
            icon={Bell}
            onPress={() =>
              run(async () => {
                await enableNotifications();
                setNote('Local notifications are enabled.');
              })
            }
          />
          <Row
            title="Open phone settings"
            subtitle="Location, notifications, and contacts access"
            icon={Settings2}
            onPress={() => run(() => Linking.openSettings())}
          />
        </>
      )}
      {section === 'appearance' && (
        <>
          <Txt weight="medium" style={{ fontSize: 13, marginBottom: 9 }}>
            Lock Screen design
          </Txt>
          <LockScreenStylePicker
            value={prefs.lockScreenStyle}
            onChange={(style) =>
              run(async () => {
                await app.updatePrefs({ lockScreenStyle: style });
                // Restyles a Smart Check-In that's already showing.
                await reconcileReminder();
              })
            }
          />
          <Row
            title="Button labels"
            subtitle="Show check-in names underneath the banner icons"
            right={
              <Toggle
                label="Button labels"
                value={prefs.activityButtonLabels}
                onChange={(activityButtonLabels) =>
                  run(async () => {
                    await app.updatePrefs({ activityButtonLabels });
                    await reconcileReminder();
                  })
                }
              />
            }
          />
          <Row
            title="Call button"
            subtitle="Add a button to call your person from the banner"
            right={
              // Off and greyed out until there's a number to call. A disabled switch swallows
              // taps on iOS, so a cover over it hears the tap and says what's missing.
              <View>
                <Toggle
                  label="Call button"
                  disabled={!!callUnavailable}
                  value={prefs.activityCallButton && !callUnavailable}
                  onChange={(activityCallButton) =>
                    run(async () => {
                      await app.updatePrefs({ activityCallButton });
                      await reconcileReminder();
                    })
                  }
                />
                {!!callUnavailable && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Call button unavailable. ${callUnavailable}`}
                    onPress={() => setToast(callUnavailable)}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                  />
                )}
              </View>
            }
          />
        </>
      )}
      {section === 'privacy' && (
        <>
          <Txt tone="muted" style={{ fontSize: 13, lineHeight: 20 }}>
            Your person, check-ins, places, preferences, and recent history are stored only on this
            device. There is no Arrive account or cloud recovery. Smart Check-In sends the
            Cloudflare service only anonymous requests to start it after you leave a remembered
            place (never where), and, if you pair with someone, each paired phone&apos;s latest
            location. Deleting the app or losing this device can lose local data.
          </Txt>
          <Row
            title="Privacy & permissions"
            icon={Shield}
            onPress={() => router.push('/privacy')}
          />
          <Row title="Clear app data" icon={Trash2} danger onPress={() => setConfirmClear(true)} />
          <ConfirmDialog
            visible={confirmClear}
            title="Clear all app data?"
            message="This permanently clears all saved people, places, check-ins, preferences, and history on this device. It does not cancel an App Store or Play subscription."
            confirmLabel="Yes, clear everything"
            cancelLabel="Keep my data"
            busy={busy}
            onCancel={() => setConfirmClear(false)}
            onConfirm={() => {
              setBusy(true);
              void run(async () => {
                await app.clearAppData();
                setConfirmClear(false);
                // Starting over: close Settings and go through onboarding like a new install.
                if (router.canDismiss()) router.dismissAll();
                router.replace('/welcome');
              }).finally(() => setBusy(false));
            }}
          />
        </>
      )}
      {section === 'support' && (
        <>
          <Row title="Help & FAQ" icon={HelpCircle} onPress={() => router.push('/help')} />
          <Row
            title="Contact support"
            icon={Mail}
            subtitle={
              process.env.EXPO_PUBLIC_SUPPORT_EMAIL
                ? undefined
                : 'Support address not configured in this build'
            }
            onPress={
              process.env.EXPO_PUBLIC_SUPPORT_EMAIL
                ? () =>
                  run(() => Linking.openURL(`mailto:${process.env.EXPO_PUBLIC_SUPPORT_EMAIL}`))
                : undefined
            }
          />
        </>
      )}
      {!titles[section] && <Button label="Back to settings" variant="ghost" onPress={goBack} />}
    </Screen>
  );
}

/**
 * Moves its content from `from` points away to where it's placed, in step with Home scrolling
 * the banner preview into view, so the copy and the real preview move as one.
 */
function Glide({
  from,
  style,
  children,
}: {
  from: number;
  style: ViewStyle;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(from);
  useEffect(() => {
    // About as long as iOS takes to scroll a page by code.
    offset.set(withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) }));
  }, [offset]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return <Animated.View style={[style, moving]}>{children}</Animated.View>;
}
