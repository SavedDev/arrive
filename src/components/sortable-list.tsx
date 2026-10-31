import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GripVertical } from 'lucide-react-native';
import { useApp } from '@/state/app';

/**
 * A list of fixed-height rows reordered by dragging the grip on the left of each row.
 * Other rows slide out of the way while dragging. The new order is reported on drop.
 */
export function SortableList<T>({
  items,
  keyOf,
  labelOf,
  rowHeight,
  renderRow,
  onReorder,
  onDragChange,
}: {
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  rowHeight: number;
  renderRow: (item: T) => ReactNode;
  onReorder: (keys: string[]) => void;
  /** Lets the parent pause its scroll view while a row is held. */
  onDragChange?: (dragging: boolean) => void;
}) {
  // Local order of keys, so a drop shows immediately before storage catches up.
  // Items are looked up fresh each render, so edits like a rename always show.
  const signature = items.map(keyOf).join('|');
  const [order, setOrder] = useState(() => items.map(keyOf));
  const [synced, setSynced] = useState(signature);
  if (synced !== signature) {
    // Someone was added, removed, or reordered elsewhere: adopt that order.
    setSynced(signature);
    setOrder(items.map(keyOf));
  }
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const rows = order.flatMap((key) => (byKey.has(key) ? [byKey.get(key) as T] : []));
  const active = useSharedValue(-1),
    target = useSharedValue(-1),
    dragY = useSharedValue(0);
  function move(from: number, to: number) {
    active.set(-1);
    target.set(-1);
    dragY.set(0);
    onDragChange?.(false);
    if (from < 0 || from === to) return;
    const next = rows.map(keyOf);
    const [key] = next.splice(from, 1);
    next.splice(to, 0, key);
    setOrder(next);
    onReorder(next);
  }
  return (
    <View style={{ height: rows.length * rowHeight }}>
      {rows.map((item, index) => (
        <SortableRow
          key={keyOf(item)}
          index={index}
          count={rows.length}
          label={labelOf(item)}
          rowHeight={rowHeight}
          active={active}
          target={target}
          dragY={dragY}
          onStart={() => onDragChange?.(true)}
          onDrop={move}
        >
          {renderRow(item)}
        </SortableRow>
      ))}
    </View>
  );
}

function SortableRow({
  index,
  count,
  label,
  rowHeight,
  active,
  target,
  dragY,
  onStart,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  label: string;
  rowHeight: number;
  active: SharedValue<number>;
  target: SharedValue<number>;
  dragY: SharedValue<number>;
  onStart: () => void;
  onDrop: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const { colors } = useApp();
  // A single row has nothing to reorder, so its handle is off.
  const sortable = count > 1;
  const pan = Gesture.Pan()
    .enabled(sortable)
    .minDistance(0)
    .onStart(() => {
      active.set(index);
      target.set(index);
      scheduleOnRN(onStart);
    })
    .onUpdate((e) => {
      dragY.set(e.translationY);
      target.set(Math.max(0, Math.min(count - 1, Math.round(index + e.translationY / rowHeight))));
    })
    .onFinalize(() => {
      if (active.get() === index) scheduleOnRN(onDrop, index, target.get());
    });
  const style = useAnimatedStyle(() => {
    const dragging = active.get();
    if (dragging === index)
      return {
        top: index * rowHeight,
        zIndex: 10,
        transform: [{ translateY: dragY.get() }, { scale: 1.02 }],
        shadowOpacity: 0.12,
      };
    let shift = 0;
    if (dragging >= 0) {
      if (index > dragging && index <= target.get()) shift = -rowHeight;
      else if (index < dragging && index >= target.get()) shift = rowHeight;
    }
    return {
      top: index * rowHeight,
      zIndex: 0,
      transform: [
        { translateY: dragging >= 0 ? withTiming(shift, { duration: 160 }) : 0 },
        { scale: 1 },
      ],
      shadowOpacity: 0,
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          height: rowHeight,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          shadowColor: '#000',
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Reorder ${label}`}
          accessibilityHint={sortable ? 'Drag up or down to change the order' : undefined}
          accessibilityState={{ disabled: !sortable }}
          aria-disabled={!sortable}
          accessibilityActions={
            sortable
              ? [
                  { name: 'increment', label: 'Move down' },
                  { name: 'decrement', label: 'Move up' },
                ]
              : undefined
          }
          onAccessibilityAction={(e) => {
            const to = e.nativeEvent.actionName === 'increment' ? index + 1 : index - 1;
            if (sortable && to >= 0 && to < count) onDrop(index, to);
          }}
          hitSlop={8}
          style={{
            width: 34,
            height: rowHeight,
            justifyContent: 'center',
            marginLeft: -6,
            // Dimmed while there's nothing to reorder it against.
            opacity: sortable ? 1 : 0.35,
          }}
        >
          <GripVertical size={20} color={colors.muted} />
        </View>
      </GestureDetector>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>
  );
}
