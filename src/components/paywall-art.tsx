import { View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Txt } from '@/components/ui';
import { useApp } from '@/state/app';

// A rounded crown, centred on (0, 0).
const crown = 'M-26 16L-30 -12L-14 0L0 -20L14 0L30 -12L26 16Z';
const sparkle = (size: number) =>
  `M0 ${-size}C${size * 0.18} ${-size * 0.18} ${size * 0.18} ${-size * 0.18} ${size} 0C${size * 0.18} ${size * 0.18} ${size * 0.18} ${size * 0.18} 0 ${size}C${-size * 0.18} ${size * 0.18} ${-size * 0.18} ${size * 0.18} ${-size} 0C${-size * 0.18} ${-size * 0.18} ${-size * 0.18} ${-size * 0.18} 0 ${-size}Z`;
const leaf = 'M0 0C4 -9 14 -12 22 -9C19 -1 10 3 0 0Z';

/** A sprig of leaves growing from (x, y), leaning by `lean` degrees. */
function Sprig({
  x,
  y,
  lean,
  flip,
  color,
}: {
  x: number;
  y: number;
  lean: number;
  flip?: boolean;
  color: string;
}) {
  const s = flip ? -1 : 1;
  return (
    <G transform={`translate(${x} ${y}) rotate(${lean}) scale(${s} 1)`}>
      <Path
        d="M0 0C-2 -18 -6 -34 -14 -50"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <G transform="translate(-3 -16) rotate(-30)">
        <Path d={leaf} fill={color} />
      </G>
      <G transform="translate(-6 -28) rotate(200) scale(1 -1)">
        <Path d={leaf} fill={color} />
      </G>
      <G transform="translate(-10 -40) rotate(-50)">
        <Path d={leaf} fill={color} />
      </G>
      <G transform="translate(-14 -50) rotate(-100) scale(0.85)">
        <Path d={leaf} fill={color} />
      </G>
    </G>
  );
}

/** The paywall's hero: a glowing crown tile among leaves, labelled "Arrive Plus". */
export function PlusHeroArt() {
  const { isDark } = useApp();
  const { width } = useWindowDimensions();
  const w = Math.min(340, width - 32);
  const h = (w * 210) / 340;
  const ground = isDark ? '#22342A' : '#E6F0DE';
  const bush = isDark ? '#2C4434' : '#D3E6C8';
  const bushDeep = isDark ? '#335040' : '#C2DBB5';
  const leafColor = isDark ? '#5E9A6C' : '#8FBF8A';
  const gold = '#F2BE4A';
  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }}>
      <Svg width={w} height={h} viewBox="0 0 340 210">
        <Defs>
          <LinearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF5DC" />
            <Stop offset="1" stopColor="#F8DC97" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="170" cy="182" rx="150" ry="20" fill={ground} />
        {/* Bushes behind the tile */}
        <Circle cx="104" cy="168" r="20" fill={bush} />
        <Circle cx="124" cy="160" r="22" fill={bushDeep} />
        <Circle cx="218" cy="160" r="22" fill={bushDeep} />
        <Circle cx="240" cy="168" r="20" fill={bush} />
        <Sprig x={100} y={168} lean={-18} color={leafColor} />
        <Sprig x={244} y={164} lean={14} flip color={leafColor} />
        {/* Rays above the tile */}
        <G stroke={gold} strokeWidth="5" strokeLinecap="round">
          <Path d="M170 6V22" />
          <Path d="M136 16L144 29" />
          <Path d="M204 16L196 29" />
        </G>
        <Path transform="translate(54 68)" d={sparkle(10)} fill={gold} />
        <Path transform="translate(296 128)" d={sparkle(8)} fill={gold} />
        {/* Crown tile */}
        <Rect
          x="114"
          y="36"
          width="112"
          height="112"
          rx="32"
          fill="#FFFFFF"
          opacity={isDark ? 0.18 : 0.85}
        />
        <Rect x="122" y="44" width="96" height="96" rx="26" fill="url(#tile)" />
        <Path
          transform="translate(170 94)"
          d={crown}
          fill={gold}
          stroke={gold}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      </Svg>
      {/* The name, on a pill across the bottom of the tile */}
      <View
        style={{
          position: 'absolute',
          top: (h * 134) / 210,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: '#2F6E4F',
        }}
      >
        <Txt style={{ color: gold, fontSize: 11 }}>✦</Txt>
        <Txt weight="bold" style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 20 }}>
          Arrive Plus
        </Txt>
        <Txt style={{ color: gold, fontSize: 11 }}>✦</Txt>
      </View>
    </View>
  );
}
