import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, HelpCircle, Mail, Settings2, Shield, Trash2 } from 'lucide-react-native';
import {
  Button,
  Chip,
  ConfirmDialog,
  Field,
  Notice,
  Row,
  Screen,
  Section,
  Toast,
  Toggle,
  Txt,
  goBack,
} from '@/components/ui';
import { ActivityBannerPreview } from '@/components/activity-banner-preview';
import { LockScreenStylePicker } from '@/components/lock-screen-style';
import { useApp } from '@/state/app';
import { activityShortcuts, errorMessage } from '@/lib/domain';
import { telUrl } from '@/lib/send-request';
import { separationTriggerOn } from '@/lib/smart-checkin';
import { initialPreferences } from '@/lib/types';
import { enableNotifications, cancelReminders } from '@/lib/notifications';
import { testDepartureReminder } from '@/lib/location';
import {
  cancelPendingReminder,
  completeReminder,
  dismissReminder,
  reconcileReminder,
  simulateDeparture,
  startReminder,
  updateTestActivity,
} from '@/lib/reminder-runtime';
import {
  disableSmartReminders,
  disconnectSmartReminders,
  enableSmartReminders,
  getSmartStatus,
  smartRuntimeError,
  simulateSmartScenario,
  updateSmartSettings,
  type SmartStatus,
} from '@/lib/smart-reminders';
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
 * The words behind "Coming", offered on the Lock Screen after you leave where you last checked
 * in. Saved when you finish typing; an empty field puts the default back.
 */
function ComingMessage({ value, onSave }: { value: string; onSave: (message: string) => void }) {
  const [text, setText] = useState(value);
  const save = () => {
    const next = text.trim() || initialPreferences.comingMessage;
    setText(next);
    if (next !== value) onSave(next);
  };
  return (
    <View style={{ marginTop: 6 }}>
      <Field
        label="“Coming” message"
        value={text}
        maxLength={500}
        onChangeText={setText}
        onEndEditing={save}
        onBlur={save}
        returnKeyType="done"
      />
      <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17, marginTop: -12 }}>
        Offered first on your Lock Screen after you leave somewhere you checked in. It&apos;s not
        your Home check-in, which says you&apos;ve arrived.
      </Txt>
    </View>
  );
}
function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
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
  const { section, from, room, px, py, pw } = useLocalSearchParams<{
    section: SettingsSection;
    from?: 'top';
    room?: string;
    px?: string;
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
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [section, prefs.smartReminders]);
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
  // The banner's call button phones your default person, so it needs one with a number.
  const callee = app.people.find((c) => c.id === prefs.defaultRecipient);
  const canCall = !!callee && !!telUrl(callee.phone);
  const callUnavailable = !callee
    ? 'Choose a default person to use the call button.'
    : !canCall
      ? `Add a phone number for ${callee.name} to use the call button.`
      : '';
  const [toast, setToast] = useState('');
  const hideToast = useCallback(() => setToast(''), []);
  const insets = useSafeAreaInsets();
  // A copy of Home's banner preview, drawn exactly over it and above the dimmed backdrop, so
  // changes show at full brightness as they're made.
  const bannerCopy =
    section === 'appearance' && py && px && pw ? (
      <View style={{ position: 'absolute', left: Number(px), top: Number(py), width: Number(pw) }}>
        <ActivityBannerPreview
          presets={activityShortcuts(app.presets, prefs.activityPresetOrder)}
          design={prefs.lockScreenStyle}
          showLabels={prefs.activityButtonLabels}
          showCall={prefs.activityCallButton && canCall}
          width={Number(pw)}
          onReorder={() => {}}
          onAppearance={() => {}}
          onDragChange={() => {}}
        />
      </View>
    ) : undefined;
  return (
    <Screen
      modal
      overlaySheet={Platform.OS !== 'web'}
      sheetFrom={from === 'top' ? 'top' : 'bottom'}
      sheetMaxHeight={room ? Number(room) : undefined}
      aboveBackdrop={bannerCopy}
      overlay={
        <Toast
          text={toast}
          onHide={hideToast}
          tone="warning"
          dismissable
          top={(from === 'top' ? insets.top : 0) + 12}
        />
      }
      fitContent={Platform.OS !== 'web' && fitContent}
      title={title}
    >
      <Notice text={error} error />
      <Notice text={note} />
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
              <Txt weight="medium" style={{ fontSize: 13, marginTop: 6, marginBottom: 9 }}>
                Person
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {app.people.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    active={prefs.defaultRecipient === p.id}
                    onPress={() => run(() => app.updatePrefs({ defaultRecipient: p.id }))}
                  />
                ))}
                {!app.people.length && (
                  <Chip label="Add your person" onPress={() => router.push('/people')} />
                )}
              </View>
              <Txt weight="medium" style={{ fontSize: 13, marginTop: 18, marginBottom: 9 }}>
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
                subtitle={`${
                  remembered
                    ? `${remembered} remembered ${remembered === 1 ? 'place' : 'places'}, and`
                    : 'Remembered places, and'
                } wherever you last checked in. Only “left, start in ${prefs.reminderMinutes} min” is sent, never where.`}
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
                <ComingMessage
                  value={prefs.comingMessage}
                  onSave={(comingMessage) => run(() => app.updatePrefs({ comingMessage }))}
                />
              )}
            </>
          )}
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
                ['Start Live Activity', () => startReminder('test'), 'Lock your phone to see it.'],
                [
                  'Start with Coming',
                  () => startReminder('test', true),
                  'As if you left where you last checked in. Lock your phone to see it.',
                ],
                ['Update', () => updateTestActivity(), 'Updated the Live Activity.'],
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
                    await fn();
                    if (done) setNote(done);
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
            subtitle="Reminders and send confirmations"
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
            Your people, check-ins, places, preferences, and recent history are stored only on this
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
