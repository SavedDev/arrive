import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { Leaf, Palette, Phone, Sun } from 'lucide-react-native';
import { presetIcons } from '@/design/icons';
import { accents } from '@/design/theme';
import type { Preferences, Preset } from '@/lib/types';
import { BrandMark } from './brand-mark';
import { Txt } from './ui';

function DraggableIcon({
  preset,
  index,
  count,
  slotWidth,
  gap,
  glass,
  labels,
  active,
  activeId,
  target,
  dragOrder,
  heldX,
  orderIds,
  onStart,
  onDrop,
}: {
  preset: Preset;
  index: number;
  count: number;
  slotWidth: number;
  gap: number;
  glass: boolean;
  labels: boolean;
  active: SharedValue<number>;
  activeId: SharedValue<string>;
  target: SharedValue<number>;
  dragOrder: SharedValue<string[]>;
  heldX: SharedValue<number>;
  orderIds: string[];
  onStart: () => void;
  onDrop: (from: number, to: number) => void;
}) {
  const Icon = presetIcons[preset.icon];
  const accent = accents[preset.color] || accents.mint;
  const showLabel = labels && count < 5;
  const slot = slotWidth + gap;
  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      active.set(index);
      activeId.set(preset.id);
      target.set(index);
      dragOrder.set(orderIds);
      heldX.set(index * slot);
      scheduleOnRN(onStart);
    })
    .onUpdate((event) => {
      heldX.set(index * slot + event.translationX);
      target.set(Math.max(0, Math.min(count - 1, Math.round(index + event.translationX / slot))));
    })
    .onEnd(() => {
      const destination = target.get();
      heldX.set(
        withTiming(
          destination * slot,
          { duration: 100, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onDrop, index, destination);
          },
        ),
      );
    })
    .onFinalize((_event, success) => {
      if (!success && activeId.get() === preset.id) scheduleOnRN(onDrop, index, index);
    });
  const animatedStyle = useAnimatedStyle(() => {
    const held = active.get();
    const heldPreset = activeId.get() === preset.id;
    const originalIndex = dragOrder.get().indexOf(preset.id);
    const restingIndex = originalIndex < 0 ? index : originalIndex;
    let shift = 0;
    if (held >= 0 && !heldPreset) {
      if (restingIndex > held && restingIndex <= target.get()) shift = -slot;
      else if (restingIndex < held && restingIndex >= target.get()) shift = slot;
    }
    return {
      zIndex: heldPreset ? 3 : 1,
      transform: [
        {
          translateX: heldPreset
            ? heldX.get()
            : withTiming((held >= 0 ? restingIndex : index) * slot + shift, {
                duration: 105,
                easing: Easing.out(Easing.cubic),
              }),
        },
      ],
    };
  });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={`${preset.name}, position ${index + 1} of ${count}`}
        accessibilityActions={[
          { name: 'decrement', label: 'Move left' },
          { name: 'increment', label: 'Move right' },
        ]}
        onAccessibilityAction={(event) => {
          const next = event.nativeEvent.actionName === 'decrement' ? index - 1 : index + 1;
          if (next >= 0 && next < count) {
            onDrop(index, next);
          }
        }}
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: slotWidth,
            height: 76,
          },
          animatedStyle,
        ]}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <View
            style={{
              width: '100%',
              height: 58,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: glass ? `${accent.ink}8C` : accent.bg,
            }}
          >
            <Icon size={glass ? 21 : 20} color={glass ? accent.bg : accent.ink} strokeWidth={1.6} />
            {showLabel && (
              <Txt
                numberOfLines={1}
                adjustsFontSizeToFit
                weight="medium"
                style={{
                  color: glass ? '#F0F5ED' : accent.ink,
                  fontSize: 10,
                  lineHeight: 13,
                  marginTop: 3,
                }}
              >
                {preset.name}
              </Txt>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const CARD_PADDING = 14;
const CARD_BORDER = 1;

export function ActivityBannerPreview({
  presets,
  design,
  showLabels,
  showCall = false,
  width,
  onReorder,
  onAppearance,
  onDragChange,
}: {
  presets: Preset[];
  design: Preferences['lockScreenStyle'];
  showLabels: boolean;
  /** The call button beside the banner's title, as in Appearance → Call button. */
  showCall?: boolean;
  /**
   * The preview's width, when it's known before layout (Appearance's copy over Home's preview).
   * The icons then start in their final places instead of settling into them.
   */
  width?: number;
  onReorder: (ids: string[]) => void;
  onAppearance: () => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const glass = design === 'glass';
  const ink = glass ? '#F0F5ED' : '#293D36';
  const muted = glass ? '#ADBFB1' : '#68766D';
  const [items, setItems] = useState(presets);
  // The icon row sits inside the banner card's border and padding.
  const [rowWidth, setRowWidth] = useState(width ? width - 2 * (CARD_BORDER + CARD_PADDING) : 0);
  const itemsRef = useRef(items);
  const draggingRef = useRef(false);
  const pendingReset = useRef(false);
  const active = useSharedValue(-1);
  const activeId = useSharedValue('');
  const target = useSharedValue(-1);
  const dragOrder = useSharedValue<string[]>([]);
  const heldX = useSharedValue(0);
  useEffect(() => {
    if (draggingRef.current) return;
    itemsRef.current = presets;
    setItems(presets);
  }, [presets]);
  const gap = glass ? 5 : 7;
  const slotWidth =
    rowWidth && items.length ? (rowWidth - gap * (items.length - 1)) / items.length : 60;
  const startDrag = () => {
    draggingRef.current = true;
    onDragChange(true);
  };
  const resetDrag = React.useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      active.set(-1);
      activeId.set('');
      target.set(-1);
      dragOrder.set([]);
      heldX.set(0);
    });
    draggingRef.current = false;
    onDragChange(false);
  }, [active, activeId, dragOrder, heldX, onDragChange, target]);
  useLayoutEffect(() => {
    if (!pendingReset.current) return;
    pendingReset.current = false;
    // React commits the new order before the UI-thread gesture state is cleared. Waiting two
    // frames prevents the held tile from seeing its old index during that handoff.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(resetDrag);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [items, resetDrag]);
  const finishDrag = (from: number, to: number) => {
    if (from >= 0 && from !== to) {
      const next = [...itemsRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      itemsRef.current = next;
      pendingReset.current = true;
      setItems(next);
      onReorder(next.map((preset) => preset.id));
      return;
    }
    resetDrag();
  };
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Txt weight="rounded" style={{ fontSize: 17 }}>
            Lock Screen banner
          </Txt>
          <Txt tone="muted" style={{ fontSize: 12 }}>
            Drag the icons to reorder them
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open banner appearance"
          onPress={onAppearance}
          hitSlop={6}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Palette size={24} color="#287B5A" />
        </Pressable>
      </View>
      <View
        style={{
          marginTop: 10,
          borderRadius: 28,
          padding: CARD_PADDING,
          gap: 10,
          backgroundColor: glass ? '#101A16' : '#FCFCF8',
          borderWidth: CARD_BORDER,
          borderColor: glass ? '#34483C' : '#E8EBE4',
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark size={32} />
          <View style={{ flex: 1 }}>
            <Txt weight="display" style={{ color: ink, fontSize: 17, lineHeight: 19 }}>
              arrive<Txt style={{ color: glass ? '#82CBA4' : '#287B5A', fontSize: 17 }}>.</Txt>
            </Txt>
            <Txt numberOfLines={1} style={{ color: muted, fontSize: 12, lineHeight: 16 }}>
              Where did you make it to?
            </Txt>
          </View>
          {!glass && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Leaf size={14} color="#8DBE8F" fill="#8DBE8F" />
              <Sun size={19} color="#E9B949" fill="#E9B949" />
            </View>
          )}
          {showCall && (
            <View
              accessibilityLabel="Call button"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: glass ? '#287B5ACC' : '#E4F0E8',
              }}
            >
              <Phone
                size={13}
                color={glass ? '#EAF2E7' : '#287B5A'}
                fill={glass ? '#EAF2E7' : '#287B5A'}
              />
            </View>
          )}
        </View>
        <View
          onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
          style={{ position: 'relative', height: 76 }}
        >
          {items.map((preset, index) => (
            <DraggableIcon
              key={preset.id}
              preset={preset}
              index={index}
              count={items.length}
              slotWidth={slotWidth}
              gap={gap}
              glass={glass}
              labels={showLabels}
              active={active}
              activeId={activeId}
              target={target}
              dragOrder={dragOrder}
              heldX={heldX}
              orderIds={items.map((item) => item.id)}
              onStart={startDrag}
              onDrop={finishDrag}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
