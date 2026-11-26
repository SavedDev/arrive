import { presetIcons } from '@/design/icons';
import { accents, fonts } from '@/design/theme';
import { initials } from '@/lib/people';
import type { Person, Preset } from '@/lib/types';
import { useApp } from '@/state/app';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  ChevronRight,
  Heart,
  MapPin,
  Plus,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
  type TextInputInstance,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  SlideInUp,
  SlideOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { FullWindowOverlay } from 'react-native-screens';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareSheetTapped, useSharing } from '@/lib/share';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Txt({
  style,
  tone,
  weight,
  ...props
}: TextProps & { tone?: 'muted' | 'green'; weight?: 'medium' | 'bold' | 'rounded' | 'display' }) {
  const { colors } = useApp();
  return (
    <Text
      {...props}
      style={[
        {
          color: tone ? colors[tone] : colors.text,
          fontFamily: weight ? fonts[weight] : fonts.body,
          fontSize: 15,
          lineHeight: 23,
        },
        style,
      ]}
    />
  );
}
/**
 * Green, tappable words inside a sentence that open Locations, e.g. "saved places". A plain Text,
 * so it keeps the size of the sentence around it.
 */
/** Inside a Screen: closes it with its usual animation, then runs `then`. */
const CloseThen = React.createContext<((then: () => void) => void) | null>(null);
export function PlacesLink({ children }: { children: React.ReactNode }) {
  const { colors } = useApp();
  const closeThen = React.useContext(CloseThen);
  // Closes the sheet it's in first, so Locations opens in its place rather than on top.
  const open = () => router.push('/locations');
  return (
    <Text
      accessibilityRole="link"
      accessibilityHint="Opens Locations"
      onPress={() => (closeThen ? closeThen(open) : open())}
      style={{ color: colors.green, fontFamily: fonts.medium }}
    >
      {children}
    </Text>
  );
}
/** Space kept between the field being typed in and the top of the keyboard. */
const KEYBOARD_GAP = 70;
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  modal = false,
  fitContent = false,
  overlaySheet = false,
  sheetFrom = 'bottom',
  sheetMaxHeight,
  aboveBackdrop,
  action,
  scroll = true,
  scrollEnabled = true,
  onClose = goBack,
  overlay,
  scrollRef,
  onScrollY,
  onScrollRoom,
  footer,
  message,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  /** Slide-up sheet: a close button replaces the back arrow, and iOS draws no status bar. */
  modal?: boolean;
  /** Lets a native form sheet measure short content instead of filling its maximum height. */
  fitContent?: boolean;
  /** Full-width sheet used by settings routes. Tapping outside it closes it. */
  overlaySheet?: boolean;
  /** Which edge the overlay sheet is attached to and slides in from. */
  sheetFrom?: 'bottom' | 'top';
  /** The tallest the overlay sheet may be, in points; its content scrolls beyond that. */
  sheetMaxHeight?: number;
  /**
   * Drawn over the overlay sheet's dimmed backdrop but under the sheet, so it isn't dimmed (for
   * example, a preview of what the sheet changes). Taps on it still close the sheet.
   */
  aboveBackdrop?: React.ReactNode;
  action?: React.ReactNode;
  scroll?: boolean;
  scrollEnabled?: boolean;
  /** Runs when the sheet's close button is pressed. */
  onClose?: () => void;
  /** Floating content, like a toast, drawn above the scrolling page. */
  overlay?: React.ReactNode;
  /** Lets the screen scroll itself, for example to bring something into view. */
  scrollRef?: React.Ref<KeyboardAwareScrollViewRef>;
  /** Hears how far the page is scrolled. */
  onScrollY?: (y: number) => void;
  /** Hears how far the page can scroll at most (its content height minus what's in view). */
  onScrollRoom?: (maxY: number) => void;
  /** Pinned to the bottom of the screen, below the scrolling page (for example, Continue). */
  footer?: React.ReactNode;
  /**
   * Feedback after something happens, such as "Restored" or an error: always a banner that drops
   * in at the top for a few seconds, never text in the page, so nothing shifts. Errors stay
   * longer and are amber. `onHide` clears it.
   */
  message?: { text: string; error?: boolean; onHide: () => void };
}) {
  const { colors } = useApp();
  const windowHeight = useWindowDimensions().height;
  const insets = useSafeAreaInsets();
  const sheetProgress = useSharedValue(0);
  const backdropProgress = useSharedValue(0);
  const closingSheet = React.useRef(false);
  const scrollSize = React.useRef({ content: 0, view: 0 });
  // The footer rides on top of the keyboard, so a focused field has to clear it as well.
  // footerInset is the safe-area padding actually under it, which tucks behind the keyboard:
  // measured, since inside an iOS sheet it isn't always the screen's own bottom inset.
  const [footerHeight, setFooterHeight] = React.useState(0);
  const [footerInner, setFooterInner] = React.useState(0);
  const footerInset = Math.max(0, footerHeight - footerInner);
  // Room under the footer's button: clear of the Home indicator with space to spare when the
  // keyboard is down. When it's up, all but 12 points of it tucks behind the keyboard.
  const footerPad = Math.max(insets.bottom, footerInset) + 20 - footerInset;
  const footerTuck = footerInset + footerPad - 12;
  const keyboardGap = footer
    ? Math.max(KEYBOARD_GAP, footerHeight - footerTuck + 16)
    : KEYBOARD_GAP;
  React.useEffect(() => {
    if (!overlaySheet) return;
    closingSheet.current = false;
    sheetProgress.set(0);
    backdropProgress.set(0);
    const frame = requestAnimationFrame(() => {
      backdropProgress.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
      sheetProgress.set(withTiming(1, { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
    });
    return () => cancelAnimationFrame(frame);
  }, [backdropProgress, overlaySheet, sheetProgress]);
  // Something to do once this screen has closed, e.g. open another sheet in its place.
  const afterClose = React.useRef<(() => void) | null>(null);
  const closed = React.useCallback(() => {
    onClose();
    const then = afterClose.current;
    afterClose.current = null;
    // A native sheet takes a moment to slide away; iOS can't present another until it has.
    if (then) setTimeout(then, overlaySheet ? 60 : 450);
  }, [onClose, overlaySheet]);
  const closeSheet = React.useCallback(() => {
    if (!overlaySheet) {
      closed();
      return;
    }
    if (closingSheet.current) return;
    closingSheet.current = true;
    backdropProgress.set(withTiming(0, { duration: 210, easing: Easing.inOut(Easing.cubic) }));
    sheetProgress.set(
      withTiming(0, { duration: 300, easing: Easing.bezier(0.4, 0, 1, 1) }, (finished) => {
        if (finished) scheduleOnRN(closed);
      }),
    );
  }, [backdropProgress, closed, overlaySheet, sheetProgress]);
  const closeThen = React.useCallback(
    (then: () => void) => {
      afterClose.current = then;
      closeSheet();
    },
    [closeSheet],
  );
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.get(),
  }));
  const fromTop = overlaySheet && sheetFrom === 'top';
  // Elsewhere the banner sits just inside this screen: below the status bar, unless this is a
  // sheet that already starts below it. (On iOS it's always at the top of the whole screen.)
  const messageTop =
    (fromTop || (!overlaySheet && !(modal && Platform.OS === 'ios')) ? insets.top : 0) + 12;
  const banner = message && (
    <TopBanner
      text={message.text}
      tone={message.error ? 'warning' : 'success'}
      duration={message.error ? 6000 : 3000}
      top={Platform.OS === 'ios' ? insets.top + 12 : messageTop}
      onHide={message.onHide}
    />
  );
  // While the share sheet is open, a tap outside it should only close it. iOS also delivers that
  // tap to the page underneath, so an invisible cover takes it instead, then steps aside.
  const sharing = useSharing();
  const shield = sharing && (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      onResponderRelease={shareSheetTapped}
    />
  );
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetProgress.get()) * windowHeight * (fromTop ? -1 : 1) }],
  }));
  const sheet = modal;
  const content = (
    <View style={[styles.page, sheet && { paddingTop: 18 }, fitContent && { paddingBottom: 24 }]}>
      {sheet && Platform.OS === 'ios' && !fromTop && (
        <View
          style={{
            alignSelf: 'center',
            width: 38,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.border,
            marginBottom: 12,
          }}
        />
      )}
      {(title || back || sheet || action) && (
        <View style={{ marginBottom: sheet ? 20 : 28 }}>
          <View style={styles.between}>
            <View style={[styles.row, { flex: 1, gap: 6 }]}>
              {back && !sheet && (
                <IconButton
                  icon={ArrowLeft}
                  label="Go back"
                  onPress={goBack}
                  style={{ marginLeft: -10 }}
                />
              )}
              <Txt
                weight="display"
                style={{ fontSize: sheet ? 27 : 32, lineHeight: sheet ? 35 : 40, flex: 1 }}
              >
                {title}
              </Txt>
            </View>
            <View style={[styles.row, { gap: 4 }]}>
              {action}
              {sheet && (
                <IconButton
                  icon={X}
                  label="Close"
                  onPress={closeSheet}
                  style={{ backgroundColor: colors.subtle, width: 40, height: 40 }}
                />
              )}
            </View>
          </View>
          {subtitle && (
            <Txt tone="muted" style={{ marginTop: 7 }}>
              {subtitle}
            </Txt>
          )}
        </View>
      )}
      <CloseThen.Provider value={closeThen}>{children}</CloseThen.Provider>
    </View>
  );
  const body = fromTop ? (
    // Sized to its content, up to sheetMaxHeight; anything taller scrolls.
    <ScrollView
      style={{ flexGrow: 0 }}
      bounces={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  ) : scroll && !fitContent ? (
    // Keeps the focused field KEYBOARD_GAP above the keyboard on iOS and Android,
    // moving with the keyboard as it slides (Expo's recommended approach).
    <KeyboardAwareScrollView
      ref={scrollRef}
      onScroll={onScrollY ? (e) => onScrollY(e.nativeEvent.contentOffset.y) : undefined}
      onContentSizeChange={(_w, h) => {
        scrollSize.current.content = h;
        onScrollRoom?.(Math.max(0, h - scrollSize.current.view));
      }}
      onLayout={(e) => {
        scrollSize.current.view = e.nativeEvent.layout.height;
        onScrollRoom?.(Math.max(0, scrollSize.current.content - e.nativeEvent.layout.height));
      }}
      scrollEventThrottle={16}
      bottomOffset={keyboardGap}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      decelerationRate="fast"
      scrollEnabled={scrollEnabled}
    >
      {content}
    </KeyboardAwareScrollView>
  ) : (
    content
  );
  if (overlaySheet) {
    return (
      <View style={[styles.overlaySheetRoot, fromTop && { justifyContent: 'flex-start' }]}>
        {/* Tapping anywhere outside the sheet closes it. */}
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={closeSheet}
          style={[styles.overlaySheetBackdrop, backdropAnimatedStyle]}
        />
        {aboveBackdrop && (
          // Fades in with the backdrop, so it eases over whatever it covers.
          <Animated.View
            pointerEvents="none"
            style={[
              styles.overlaySheetBackdrop,
              { backgroundColor: 'transparent' },
              backdropAnimatedStyle,
            ]}
          >
            {aboveBackdrop}
          </Animated.View>
        )}
        <Animated.View
          style={[
            styles.overlaySheet,
            fromTop ? styles.overlaySheetTop : null,
            {
              height: fitContent || fromTop ? undefined : '92%',
              maxHeight: fromTop && sheetMaxHeight ? sheetMaxHeight : '92%',
              backgroundColor: colors.background,
            },
            sheetAnimatedStyle,
          ]}
        >
          {/* Padded by the screen's fixed safe-area insets. A SafeAreaView would measure where the
              sheet is mid-slide (still off screen) and sometimes leave the top inset out. */}
          <View
            style={{
              flex: fitContent || fromTop ? undefined : 1,
              flexShrink: fromTop ? 1 : undefined,
              paddingTop: fromTop ? insets.top : 0,
              paddingBottom: fromTop ? 0 : insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
              backgroundColor: colors.background,
            }}
          >
            {body}
            {fromTop && (
              <View
                style={{
                  alignSelf: 'center',
                  width: 38,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: colors.border,
                  marginTop: -14,
                  marginBottom: 10,
                }}
              />
            )}
            {overlay}
            {banner}
          </View>
        </Animated.View>
        {shield}
      </View>
    );
  }
  const topless = sheet && Platform.OS === 'ios';
  return (
    <SafeAreaView
      edges={topless ? ['left', 'right'] : ['top', 'left', 'right']}
      style={{
        width: '100%',
        flex: fitContent ? undefined : 1,
        backgroundColor: colors.background,
      }}
    >
      {body}
      {footer && (
        // Pinned to the bottom, and lifted with the keyboard so the button stays in view while
        // typing. The safe-area padding tucks behind the keyboard.
        <KeyboardStickyView offset={{ closed: 0, opened: footerTuck }}>
          <SafeAreaView
            edges={['bottom']}
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={{ backgroundColor: colors.background, borderTopWidth: 0 }}
          >
            <View
              onLayout={(e) => setFooterInner(e.nativeEvent.layout.height)}
              style={[styles.footer, { paddingBottom: footerPad }]}
            >
              {footer}
            </View>
          </SafeAreaView>
        </KeyboardStickyView>
      )}
      {shield}
      {overlay}
      {banner}
    </SafeAreaView>
  );
}
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useApp();
  const color =
    variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 54,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 18,
          backgroundColor:
            variant === 'primary'
              ? '#287B5A'
              : variant === 'secondary'
                ? colors.softGreen
                : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        Icon && <Icon size={19} color={color} strokeWidth={1.8} />
      )}
      <Txt weight="bold" style={{ color, fontSize: 15 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
  style,
  color,
  filled,
  selected,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  color?: string;
  /** Fills the icon shape, for on/off icons like a favorite star. */
  filled?: boolean;
  selected?: boolean;
}) {
  const { colors } = useApp();
  const tint = color || colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      aria-selected={selected}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Icon size={21} color={tint} fill={filled ? tint : 'none'} strokeWidth={1.7} />
    </Pressable>
  );
}
export function Avatar({
  person,
  size = 44,
}: {
  person?: Pick<Person, 'name' | 'photo'>;
  size?: number;
}) {
  const { colors } = useApp();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (person?.photo)
    return (
      <Image
        source={{ uri: person.photo }}
        style={circle}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  return (
    <View
      style={[
        circle,
        { backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Txt weight="bold" tone="green" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {person ? initials(person.name) : '+'}
      </Txt>
    </View>
  );
}
/** A small centered dialog for confirming destructive actions. */
/**
 * A sheet over the current screen, from the bottom, for a quick choice: it looks and moves exactly
 * like the overlay sheets (the backdrop fades in place while the sheet slides up), and a tap
 * outside it closes it. Its content stays while it slides away.
 */
export function SheetModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useApp();
  const insets = useSafeAreaInsets();
  const windowHeight = useWindowDimensions().height;
  const progress = useSharedValue(0);
  const backdrop = useSharedValue(0);
  // Stays mounted, showing what it last showed, until it has slid away.
  const [mounted, setMounted] = React.useState(visible);
  const [shown, setShown] = React.useState(children);
  if (visible && !mounted) setMounted(true);
  if (visible && shown !== children) setShown(children);
  // Slides in once iOS has actually shown it (onShow). Right after another sheet closes, such as
  // the contact picker, iOS holds it back until that one is gone, and an animation started any
  // earlier would be over before anyone saw it.
  const slideIn = () => {
    backdrop.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
    progress.set(withTiming(1, { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  };
  React.useEffect(() => {
    if (visible) {
      progress.set(0);
      backdrop.set(0);
      return;
    }
    backdrop.set(withTiming(0, { duration: 210, easing: Easing.inOut(Easing.cubic) }));
    progress.set(
      withTiming(0, { duration: 300, easing: Easing.bezier(0.4, 0, 1, 1) }, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      }),
    );
  }, [backdrop, progress, visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * windowHeight }],
  }));
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={slideIn}
      onRequestClose={onClose}
    >
      <View style={styles.overlaySheetRoot}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[styles.overlaySheetBackdrop, backdropStyle]}
        />
        <Animated.View
          style={[
            styles.overlaySheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 },
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.border,
              marginTop: 10,
            }}
          />
          {shown}
        </Animated.View>
      </View>
    </Modal>
  );
}
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { colors } = useApp();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel={cancelLabel}
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(20, 30, 25, 0.45)',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <Pressable
          accessibilityRole="alert"
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 26,
            padding: 22,
            width: '100%',
            maxWidth: 400,
            alignSelf: 'center',
          }}
        >
          <Txt weight="rounded" style={{ fontSize: 21, lineHeight: 28, marginBottom: 8 }}>
            {title}
          </Txt>
          <Txt tone="muted" style={{ fontSize: 14, lineHeight: 21, marginBottom: 20 }}>
            {message}
          </Txt>
          <Button
            label={confirmLabel}
            variant="danger"
            onPress={onConfirm}
            loading={busy}
            style={{ backgroundColor: '#FBECE8' }}
          />
          <Button label={cancelLabel} variant="ghost" onPress={onCancel} disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
export { presetIcons };
export function PresetIcon({
  preset,
  size = 25,
  box = 50,
}: {
  preset: Pick<Preset, 'icon' | 'color'>;
  size?: number;
  box?: number;
}) {
  const { isDark } = useApp();
  const Icon = presetIcons[preset.icon] || MapPin;
  const accent = accents[preset.color] || accents.mint;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box * 0.3,
        backgroundColor: isDark ? accent.dark : accent.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size} color={isDark ? '#DAE5D5' : accent.ink} strokeWidth={1.6} />
    </View>
  );
}
export function PresetGrid({
  presets,
  selected,
  onSelect,
  onLongPress,
  longPressLabel = 'Edit',
  disabled = false,
  compact = false,
  actionLabel = 'Check in at',
  paged = false,
  bleed = 0,
  onAdd,
}: {
  presets: Preset[];
  selected?: string;
  onSelect: (p: Preset) => void;
  /** Holding a tile, also offered to screen readers as an action. */
  onLongPress?: (p: Preset) => void;
  longPressLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  actionLabel?: string;
  /** Six tiles per page, swiped sideways, with page dots below once there's more than one. */
  paged?: boolean;
  /** The page's side padding, so swiping runs to the screen edges instead of stopping short. */
  bleed?: number;
  /** With paged, empty spots on a page show placeholder boxes; tapping one runs this. */
  onAdd?: () => void;
}) {
  const { isDark, colors } = useApp();
  // Always three equal columns. Extra tiles start a new row instead of stretching.
  const [width, setWidth] = React.useState(0);
  const GAP = 12;
  const tile = width ? Math.floor((width - GAP * 2) / 3) : undefined;
  const PAGE_SIZE = 6;
  const pages: Preset[][] = [];
  for (let i = 0; i < presets.length; i += PAGE_SIZE) pages.push(presets.slice(i, i + PAGE_SIZE));
  const [page, setPage] = React.useState(0);
  const scroller = React.useRef<ScrollViewInstance>(null);
  // How far apart pages sit: a full width plus the same gap as between tiles.
  const step = width + GAP;
  const current = Math.min(page, Math.max(0, pages.length - 1));
  const renderTile = (p: Preset) => {
    const Icon = presetIcons[p.icon] || MapPin;
    const accent = accents[p.color] || accents.mint;
    const active = selected === p.id;
    return (
      <Pressable
        key={p.id}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${p.name}`}
        accessibilityState={{ selected: active }}
        aria-selected={active}
        accessibilityHint={onLongPress ? `Hold to ${longPressLabel.toLowerCase()}` : undefined}
        accessibilityActions={
          onLongPress ? [{ name: 'longpress', label: longPressLabel }] : undefined
        }
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPress?.(p);
        }}
        disabled={disabled}
        onPress={() => onSelect(p)}
        onLongPress={onLongPress ? () => onLongPress(p) : undefined}
        delayLongPress={400}
        style={({ pressed }) => ({
          width: tile ?? '30%',
          minHeight: compact ? 98 : 112,
          borderRadius: 23,
          padding: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? accent.dark : accent.bg,
          borderWidth: 1.5,
          borderColor: active ? colors.green : 'transparent',
          opacity: pressed ? 0.65 : 1,
          gap: 12,
        })}
      >
        <Icon size={compact ? 28 : 31} color={isDark ? '#DAE5D5' : accent.ink} strokeWidth={1.5} />
        <Txt weight="medium" style={{ fontSize: 13, lineHeight: 17, textAlign: 'center' }}>
          {p.name}
        </Txt>
        {p.favorite && !active && (
          <View style={{ position: 'absolute', top: 9, right: 9 }}>
            <Star
              size={12}
              color={isDark ? '#DAE5D5' : accent.ink}
              fill={isDark ? '#DAE5D5' : accent.ink}
            />
          </View>
        )}
        {active && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: colors.green,
              borderRadius: 10,
              padding: 2,
            }}
          >
            <Check size={11} color={colors.background} />
          </View>
        )}
      </Pressable>
    );
  };
  // A dashed, tile-sized box for an empty spot on a page, ready for a new check-in.
  const renderPlaceholder = (key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel="New check-in"
      disabled={!onAdd}
      onPress={onAdd}
      style={({ pressed }) => ({
        width: tile ?? '30%',
        minHeight: compact ? 98 : 112,
        borderRadius: 23,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: `${colors.muted}59`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Plus size={20} color={colors.muted} strokeWidth={1.6} style={{ opacity: 0.6 }} />
    </Pressable>
  );
  const grid = (items: Preset[], style?: StyleProp<ViewStyle>) => {
    const empty = paged ? (PAGE_SIZE - (items.length % PAGE_SIZE)) % PAGE_SIZE : 0;
    return (
      <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }, style]}>
        {items.map(renderTile)}
        {Array.from({ length: empty }, (_, i) => renderPlaceholder(`empty-${i}`))}
      </View>
    );
  };
  if (!paged || !width || pages.length <= 1)
    return <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>{grid(presets)}</View>;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / step))}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={{ paddingHorizontal: bleed, gap: GAP }}
      >
        {pages.map((items, i) => (
          <View key={i} style={{ width }}>
            {grid(items, { alignContent: 'flex-start' })}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.row, { gap: 6, justifyContent: 'center', marginTop: 14 }]}>
        {pages.map((_, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Check-ins page ${i + 1} of ${pages.length}`}
            accessibilityState={{ selected: i === current }}
            hitSlop={8}
            onPress={() => scroller.current?.scrollTo({ x: i * step, animated: true })}
            style={{
              width: i === current ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === current ? colors.green : `${colors.green}40`,
            }}
          />
        ))}
      </View>
    </View>
  );
}
export function Section({
  title,
  action,
  onAction,
  right,
  hint,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  right?: React.ReactNode;
  /** A short muted note beside the title. */
  hint?: string;
}) {
  const { colors } = useApp();
  return (
    <View style={[styles.between, { marginTop: 22, marginBottom: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Txt weight="rounded" style={{ fontSize: 21, lineHeight: 29 }}>
          {title}
        </Txt>
        {hint && (
          <>
            {/* A bullet between the title and the note. */}
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.muted }} />
            <Txt
              tone="muted"
              numberOfLines={1}
              style={{ fontSize: 12, lineHeight: 17, flexShrink: 1 }}
            >
              {hint}
            </Txt>
          </>
        )}
      </View>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={10}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Txt tone="green" weight="medium" style={{ fontSize: 13 }}>
            {action}
          </Txt>
        </Pressable>
      )}
      {right}
    </View>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useApp();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 23,
          padding: 20,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({
  title,
  subtitle,
  icon: Icon,
  onPress,
  right,
  danger,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const { colors } = useApp();
  const layout: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 17,
    minHeight: 59,
  };
  const content = (
    <>
      {Icon && <Icon size={21} color={danger ? colors.danger : colors.green} strokeWidth={1.7} />}
      <View style={{ flex: 1 }}>
        <Txt weight="medium" style={danger ? { color: colors.danger } : undefined}>
          {title}
        </Txt>
        {subtitle && (
          <Txt tone="muted" style={{ fontSize: 12, lineHeight: 18, marginTop: 3 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {right || (onPress && <ChevronRight size={17} color={colors.muted} />)}
    </>
  );
  // A row without its own action stays a plain container, so a switch inside it isn't
  // reported as disabled by screen readers.
  if (!onPress) return <View style={layout}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [layout, { opacity: pressed ? 0.65 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: '#C8CFC8', true: '#287B5A' }}
      thumbColor="#FFFFFF"
    />
  );
}
export function Field({
  label,
  style,
  grow = false,
  strongLabel = false,
  clearable = false,
  clearButton = false,
  ...props
}: TextInputProps & {
  label: string;
  /** Multiline input that starts one line tall and grows with its text. */
  grow?: boolean;
  /** A bolder label, for forms where the headers should stand out. */
  strongLabel?: boolean;
  /** A "Clear" link beside the label: empties the field and puts the cursor in it. */
  clearable?: boolean;
  /** An ✕ inside the field, for one-line fields: empties it and puts the cursor in it. */
  clearButton?: boolean;
}) {
  const { colors } = useApp();
  const input = React.useRef<TextInputInstance>(null);
  const showClear = clearable && !!props.value && props.editable !== false;
  const showX = clearButton && !!props.value && props.editable !== false;
  const clear = () => {
    props.onChangeText?.('');
    input.current?.focus();
  };
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={[styles.between, { marginBottom: 9, minHeight: 20 }]}>
        <Txt weight={strongLabel ? 'bold' : 'medium'} style={{ fontSize: 13 }}>
          {label}
        </Txt>
        {showClear && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            hitSlop={12}
            onPress={clear}
          >
            {({ pressed }) => (
              <Txt
                tone="green"
                weight="medium"
                style={{ fontSize: 13, opacity: pressed ? 0.6 : 1 }}
              >
                Clear
              </Txt>
            )}
          </Pressable>
        )}
      </View>
      <View>
        <TextInput
          ref={input}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          // Browsers draw a two-row text area by default. Native inputs already size to their text.
          numberOfLines={grow && Platform.OS === 'web' ? 1 : undefined}
          {...props}
          style={[
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 15,
              padding: 16,
              minHeight: 54,
              fontFamily: fonts.body,
              fontSize: 15,
            },
            props.multiline && !grow && { minHeight: 112, textAlignVertical: 'top' },
            grow && { paddingTop: 16, maxHeight: 180 },
            clearButton && { paddingRight: 48 },
            style,
          ]}
        />
        {showX && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            hitSlop={8}
            onPress={clear}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 12,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.subtle,
              }}
            >
              <X size={14} color={colors.muted} strokeWidth={2.4} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  const { colors } = useApp();
  if (!text) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 15,
        borderRadius: 15,
        backgroundColor: error ? '#FBECE8' : colors.softGreen,
        marginVertical: 12,
      }}
    >
      <Txt style={{ fontSize: 13, lineHeight: 20, color: error ? '#963F36' : colors.text }}>
        {text}
      </Txt>
    </View>
  );
}
export function Empty({
  icon: Icon = Heart,
  title,
  description,
  action,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useApp();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 15, gap: 16 }}>
      <View
        style={{
          width: 90,
          height: 90,
          borderRadius: 32,
          backgroundColor: colors.softGreen,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon size={38} color={colors.green} strokeWidth={1.4} />
      </View>
      <Txt weight="rounded" style={{ fontSize: 24, textAlign: 'center', lineHeight: 31 }}>
        {title}
      </Txt>
      <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
        {description}
      </Txt>
      {action && onAction && (
        <Button label={action} onPress={onAction} icon={ArrowRight} style={{ marginTop: 7 }} />
      )}
    </View>
  );
}
/** A confirmation that slides down from the top of the screen, then hides itself. */
/**
 * A screen's message banner. On iOS it's drawn above everything, sheets included, so it always
 * drops in at the top of the screen, never on top of a sheet; taps outside it pass through. It
 * stays a moment after the message clears, so it can slide away.
 */
function TopBanner(props: {
  text: string;
  tone: 'success' | 'warning';
  duration: number;
  top: number;
  onHide: () => void;
}) {
  const [mounted, setMounted] = React.useState(!!props.text);
  if (props.text && !mounted) setMounted(true);
  React.useEffect(() => {
    if (props.text) return;
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [props.text]);
  if (!mounted) return null;
  const toast = <Toast {...props} dismissable />;
  return Platform.OS === 'ios' ? <FullWindowOverlay>{toast}</FullWindowOverlay> : toast;
}
export function Toast({
  text,
  onHide,
  duration = 2600,
  tone = 'success',
  dismissable = false,
  top = 12,
  enterDuration = 260,
}: {
  text: string;
  onHide: () => void;
  duration?: number;
  tone?: 'success' | 'warning';
  dismissable?: boolean;
  top?: number;
  enterDuration?: number;
}) {
  // The timer restarts only for new text, not each time the screen passes a fresh onHide.
  const hide = React.useEffectEvent(onHide);
  React.useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => hide(), duration);
    return () => clearTimeout(timer);
  }, [duration, text]);
  if (!text) return null;
  const Icon = tone === 'warning' ? AlertTriangle : Check;
  return (
    <Animated.View
      key={text}
      entering={SlideInUp.duration(enterDuration)}
      exiting={SlideOutUp.duration(220)}
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top,
        left: 20,
        right: 20,
        alignSelf: 'center',
        maxWidth: 500,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: tone === 'warning' ? '#DE5B55' : '#287B5A',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        zIndex: 20,
      }}
    >
      <Icon size={18} color="#FFFFFF" />
      <Txt weight="medium" style={{ color: '#FFFFFF', flex: 1, fontSize: 14, lineHeight: 20 }}>
        {text}
      </Txt>
      {dismissable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          hitSlop={10}
          onPress={onHide}
          style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, padding: 2 })}
        >
          <X size={17} color="#FFFFFF" />
        </Pressable>
      )}
    </Animated.View>
  );
}
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 11,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: active ? colors.softGreen : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.green : colors.border,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {active && <Check size={14} color={colors.green} />}
      <Txt weight="medium" style={{ fontSize: 13, color: active ? colors.green : colors.muted }}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function Dismiss({ onPress }: { onPress: () => void }) {
  return <IconButton icon={X} label="Close" onPress={onPress} />;
}
export const styles = StyleSheet.create({
  footer: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingHorizontal: 25,
    paddingTop: 12,
  },
  page: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingHorizontal: 25,
    paddingTop: 22,
    paddingBottom: 36,
    // Fills a short screen, so a flex spacer can push content to the bottom.
    flexGrow: 1,
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overlaySheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlaySheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(25, 32, 29, 0.18)',
  },
  overlaySheetTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowOffset: { width: 0, height: 5 },
  },
  overlaySheet: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -5 },
    elevation: 18,
  },
});
