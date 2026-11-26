import { Button, HStack, Image, Link, Rectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  accessibilityLabel,
  aspectRatio,
  background,
  buttonStyle,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { ComponentProps, ReactElement } from 'react';

export type SymbolName = NonNullable<ComponentProps<typeof Image>['systemName']>;

export type ReminderPlace = {
  id: string;
  label: string;
  iconAsset: string;
  symbol: SymbolName;
  /** Opens Messages with this check-in's words and person. */
  url: string;
  /** The check-in's accent colors, from src/design/theme.ts. */
  bg: string;
  ink: string;
  dark: string;
  /** The saved place you just arrived at: shown first, in Arrive green, so it stands out. */
  highlight?: boolean;
};

export type ReminderActivityProps = {
  phase: 'active' | 'checkingIn' | 'completed';
  /** "soft" is a light card; "glass" is dark and see-through. Both use rounded tiles. */
  design: 'soft' | 'glass';
  /** Whether shortcut names appear below their icons. */
  showButtonLabels: boolean;
  /** The line under "arrive.". */
  title: string;
  /** Opens Messages with the default check-in. Shown when there are no places. */
  checkInUrl: string;
  /** Opens Arrive just long enough to end this reminder. Used before iOS 17. */
  dismissUrl: string;
  places: ReminderPlace[];
  /** False in older installed binaries that do not contain the exact icon asset catalog. */
  exactIcons: boolean;
  /**
   * "Homebound" (heading home), shown first: when you left the spot of your last check-in.
   * Never for other triggers.
   */
  coming?: { url: string };
  /**
   * Just checked in: instead of check-ins, two wide buttons. Homebound is left out when you're
   * home already, or there's no saved Home.
   */
  departNow?: { leaving: { url: string }; homebound?: { url: string } };
  /**
   * Only when Appearance → Call button is on and the person has a number: opens Arrive, which
   * asks iOS to call them. iOS confirms every call, so nothing is dialled from the banner alone.
   */
  call?: { url: string; name: string };
  /** iOS 17+: ✕ runs in the background. Before that, it opens Arrive to end the reminder. */
  interactive: boolean;
};

// Runs in the widget's isolated runtime: only @expo/ui components, no app imports or hooks.
//
// A place is a Link straight to Messages' composer, which only Arrive can show, so it opens
// Arrive. There's no confirm step in the banner: the only Send is the real one in Messages.
// ✕ is a Button whose "end" target is handled natively by the patched
// LiveActivityUserInteraction intent (see patches/expo-widgets), which iOS runs without
// opening Arrive.
const ReminderActivity = (props: ReminderActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const glass = props.design === 'glass';
  // Glass is always dark, so its text stays readable over any wallpaper.
  const dark = glass || environment.colorScheme === 'dark';
  const green = dark ? '#82CBA4' : '#287B5A';
  const ink = dark ? '#F0F5ED' : '#293D36';
  const muted = dark ? '#ADBFB1' : '#68766D';
  const done = props.phase === 'completed';
  const places = done ? [] : props.places;
  const coming = done ? undefined : props.coming;
  const departNow = done ? undefined : props.departNow;
  // Fills the row evenly: SwiftUI caps a frame at the space available.
  const fill = 1000;
  const brandMark = (size: number) => (
    <Image
      assetName="ArriveActivityMark"
      modifiers={[
        resizable(),
        aspectRatio({ contentMode: 'fit' }),
        frame({ width: size, height: size }),
      ]}
    />
  );

  const dismissLook = (
    <Image
      systemName="xmark"
      color={muted}
      size={11}
      modifiers={[
        frame({ width: 28, height: 28 }),
        background(glass ? '#FFFFFF1A' : dark ? '#2B4332' : '#EEF2EC'),
        clipShape('circle'),
      ]}
    />
  );
  const dismiss = props.interactive ? (
    <Button target="end" modifiers={[buttonStyle('plain')]}>
      {dismissLook}
    </Button>
  ) : (
    <Link destination={props.dismissUrl}>{dismissLook}</Link>
  );
  const call = props.call && !done && (
    <Link destination={props.call.url} modifiers={[accessibilityLabel(`Call ${props.call.name}`)]}>
      <Image
        systemName="phone.fill"
        color={glass ? '#EAF2E7' : green}
        size={12}
        modifiers={[
          frame({ width: 28, height: 28 }),
          background(glass ? '#287B5ACC' : dark ? '#2B4332' : '#E4F0E8'),
          clipShape('circle'),
        ]}
      />
    </Link>
  );
  const checkIn = (
    <Link
      destination={props.checkInUrl}
      label="Check In"
      modifiers={[
        font({ size: 14, weight: 'semibold' }),
        foregroundStyle('#FFFFFF'),
        padding({ horizontal: 16, vertical: 8 }),
        background('#287B5A'),
        clipShape('capsule'),
      ]}
    />
  );
  // The logo and name exactly as in Arrive (assets/brand/arrive-wordmark.png), with the line
  // under it starting where the name starts and tucked up under it. Widths and the name's start
  // come from assets/brand/wordmark-geometry.json (×30pt); widgets can't import it.
  const header = (
    <HStack spacing={10}>
      <VStack alignment="leading" spacing={-4}>
        <Image
          assetName={dark ? 'ArriveWordmarkDark' : 'ArriveWordmark'}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: 'fit' }),
            frame({ width: 76.3, height: 30 }),
          ]}
        />
        <Text
          modifiers={[
            font({ size: 12 }),
            foregroundStyle(muted),
            lineLimit(1),
            padding({ leading: 29.4 }),
          ]}
        >
          {props.title}
        </Text>
      </VStack>
      <Spacer />
      {!done && !places.length && !departNow && checkIn}
      {call}
      {!done && dismiss}
    </HStack>
  );
  const pick = (p: ReminderPlace, look: ReactElement) => (
    <Link destination={p.url} modifiers={[frame({ maxWidth: fill }), accessibilityLabel(p.label)]}>
      {look}
    </Link>
  );
  // Drawn exactly as the app draws it: `size` is the Lucide icon's size in Arrive (see
  // DraggableIcon in src/components/activity-banner-preview.tsx). The exported images pad the
  // 24-unit glyph to 28 units (scripts/create-widget-icons.cjs), so the frame is scaled up by
  // 28/24 to give the same glyph size and the same 1.6 line weight.
  const presetIcon = (p: ReminderPlace, size: number, color: string) =>
    props.exactIcons ? (
      <Image
        assetName={p.iconAsset}
        color={color}
        modifiers={[
          resizable(),
          aspectRatio({ contentMode: 'fit' }),
          frame({ width: (size * 28) / 24, height: (size * 28) / 24 }),
        ]}
      />
    ) : (
      <Image systemName={p.symbol} color={color} size={size} />
    );
  // The app puts the label 3pt under the glyph; the image's padding already covers part of that.
  const labelGap = (size: number) => (props.exactIcons ? 3 - size / 12 : 3);
  // Light card: a rounded, tinted tile.
  const tileLook = (p: ReminderPlace, showLabel: boolean) => (
    <VStack
      spacing={showLabel ? labelGap(20) : 0}
      modifiers={[
        // Two frames: expo-ui ignores maxWidth when a height is given in the same frame.
        frame({ maxWidth: fill }),
        frame({ height: 58 }),
        background(p.highlight ? '#287B5A' : dark ? p.dark : p.bg),
        clipShape('roundedRectangle', 15),
      ]}
    >
      {presetIcon(p, 20, p.highlight ? '#FFFFFF' : dark ? p.bg : p.ink)}
      {showLabel && (
        <Text
          modifiers={[
            font({ size: 10, weight: p.highlight ? 'semibold' : 'medium' }),
            foregroundStyle(p.highlight ? '#FFFFFF' : dark ? ink : p.ink),
            lineLimit(1),
            minimumScaleFactor(0.7),
          ]}
        >
          {p.label}
        </Text>
      )}
    </VStack>
  );
  // Glass uses the same roomy tile shape as Soft, with translucent accent colors.
  const glassTileLook = (p: ReminderPlace, showLabel: boolean) => (
    <VStack
      spacing={showLabel ? labelGap(21) : 0}
      modifiers={[
        frame({ maxWidth: fill }),
        frame({ height: 58 }),
        background(p.highlight ? '#2E9A6C' : `${p.ink}8C`),
        clipShape('roundedRectangle', 15),
      ]}
    >
      {presetIcon(p, 21, p.highlight ? '#FFFFFF' : p.bg)}
      {showLabel && (
        <Text
          modifiers={[
            font({ size: 10, weight: 'medium' }),
            foregroundStyle('#F0F5ED'),
            lineLimit(1),
            minimumScaleFactor(0.7),
          ]}
        >
          {p.label}
        </Text>
      )}
    </VStack>
  );
  // "Homebound": a house, tinted green so it reads as its own kind of action.
  const comingLook = (light: boolean, showLabel: boolean) =>
    light ? (
      <VStack
        modifiers={[
          frame({ maxWidth: fill }),
          frame({ height: 58 }),
          background(dark ? '#2B4332' : '#E4F0E8'),
          clipShape('roundedRectangle', 15),
        ]}
      >
        <Image systemName="house.fill" color={green} size={17} />
        {showLabel && (
          <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(green)]}>
            Homebound
          </Text>
        )}
      </VStack>
    ) : (
      <VStack
        spacing={showLabel ? 3 : 0}
        modifiers={[
          frame({ maxWidth: fill }),
          frame({ height: 58 }),
          background('#287B5ACC'),
          clipShape('roundedRectangle', 15),
        ]}
      >
        <Image systemName="house.fill" color="#EAF2E7" size={17} />
        {showLabel && (
          <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle('#F0F5ED')]}>
            Homebound
          </Text>
        )}
      </VStack>
    );
  // A hairline between Homebound and the arrival shortcuts.
  const divider = (height: number) => (
    <Rectangle
      modifiers={[frame({ width: 1, height }), foregroundStyle(dark ? '#FFFFFF33' : '#29403626')]}
    />
  );
  // Just checked in: Leaving (the return arrow) and Homebound (a house), side by side.
  const departButton = (url: string, symbol: SymbolName, label: string, light: boolean) => (
    <Link destination={url} modifiers={[frame({ maxWidth: fill }), accessibilityLabel(label)]}>
      <HStack
        spacing={7}
        modifiers={[
          frame({ maxWidth: fill }),
          frame({ height: 46 }),
          background(light ? (dark ? '#2B4332' : '#E4F0E8') : '#287B5ACC'),
          clipShape('roundedRectangle', 14),
        ]}
      >
        <Image systemName={symbol} color={light ? green : '#EAF2E7'} size={15} />
        <Text
          modifiers={[
            font({ size: 14, weight: 'semibold' }),
            foregroundStyle(light ? green : '#F0F5ED'),
          ]}
        >
          {label}
        </Text>
      </HStack>
    </Link>
  );
  const depart = (light: boolean) =>
    departNow && (
      <HStack spacing={8}>
        {departButton(departNow.leaving.url, 'arrow.uturn.backward', 'Leaving', light)}
        {departNow.homebound &&
          departButton(departNow.homebound.url, 'house.fill', 'Homebound', light)}
      </HStack>
    );
  const choices = (light: boolean, compact = false) => {
    const showLabels = props.showButtonLabels && places.length < 5;
    return (
      <HStack spacing={light ? 7 : 5} modifiers={[frame({ height: compact ? 58 : 68 })]}>
        {coming && (
          <Link
            destination={coming.url}
            modifiers={[frame({ width: compact ? 46 : 58 }), accessibilityLabel('Homebound')]}
          >
            {comingLook(light, showLabels)}
          </Link>
        )}
        {coming && places.length > 0 && divider(compact ? 48 : 60)}
        {places.map((p) => pick(p, light ? tileLook(p, showLabels) : glassTileLook(p, showLabels)))}
      </HStack>
    );
  };

  return {
    banner: (
      <VStack
        spacing={8}
        modifiers={[
          padding({ horizontal: 14, vertical: 12 }),
          activityBackgroundTint(glass ? '#101A16B3' : dark ? '#17241F' : '#FCFCF8'),
        ]}
      >
        {header}
        {departNow ? depart(!glass) : (places.length > 0 || !!coming) && choices(!glass)}
      </VStack>
    ),
    compactLeading: done ? (
      <Image systemName="checkmark" color="#82CBA4" size={14} />
    ) : (
      brandMark(17)
    ),
    compactTrailing: (
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#82CBA4')]}>
        {done ? 'Done' : 'Check in'}
      </Text>
    ),
    minimal: done ? <Image systemName="checkmark" color="#82CBA4" size={13} /> : brandMark(16),
    expandedLeading: done ? (
      <Image
        systemName="checkmark"
        color="#82CBA4"
        size={20}
        modifiers={[padding({ leading: 4 })]}
      />
    ) : (
      <Image
        assetName="ArriveActivityMark"
        modifiers={[
          resizable(),
          aspectRatio({ contentMode: 'fit' }),
          frame({ width: 23, height: 23 }),
          padding({ leading: 4 }),
        ]}
      />
    ),
    expandedCenter: (
      <Text modifiers={[font({ size: 15, weight: 'semibold', design: 'rounded' }), lineLimit(1)]}>
        {done ? 'Check-in sent' : props.title}
      </Text>
    ),
    expandedTrailing: done ? undefined : call ? (
      <HStack spacing={8}>
        {call}
        {dismiss}
      </HStack>
    ) : (
      dismiss
    ),
    // The Dynamic Island is always dark, so it uses the round buttons in both designs.
    expandedBottom: done ? (
      <Text modifiers={[font({ size: 13 }), foregroundStyle('#ADBFB1')]}>
        Your check-in was sent.
      </Text>
    ) : departNow ? (
      <VStack modifiers={[padding({ top: 6 })]}>{depart(false)}</VStack>
    ) : places.length || coming ? (
      <VStack modifiers={[padding({ top: 6 })]}>{choices(false, true)}</VStack>
    ) : (
      <HStack modifiers={[padding({ top: 6 })]}>
        <Spacer />
        {checkIn}
        <Spacer />
      </HStack>
    ),
  };
};

// Registered at import time. There is no widgets[] entry for this in app.json, per expo-widgets.
export default createLiveActivity('ArriveReminder', ReminderActivity);
