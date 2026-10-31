import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** A soft multicolor highlight that continuously travels around a rounded card's edge. */
export function AttentionBorder({ radius = 22 }: { radius?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  const pathWidth = Math.max(0, size.width - 3);
  const pathHeight = Math.max(0, size.height - 3);
  const corner = Math.max(0, Math.min(radius - 1.5, pathWidth / 2, pathHeight / 2));
  const perimeter = Math.max(1, 2 * (pathWidth + pathHeight - 4 * corner) + 2 * Math.PI * corner);
  const segment = Math.min(96, perimeter * 0.23);
  const animatedProps = useAnimatedProps(
    () => ({ strokeDashoffset: -progress.value * perimeter }),
    [perimeter],
  );

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 4400, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [perimeter, progress]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={StyleSheet.absoluteFill}
    >
      {!!size.width && !!size.height && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="attention-border" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#C3839A" />
              <Stop offset="34%" stopColor="#DC997B" />
              <Stop offset="67%" stopColor="#82AD91" />
              <Stop offset="100%" stopColor="#83A5BD" />
            </LinearGradient>
          </Defs>
          <Rect
            x={1.5}
            y={1.5}
            width={pathWidth}
            height={pathHeight}
            rx={corner}
            fill="none"
            stroke="url(#attention-border)"
            strokeOpacity={0.6}
            strokeWidth={2}
          />
          <AnimatedRect
            animatedProps={animatedProps}
            x={1.5}
            y={1.5}
            width={pathWidth}
            height={pathHeight}
            rx={corner}
            fill="none"
            stroke="#FFF7EC"
            strokeOpacity={0.5}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={`${segment} ${Math.max(1, perimeter - segment)}`}
          />
        </Svg>
      )}
    </View>
  );
}
