import { ActivityBannerPreview } from '@/components/activity-banner-preview';
import { AttentionBorder } from '@/components/attention-border';
import { LocationWarning, useAlwaysLocationOff } from '@/components/location-warning';
import { ShareBanner } from '@/components/share-banner';
import { Avatar, IconButton, PresetGrid, Screen, Section, styles, Txt } from '@/components/ui';
import { comingPreset, leavingPreset, useSendCheckIn } from '@/components/use-send-check-in';
import { Wordmark } from '@/components/wordmark';
import { useAccess } from '@/lib/access';
import { activityPresets, activityShortcuts } from '@/lib/domain';
import { hideSplash } from '@/lib/launch-splash';
import { onSendRequest, telUrl } from '@/lib/send-request';
import { useApp } from '@/state/app';
import * as Haptics from 'expo-haptics';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { ChevronRight, MapPin, Plus, Settings2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
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
  const { colors, isDark, prefs, presets, people } = app;
  const [bannerDragging, setBannerDragging] = useState(false);
  const insets = useSafeAreaInsets();
  const access = useAccess();
  const bannerPresets = activityShortcuts(presets, prefs.activityPresetOrder);
  const checkIn = useSendCheckIn();
  const [shareError, setShareError] = useState('');
  const location = useAlwaysLocationOff();
  const locationOff = location.off;
  const edit = (id: string) => router.push({ pathname: '/preset', params: { id } });
  // Sends asked for from outside Home: the Lock Screen reminder, the widget, a notification.
  const { send } = checkIn;
  useEffect(
    () =>
      onSendRequest((r) => {
        if (r.call) {
          // The banner's call button: iOS asks "Call …?" itself, so nothing is dialled silently.
          const person =
            people.find((c) => c.id === r.recipientId) ??
            people.find((c) => c.id === prefs.defaultRecipient);
          const url = person && telUrl(person.phone);
          if (!url) return hideSplash();
          return whenOnScreen(() => {
            void Linking.openURL(url)
              .catch(() => {})
              .finally(hideSplash);
          });
        }
        const id = r.presetId || (r.useDefault ? prefs.defaultPreset : '');
        // Leaving and Homebound aren't check-ins on Home: they're the leaving and heading-home
        // messages. Leaving names where you checked in, so it's looked up first.
        void (async () => {
          const preset = r.leaving
            ? await leavingPreset(prefs.leavingMessage)
            : r.coming
              ? comingPreset(prefs.comingMessage)
              : presets.find((p) => p.id === id);
          if (!preset) return hideSplash();
          whenOnScreen(() => {
            const sending = send(preset, {
              recipientId: r.recipientId,
              fromReminder: r.fromReminder,
              coming: r.coming,
              leaving: r.leaving,
            });
            // Messages takes a moment to slide up; the launch screen hides behind it.
            setTimeout(hideSplash, 700);
            void sending.finally(hideSplash);
          });
        })();
      }),
    [
      presets,
      people,
      prefs.defaultPreset,
      prefs.defaultRecipient,
      prefs.comingMessage,
      prefs.leavingMessage,
      send,
    ],
  );
  // Arrive keeps one person.
  const defaultPerson = people[0];
  // Appearance slides down from the top, leaving the Lock Screen banner preview (at the bottom
  // of Home) in view, so changes show as they're made; the sheet draws an undimmed copy of the
  // preview right over it. If the preview is scrolled out of view, Home first brings it up to
  // the bottom of the screen, then glides back once the sheet has closed.
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollY = useRef(0);
  // How far Home can scroll at most: the preview is the last thing on it, so it may not be able
  // to come all the way up.
  const maxScrollY = useRef(0);
  const preview = useRef<ViewInstance>(null);
  const restoreY = useRef<number | null>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // Glides back to where Home was before Appearance opened.
  const restore = useCallback(() => {
    const y = restoreY.current;
    if (y === null) return;
    restoreY.current = null;
    scroll.current?.scrollTo({ y, animated: true });
  }, []);
  const openAppearance = () => {
    const open = (params: Record<string, string> = {}) =>
      router.push({
        pathname: '/settings/[section]',
        params: { section: 'appearance', from: 'top', ...params },
      });
    const node = preview.current;
    if (!node) return open({ room: String(Math.round(windowHeight * 0.6)) });
    node.measureInWindow((x, top, width, height) => {
      // How far the preview's bottom sits below the visible screen, if at all, and how far
      // Home can actually scroll to bring it up.
      const below = Math.min(
        top + height - (windowHeight - insets.bottom - 12),
        maxScrollY.current - scrollY.current,
      );
      const y = top - Math.max(0, below);
      const params = {
        // The sheet may grow down to just above the preview.
        room: String(Math.round(Math.max(280, y - 12))),
        px: String(x),
        py: String(y),
        pw: String(width),
        // Where the preview is now; the sheet's copy glides from here to py with Home's scroll.
        p0: String(top),
      };
      if (below > 0) {
        restoreY.current = scrollY.current;
        scroll.current?.scrollTo({ y: scrollY.current + below, animated: true });
      }
      // Opens straight away: the sheet's copy of the preview is placed where the preview is
      // headed, and fades in with the backdrop while Home scrolls it into place underneath.
      open(params);
    });
  };
  // If the sheet closed some other way, catch up once Home is back in front.
  useFocusEffect(restore);
  const headerButton = { backgroundColor: colors.subtle, width: 42, height: 42 };
  // New to Arrive: the welcome steps come first. (Upgrades are marked as set up already.)
  if (!prefs.onboardingDone) return <Redirect href="/welcome" />;
  // Arrive Plus is needed past onboarding; the layout sends everyone else to the paywall.
  if (access === 'none') return <Redirect href="/paywall" />;
  return (
    <Screen
      message={{
        text: checkIn.error || shareError || checkIn.note,
        error: !!(checkIn.error || shareError),
        onHide: () => {
          setShareError('');
          checkIn.clearError();
          checkIn.clearNote();
        },
      }}
      scrollRef={scroll}
      onScrollY={(y) => (scrollY.current = y)}
      onScrollRoom={(maxY) => (maxScrollY.current = maxY)}
      scrollEnabled={!bannerDragging}
    >
      <View style={[styles.between, { marginBottom: 22 }]}>
        <Wordmark height={36} onDark={isDark} />
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
      {/* Smart Check-In starts on its own; Home only speaks up when it can't. */}
      {locationOff && <LocationWarning refresh={location.refresh} />}
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
          {defaultPerson ? (
            <Avatar person={defaultPerson} size={32} />
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
            {defaultPerson ? defaultPerson.name : 'Add your person'}
          </Txt>
          <Txt
            tone={defaultPerson ? 'green' : 'muted'}
            numberOfLines={1}
            style={{ fontSize: 12, lineHeight: 17 }}
          >
            {defaultPerson ? 'Gets your check-ins' : 'Someone you’d like to keep in the loop'}
          </Txt>
        </View>
        <ChevronRight size={17} color={colors.muted} />
        {!people.length && <AttentionBorder />}
      </Pressable>
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
        paged
        bleed={25}
        onAdd={() => router.push('/preset')}
        presets={presets}
        actionLabel="Send"
        disabled={checkIn.busy}
        onSelect={(p) => void checkIn.send(p)}
        onLongPress={(p) => {
          void Haptics.selectionAsync().catch(() => {});
          edit(p.id);
        }}
      />
      {/* The Lock Screen banner sits at the bottom of Home. */}
      <View style={{ flex: 1, minHeight: 8 }} />
      {/* When there's no location warning up top, the space goes to inviting someone. */}
      {/* 95% of the screen's width: a little wider than the page's 25-point side padding. */}
      {!locationOff && (
        <ShareBanner
          onError={setShareError}
          style={{ marginBottom: 16, marginHorizontal: Math.min(0, windowWidth * 0.025 - 25) }}
        />
      )}
      <View ref={preview} collapsable={false}>
        <ActivityBannerPreview
          presets={bannerPresets}
          design={prefs.lockScreenStyle}
          showLabels={prefs.activityButtonLabels}
          showCall={prefs.activityCallButton && !!defaultPerson && !!telUrl(defaultPerson.phone)}
          onDragChange={setBannerDragging}
          onAppearance={openAppearance}
          onReorder={(shownIds) => {
            const shown = new Set(shownIds);
            const remainder = activityPresets(presets, prefs.activityPresetOrder)
              .filter((preset) => !shown.has(preset.id))
              .map((preset) => preset.id);
            void app.updatePrefs({ activityPresetOrder: [...shownIds, ...remainder] });
          }}
        />
      </View>
    </Screen>
  );
}
