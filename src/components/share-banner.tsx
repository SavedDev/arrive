import { styles, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/domain';
import { invitationMessage } from '@/lib/invitation';
import { share } from '@/lib/share';
import { useApp } from '@/state/app';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

/**
 * The "Share Arrive" card on Home and Your person: opens the share sheet with an invitation to
 * install Arrive. It's a quiet, flat gray, since Home is already colorful.
 */
export function ShareBanner(props: {
  onError: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const app = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share Arrive"
      onPress={() => {
        void share({
          message: invitationMessage(process.env.EXPO_PUBLIC_INSTALL_URL),
        }).catch((e) => props.onError(errorMessage(e)));
      }}
      style={({ pressed }) => [
        {
          borderRadius: 20,
          borderWidth: 1,
          borderColor: app.isDark ? '#414E47' : '#DDE1D9',
          backgroundColor: app.isDark ? '#2C3631' : '#EEF0EB',
          paddingHorizontal: 18,
          paddingVertical: 14,
          overflow: 'hidden',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        },
        props.style,
      ]}
    >
      <ShareArt dark={app.isDark} />
      <View style={{ maxWidth: '80%', gap: 2 }}>
        <View style={[styles.row, { gap: 6 }]}>
          <Txt weight="rounded" style={{ fontSize: 17, lineHeight: 22 }}>
            Share Arrive
          </Txt>
          <ArrowRight size={16} color={app.colors.green} />
        </View>
        <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
          Peace of mind is better shared.
        </Txt>
      </View>
    </Pressable>
  );
}

/** A 4-point sparkle centred on x, y. */
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

/** The card's art: Arrive's pin with a sun and rolling green hills, in the right corner. */
function ShareArt({ dark }: { dark: boolean }) {
  const c = dark
    ? { hillBack: '#356F4B', hillFront: '#3F8058', ray: '#E8BC52' }
    : { hillBack: '#C4E3BA', hillFront: '#A9D69D', ray: '#E5A92E' };
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg
        width={118}
        height="100%"
        viewBox="0 0 118 72"
        preserveAspectRatio="xMaxYMax meet"
        style={{ position: 'absolute', right: 0, bottom: 0 }}
      >
        {/* Sun, peeking out behind the pin */}
        <G stroke={c.ray} strokeWidth={2.2} strokeLinecap="round">
          <Path d="M88 6.5v-4M101 12l3-3M106.5 25h4M101 38l3 3M75 12l-3-3" />
        </G>
        <Circle cx={88} cy={25} r={12.5} fill="#F4CD68" />
        {/* Hills */}
        <Path d="M0 72C22 58 48 52 80 55S112 60 118 58V72Z" fill={c.hillBack} />
        <Path d="M34 72C58 62 86 61 118 66V72Z" fill={c.hillFront} />
        {/* Arrive's pin with its heart */}
        <Path
          d="M70 62C62.5 53 56 46 56 37.5a14 14 0 0 1 28 0C84 46 77.5 53 70 62Z"
          fill="#E9705A"
        />
        <Path
          d="M70 44.5C61.5 39 61.5 31 66.5 31c1.7 0 2.9 1 3.5 2.2.6-1.2 1.8-2.2 3.5-2.2 5 0 5 8-3.5 13.5Z"
          fill="#FFFFFF"
        />
        {/* Sparkles */}
        <Path d={sparkle(46, 24, 4)} fill={c.ray} />
        <Path d={sparkle(104, 48, 3)} fill={c.ray} />
      </Svg>
    </View>
  );
}
