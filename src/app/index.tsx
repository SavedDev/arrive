import { ActivityBannerPreview } from '@/components/activity-banner-preview';
import { AttentionBorder } from '@/components/attention-border';
import { BrandMark } from '@/components/brand-mark';
import { Landscape } from '@/components/illustrations';
import { LocationWarning } from '@/components/location-warning';
import {
  Avatar,
  IconButton,
  Notice,
  PresetGrid,
  Screen,
  Section,
  Txt,
  Toast,
  styles,
} from '@/components/ui';
import { comingPreset, useSendCheckIn } from '@/components/use-send-check-in';
import { activityPresets, activityShortcuts } from '@/lib/domain';
import { hideSplash } from '@/lib/launch-splash';
import { onSendRequest } from '@/lib/send-request';
import { useWidgetConfigured } from '@/lib/use-widget-configured';
import { useApp } from '@/state/app';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowRight, MapPin, Plus, Settings2, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Runs fn as soon as Arrive is on screen: Messages can only be shown by an active app. A tap
 * on the Lock Screen launches Arrive before the phone is unlocked, so this can wait a while.
 */
function whenOnScreen(fn: () => void) {
  // One frame lets Home attach to the window before Messages is shown over it.
  const run = () => requestAnimationFrame(fn);
  if (AppState.currentState === 'active') return run();
  const sub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    sub.remove();
    run();
  });
}

export default function Home() {
  const app = useApp();
  const { colors, prefs, presets, people } = app;
  const [bannerDragging, setBannerDragging] = useState(false);
  const insets = useSafeAreaInsets();
  const widgetConfigured = useWidgetConfigured();
  const bannerPresets = activityShortcuts(presets, prefs.activityPresetOrder);
  const checkIn = useSendCheckIn();
  const edit = (id: string) => router.push({ pathname: '/preset', params: { id } });
  // Sends asked for from outside Home: the Lock Screen reminder, the widget, a notification.
  const { send } = checkIn;
  useEffect(
    () =>
      onSendRequest((r) => {
        const id = r.presetId || (r.useDefault ? prefs.defaultPreset : '');
        // "Coming" isn't one of the check-ins on Home: it's the heading-home message.
        const preset = r.coming
          ? comingPreset(prefs.comingMessage)
          : presets.find((p) => p.id === id);
        if (!preset) return hideSplash();
        whenOnScreen(() => {
          const sending = send(preset, {
            recipientId: r.recipientId,
            fromReminder: r.fromReminder,
            coming: r.coming,
          });
          // Messages takes a moment to slide up; the launch screen hides behind it.
          setTimeout(hideSplash, 700);
          void sending.finally(hideSplash);
        });
      }),
    [presets, prefs.defaultPreset, prefs.comingMessage, send],
  );
  const defaultPerson = people.find((c) => c.id === prefs.defaultRecipient);
  const headerButton = { backgroundColor: colors.subtle, width: 42, height: 42 };
  return (
    <Screen
      scrollEnabled={!bannerDragging}
      overlay={
        <Toast
          text={checkIn.error}
          onHide={checkIn.clearError}
          duration={6000}
          tone="warning"
          dismissable
          top={insets.top + 18}
          enterDuration={80}
        />
      }
    >
      <View style={[styles.between, { marginBottom: 22 }]}>
        <View style={styles.row}>
          <BrandMark size={34} />
          <Txt weight="display" style={{ fontSize: 25, letterSpacing: -1 }}>
            arrive
            <Txt tone="green" style={{ fontSize: 26 }}>
              .
            </Txt>
          </Txt>
        </View>
        <View style={[styles.row, { gap: 12 }]}>
          {/* History lives in Settings. Locations gets an orange accent so it stands out. */}
          <IconButton
            icon={MapPin}
            label="Open locations"
            color={colors.orange}
            onPress={() => router.push('/locations')}
            style={{ ...headerButton, backgroundColor: colors.softOrange }}
          />
          <IconButton
            icon={Settings2}
            label="Open settings"
            onPress={() => router.push('/settings')}
            style={headerButton}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/people')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 22,
          backgroundColor: colors.surface,
          borderWidth: people.length ? 1 : 0,
          borderColor: people.length ? colors.border : 'transparent',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: 'row' }}>
          {people.length ? (
            people.slice(0, 3).map((p, i) => (
              <View
                key={p.id}
                style={{
                  marginLeft: i ? -12 : 0,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: colors.surface,
                }}
              >
                <Avatar person={p} size={32} />
              </View>
            ))
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.softGreen,
              }}
            >
              <Plus size={21} color={colors.green} strokeWidth={1.9} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Txt
            weight="rounded"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={{ fontSize: 15, lineHeight: 21 }}
          >
            {people.length
              ? `Keeping ${people.length} ${people.length === 1 ? 'person' : 'people'} in the loop`
              : 'Add your person'}
          </Txt>
          <Txt tone="muted" numberOfLines={1} style={{ fontSize: 12, lineHeight: 17 }}>
            {defaultPerson
              ? `${defaultPerson.name} is your default person`
              : 'Someone you’d like to keep in the loop'}
          </Txt>
        </View>
        {!people.length && <AttentionBorder />}
      </Pressable>
      {/* Smart Check-In starts on its own; Home only speaks up when it can't. */}
      <LocationWarning />
      <Section
        title="My check-ins"
        hint="Hold to edit"
        right={
          <IconButton
            icon={Plus}
            label="Add a check-in"
            color={colors.green}
            onPress={() => router.push('/preset')}
            style={{ backgroundColor: colors.softGreen, width: 40, height: 40 }}
          />
        }
      />
      <PresetGrid
        compact
        presets={presets}
        actionLabel="Send"
        disabled={checkIn.busy}
        onSelect={(p) => void checkIn.send(p)}
        onLongPress={(p) => {
          void Haptics.selectionAsync().catch(() => {});
          edit(p.id);
        }}
      />
      <ActivityBannerPreview
        presets={bannerPresets}
        design={prefs.lockScreenStyle}
        showLabels={prefs.activityButtonLabels}
        onDragChange={setBannerDragging}
        onAppearance={() =>
          router.push({ pathname: '/settings/[section]', params: { section: 'appearance' } })
        }
        onReorder={(shownIds) => {
          const shown = new Set(shownIds);
          const remainder = activityPresets(presets, prefs.activityPresetOrder)
            .filter((preset) => !shown.has(preset.id))
            .map((preset) => preset.id);
          void app.updatePrefs({ activityPresetOrder: [...shownIds, ...remainder] });
        }}
      />
      <Notice text={checkIn.note} />
      {!widgetConfigured && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add the Check In widget to your Lock Screen"
          onPress={() => router.push('/widget')}
          style={({ pressed }) => ({
            backgroundColor: colors.softGreen,
            borderRadius: 27,
            padding: 23,
            minHeight: 170,
            marginTop: 24,
            overflow: 'hidden',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ position: 'absolute', right: -5, bottom: -2 }}>
            <Landscape width={150} height={145} />
          </View>
          <View style={{ maxWidth: '62%' }}>
            <Txt weight="rounded" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.5 }}>
              Check in right from your Lock Screen.
            </Txt>
            <Txt tone="muted" style={{ fontSize: 12, lineHeight: 18, marginTop: 8 }}>
              Add the Arrive widget. One tap and your words are ready.
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 6,
                marginTop: 14,
                backgroundColor: '#287B5A',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 14,
              }}
            >
              <Txt weight="bold" style={{ fontSize: 12, lineHeight: 17, color: '#FFFFFF' }}>
                Add the widget
              </Txt>
              <ArrowRight size={14} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      )}
      {!prefs.onboardingDone && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/welcome')}
          style={{
            flexDirection: 'row',
            gap: 7,
            alignSelf: 'center',
            alignItems: 'center',
            marginTop: 20,
            minHeight: 44,
          }}
        >
          <Sparkles size={14} color={colors.green} />
          <Txt tone="green" style={{ fontSize: 12 }}>
            New here? Make yourself at home
          </Txt>
        </Pressable>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 22,
        }}
      >
        <ShieldCheck size={12} color={colors.muted} />
        <Txt tone="muted" style={{ fontSize: 10 }}>
          A check-in, never a tracking app.
        </Txt>
      </View>
    </Screen>
  );
}
