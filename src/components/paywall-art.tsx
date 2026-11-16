import { View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { Txt } from '@/components/ui';
import { useApp } from '@/state/app';

const crown = 'M14 40l-4-22 11 9 9-15 9 15 11-9-4 22z';

/** The paywall's hero: a glowing crown tile, an orbit, sparkles, and what Plus includes. */
export function CrownArt() {
  const { colors } = useApp();
  const { width } = useWindowDimensions();
  const w = Math.min(360, width - 32);
  const h = (w * 210) / 360;
  const chips = ['Smart Check-Ins', 'Lock Screen shortcuts', 'Gentle reminders'];
  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }}>
      <Svg width={w} height={h} viewBox="0 0 360 210" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#E3EED9" stopOpacity="1" />
            <Stop offset="1" stopColor="#E3EED9" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="tile" cx="40%" cy="30%" r="80%">
            <Stop offset="0" stopColor="#FFF6DD" />
            <Stop offset="1" stopColor="#F7E2A6" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="185" cy="120" rx="185" ry="90" fill="url(#glow)" />
        <Ellipse cx="200" cy="150" rx="150" ry="40" fill="#DDE9D1" opacity="0.7" />
        {/* Orbit around the tile */}
        <Path
          d="M30 128c10-40 170-70 210-40"
          stroke="#B9D3AD"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        {/* Crown tile */}
        <G>
          <Rect x="54" y="42" width="112" height="112" rx="30" fill="#FFFFFF" opacity="0.6" />
          <Rect x="60" y="48" width="100" height="100" rx="26" fill="url(#tile)" />
          <G x="83" y="62" scale="1.1">
            <Path d={crown} fill="#E9B23F" />
            <Circle cx="10" cy="18" r="3.5" fill="#E9B23F" />
            <Circle cx="30" cy="11" r="3.5" fill="#E9B23F" />
            <Circle cx="50" cy="18" r="3.5" fill="#E9B23F" />
          </G>
        </G>
        {/* Sparkles */}
        <G stroke="#EDB24E" strokeWidth="4" strokeLinecap="round">
          <Path d="M100 18l4 14" />
          <Path d="M124 10l-2 15" />
          <Path d="M146 20l-8 10" />
        </G>
        <Path d="M30 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#EDB24E" />
        <Path
          d="M340 150l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z"
          fill="#EDB24E"
        />
        <Path d="M52 180l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="#FFFFFF" />
      </Svg>
      {/* What's included, as little tags */}
      <View style={{ position: 'absolute', right: 0, top: h * 0.12, gap: 8 }}>
        {chips.map((label, i) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.surface,
              marginRight: i === 1 ? 12 : 0,
              transform: [{ rotate: `${4 - i}deg` }],
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#5FA36E',
              }}
            >
              <Check size={11} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Txt weight="medium" style={{ fontSize: 12.5, lineHeight: 17 }}>
              {label}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A small crown tile with a few sparkles, for the free trial card. */
export function CrownBadge() {
  return (
    <Svg width={58} height={52} viewBox="0 0 58 52">
      <G stroke="#EDB24E" strokeWidth="2.6" strokeLinecap="round">
        <Path d="M10 4l3 7" />
        <Path d="M2 14l7 3" />
      </G>
      <Rect x="14" y="10" width="42" height="40" rx="12" fill="#FAEBC2" />
      <G x="20" y="14" scale="0.5">
        <Path d={crown} fill="#E9B23F" />
        <Circle cx="10" cy="18" r="3.5" fill="#E9B23F" />
        <Circle cx="30" cy="11" r="3.5" fill="#E9B23F" />
        <Circle cx="50" cy="18" r="3.5" fill="#E9B23F" />
      </G>
    </Svg>
  );
}
