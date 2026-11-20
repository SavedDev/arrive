import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text,
  Image as SvgImage,
} from 'react-native-svg';
import { WORDMARK } from '@/components/wordmark';
import { fonts } from '@/design/theme';

const wordmark = require('../../assets/images/arrive-wordmark.png');
const appIcon = require('../../assets/images/arrive-icon.png');

/** Arrive's logo and name at (x, y), `h` tall, as in the app and on the Lock Screen. */
function BannerWordmark({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <SvgImage
      href={wordmark}
      x={x}
      y={y}
      width={h * WORDMARK.aspect}
      height={h}
      preserveAspectRatio="xMinYMid meet"
    />
  );
}

// Onboarding illustrations, drawn in the same soft palette as the rest of Arrive.

/**
 * A Lock Screen with Arrive's check-in banner. Step 1 shows a tap on Gym; the reminders step
 * shows a bell instead, since that banner is the reminder.
 */
export function CheckInArt({
  width = 320,
  tap = true,
  bell = false,
}: {
  width?: number;
  tap?: boolean;
  bell?: boolean;
}) {
  const height = (width * 300) / 320;
  return (
    <Svg width={width} height={height} viewBox="0 0 320 300">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#A9BFCF" />
          <Stop offset="0.55" stopColor="#E9D9A8" />
          <Stop offset="1" stopColor="#F4DFA6" />
        </LinearGradient>
        {/* The phone fades into the page instead of ending in a hard edge. */}
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FCFCF8" stopOpacity="0" />
          <Stop offset="1" stopColor="#FCFCF8" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      {/* Clouds and bushes behind the phone */}
      <Path d="M14 140c0-12 10-20 22-18 4-12 22-16 31-5 10-2 18 6 16 16H14z" fill="#DCE5EC" />
      <Path d="M246 158c2-10 12-15 21-11 6-9 22-7 25 4 9 0 15 8 12 15h-58z" fill="#DCE5EC" />
      <Ellipse cx="52" cy="232" rx="50" ry="60" fill="#D6E3C8" />
      <Ellipse cx="270" cy="232" rx="50" ry="60" fill="#D6E3C8" />
      <Path d="M8 288c8-40 34-62 58-66-14 22-14 46-8 66z" fill="#94B58B" />
      <Path d="M312 288c-8-40-34-62-58-66 14 22 14 46 8 66z" fill="#94B58B" />
      {/* Phone */}
      <Rect x="72" y="8" width="176" height="300" rx="36" fill="#9DABA6" />
      <Rect x="79" y="15" width="162" height="290" rx="30" fill="url(#sky)" />
      <Rect x="128" y="15" width="64" height="18" rx="9" fill="#2E3E38" />
      <Path d="M79 150c26-14 52-18 80-10 22-12 52-14 82-2v60H79z" fill="#7FA483" opacity="0.75" />
      <Path d="M79 168c30-10 60-8 92 2 24-6 48-6 70 0v40H79z" fill="#5E8B6C" opacity="0.6" />
      <Text
        x="160"
        y="78"
        fill="#FFFFFF"
        fontSize="40"
        fontFamily={fonts.bold}
        fontWeight="700"
        textAnchor="middle"
      >
        9:41
      </Text>
      <Text
        x="160"
        y="98"
        fill="#FFFFFF"
        fontSize="11"
        fontFamily={fonts.medium}
        textAnchor="middle"
      >
        Mon, Nov 17
      </Text>
      {bell ? (
        <G>
          {/* A regular notification, as iOS shows it on the Lock Screen */}
          <Rect x="88" y="150" width="144" height="46" rx="14" fill="#FFFFFF" opacity="0.95" />
          {/* Arrive's app icon, as iOS shows it beside a notification */}
          <ClipPath id="notifIcon">
            <Rect x="97" y="159" width="28" height="28" rx="7" />
          </ClipPath>
          <SvgImage
            href={appIcon}
            x="97"
            y="159"
            width="28"
            height="28"
            clipPath="url(#notifIcon)"
          />
          <Text
            x="133"
            y="170"
            fill="#293D36"
            fontSize="11"
            fontFamily={fonts.bold}
            fontWeight="700"
          >
            Arrive
          </Text>
          <Text x="133" y="183" fill="#4C5C55" fontSize="9" fontFamily={fonts.body}>
            Time to check in?
          </Text>
          <Text
            x="224"
            y="170"
            fill="#8A968E"
            fontSize="7.5"
            fontFamily={fonts.body}
            textAnchor="end"
          >
            now
          </Text>
        </G>
      ) : (
        <G>
          {/* The Smart Check-In banner */}
          <Rect x="58" y="128" width="204" height="106" rx="18" fill="#F3F4EF" opacity="0.97" />
          <Rect x="66" y="136" width="188" height="36" rx="12" fill="#E7E9E3" />
          {/* The logo and name, with the line under it starting where the name starts */}
          <BannerWordmark x={73} y={139} h={22} />
          <Text
            x={73 + 22 * WORDMARK.nameStart}
            y="166"
            fill="#4C5C55"
            fontSize="8.5"
            fontFamily={fonts.body}
          >
            Where did you make it to?
          </Text>
          {/* Home */}
          <Rect x="66" y="178" width="56" height="48" rx="10" fill="#E3F1EA" />
          <Path d="M86 196l8-7 8 7v9h-5v-5h-6v5h-5z" fill="#3F6B57" />
          <Text
            x="94"
            y="218"
            fill="#293D36"
            fontSize="8.5"
            fontFamily={fonts.medium}
            textAnchor="middle"
          >
            Home
          </Text>
          {/* Gym, being tapped */}
          <Rect x="132" y="178" width="56" height="48" rx="10" fill="#E2D9F3" />
          <G fill="#7A62B3">
            <Rect x="149" y="193" width="3" height="10" rx="1.2" />
            <Rect x="153" y="191" width="3" height="14" rx="1.2" />
            <Rect x="156" y="196.5" width="8" height="3" rx="1" />
            <Rect x="164" y="191" width="3" height="14" rx="1.2" />
            <Rect x="168" y="193" width="3" height="10" rx="1.2" />
          </G>
          <Text
            x="160"
            y="218"
            fill="#293D36"
            fontSize="8.5"
            fontFamily={fonts.medium}
            textAnchor="middle"
          >
            Gym
          </Text>
          {/* Grocery */}
          <Rect x="198" y="178" width="56" height="48" rx="10" fill="#FAF1DB" />
          <Path
            d="M216 191h4l3 10h11l2.5-7H221"
            stroke="#A68642"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx="224" cy="205" r="1.6" fill="#A68642" />
          <Circle cx="233" cy="205" r="1.6" fill="#A68642" />
          <Text
            x="226"
            y="218"
            fill="#293D36"
            fontSize="8.5"
            fontFamily={fonts.medium}
            textAnchor="middle"
          >
            Grocery
          </Text>
          {/* The tap, beside the label so "Gym" stays readable */}
          <G x="12" y="2" opacity={tap ? 1 : 0}>
            <Circle
              cx="171"
              cy="214"
              r="13"
              fill="none"
              stroke="#A9A9A6"
              strokeWidth="1.6"
              opacity="0.6"
            />
            <Circle
              cx="171"
              cy="214"
              r="7.5"
              fill="none"
              stroke="#A9A9A6"
              strokeWidth="1.6"
              opacity="0.8"
            />
            <Path
              d="M168 212c0-2.5 4.5-2.5 4.5 0v11c1.8-1.6 4.4-1.4 5.2.4 1.8-1.2 4.2-.6 4.7 1.2 1.9-.8 4 .3 4 2.4v6.5c0 6-4 10.5-10 10.5h-2.2c-3.2 0-5.6-1.4-7.4-4l-6.2-9.4c-1.4-2.2 1.5-4.6 3.4-2.8l4 3.8z"
              fill="#F6D9C3"
              stroke="#B98C70"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </G>
        </G>
      )}
      <Rect x="79" y="250" width="162" height="58" fill="url(#fade)" />
      {bell && (
        <G>
          <Circle cx="70" cy="40" r="30" fill="#FFFFFF" />
          <Circle cx="70" cy="40" r="25" fill="#EAF2E7" />
          <Path
            d="M60 47h20l-3-4v-7a7 7 0 0 0-14 0v7z M66 50a4 4 0 0 0 8 0"
            stroke="#287B5A"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M56 24l2 3M52 31l3 1" stroke="#287B5A" strokeWidth="2" strokeLinecap="round" />
        </G>
      )}
      {/* Sparkle */}
      <G stroke="#EDB24E" strokeWidth="4" strokeLinecap="round">
        <Path d="M262 10l3 12" />
        <Path d="M280 22l-8 8" />
        <Path d="M286 42l-12 0" />
      </G>
    </Svg>
  );
}

/** Step 2: two people, each with their phone, kept in the loop. */
export function PeopleArt({ width = 240 }: { width?: number }) {
  const height = (width * 170) / 240;
  const face = (cx: number, cy: number, hair: string, shirt: string, long: boolean) => (
    <G>
      <Circle cx={cx} cy={cy} r="27" fill="#F8E7D8" />
      <Path d={`M${cx - 20} ${cy + 26}c4-12 36-12 40 0z`} fill={shirt} />
      <Circle cx={cx} cy={cy + 1} r="12" fill="#F3C9A8" />
      {long ? (
        <Path
          d={`M${cx - 13} ${cy + 8}c-4-14 2-24 13-24s17 10 13 24c-2-8-4-12-4-14-6 3-14 3-22 0z`}
          fill={hair}
        />
      ) : (
        <Path d={`M${cx - 12} ${cy - 2}c0-10 6-14 12-14s13 4 12 14c-6-4-18-4-24 0z`} fill={hair} />
      )}
      <Circle cx={cx - 4} cy={cy + 1} r="1.4" fill="#4A3B33" />
      <Circle cx={cx + 4} cy={cy + 1} r="1.4" fill="#4A3B33" />
      <Path
        d={`M${cx - 3} ${cy + 6}c2 2 4 2 6 0`}
        stroke="#B5655A"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={cx - 8} cy={cy + 5} r="2" fill="#EBA2A0" opacity="0.6" />
      <Circle cx={cx + 8} cy={cy + 5} r="2" fill="#EBA2A0" opacity="0.6" />
    </G>
  );
  const phone = (x: number, angle: number, child: React.ReactNode) => (
    <G rotation={angle} origin={`${x + 38}, 105`}>
      <Rect x={x} y="40" width="76" height="128" rx="14" fill="#9DBE95" />
      <Rect x={x + 5} y="45" width="66" height="118" rx="10" fill="#F7F8F1" />
      <Rect x={x + 26} y="50" width="24" height="4" rx="2" fill="#9DBE95" />
      {child}
    </G>
  );
  return (
    <Svg width={width} height={height} viewBox="0 0 240 170">
      <Circle cx="120" cy="80" r="72" fill="#FBF1E2" />
      {phone(36, -12, face(74, 104, '#7A4E2E', '#D88E86', true))}
      {phone(128, 12, face(166, 104, '#6B4428', '#9DBE95', false))}
      <Path
        d="M120 46c-6-12-24-9-22 5 2 9 13 15 22 22 9-7 20-13 22-22 2-14-16-17-22-5z"
        fill="#E07C70"
      />
      <G stroke="#EDB24E" strokeWidth="3" strokeLinecap="round">
        <Path d="M30 40l8 6" />
        <Path d="M24 58h9" />
        <Path d="M210 40l-8 6" />
        <Path d="M216 58h-9" />
      </G>
    </Svg>
  );
}

/** The hand-drawn underline under a key word in a title. */
export function Scribble({ width = 120, color = '#9DBE95' }: { width?: number; color?: string }) {
  return (
    <Svg width={width} height={(width * 14) / 120} viewBox="0 0 120 14">
      <Path
        d="M3 9c26-6 62-8 113-5M14 12c24-3 52-4 86-2"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Step 3: a default message, written once and ready in Messages for your person. */
export function MessageArt({ width = 320, to = 'Kelly' }: { width?: number; to?: string }) {
  const height = (width * 250) / 320;
  return (
    <Svg width={width} height={height} viewBox="0 0 320 250">
      <Path d="M8 250c4-58 50-84 152-84s148 26 152 84z" fill="#DCE8CF" opacity="0.9" />
      {/* Phone, cut off by the page */}
      <G rotation={-6} origin="160, 200">
        <Rect x="70" y="100" width="180" height="170" rx="30" fill="#9DABA6" />
        <Rect x="77" y="107" width="166" height="163" rx="24" fill="#F4F5F1" />
        <Rect x="128" y="107" width="64" height="16" rx="8" fill="#2E3E38" />
        <Text x="94" y="152" fill="#68766D" fontSize="12" fontFamily={fonts.body}>
          To:
        </Text>
        <Rect x="114" y="138" width={20 + to.length * 6.2} height="22" rx="11" fill="#DCE8F7" />
        <Text x="124" y="153" fill="#3B6FB6" fontSize="12" fontFamily={fonts.medium}>
          {to}
        </Text>
        <Path d="M90 168h140" stroke="#E2E5DE" strokeWidth="1" />
        <Rect x="88" y="180" width="118" height="28" rx="14" fill="#E7E9E3" />
        <Text x="98" y="197.5" fill="#293D36" fontSize="9.5" fontFamily={fonts.body}>
          I’ve arrived safely! ❤️
        </Text>
        <Circle cx="222" cy="194" r="11" fill="#3478F6" />
        <Path
          d="M222 199v-10M218 193l4-4 4 4"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>
      {/* The message, as Messages shows it */}
      <G rotation={-4} origin="170, 50">
        <Rect x="58" y="20" width="220" height="54" rx="16" fill="#FFFFFF" />
        <Path d="M232 72l10 14 4-14z" fill="#FFFFFF" />
        <Rect x="68" y="29" width="36" height="36" rx="10" fill="#4FC65A" />
        <Path
          d="M86 37c-7.5 0-12 4.2-12 9 0 2.7 1.5 5 4 6.6l-1.2 4.4 4.8-2.6c1.4.4 2.9.6 4.4.6 7.5 0 12-4.2 12-9s-4.5-9-12-9z"
          fill="#FFFFFF"
        />
        <Text x="114" y="52" fill="#293D36" fontSize="12.5" fontFamily={fonts.medium}>
          I’ve arrived safely! ❤️
        </Text>
      </G>
      <G stroke="#EDB24E" strokeWidth="4" strokeLinecap="round">
        <Path d="M262 6l3 12" />
        <Path d="M284 14l-8 9" />
        <Path d="M292 34l-12 2" />
      </G>
      <G stroke="#5E8B6C" strokeWidth="4" strokeLinecap="round">
        <Path d="M50 96l4 10" />
        <Path d="M34 104l9 8" />
        <Path d="M28 122h11" />
      </G>
    </Svg>
  );
}

/**
 * Step 1: tap a place on the Lock Screen banner, and the message to your person is ready in
 * Messages. Two phones, joined by an arrow.
 */
export function CheckInFlowArt({ width = 340, to = 'Andy' }: { width?: number; to?: string }) {
  const height = (width * 270) / 340;
  return (
    <Svg width={width} height={height} viewBox="0 0 340 270">
      <Defs>
        <LinearGradient id="flowSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#A9BFCF" />
          <Stop offset="0.6" stopColor="#E9D9A8" />
          <Stop offset="1" stopColor="#F6E3AE" />
        </LinearGradient>
      </Defs>
      {/* Backdrop */}
      <Path d="M6 92c0-9 8-15 17-13 3-10 18-12 24-3 8-1 14 6 12 16H6z" fill="#DCE5EC" />
      <Path d="M246 52c2-8 10-12 17-9 5-8 18-6 21 3 8 0 12 7 10 13h-48z" fill="#DCE5EC" />
      <Path d="M300 122c1-6 8-9 13-7 4-5 13-4 15 2 6 0 9 5 8 9h-36z" fill="#DCE5EC" />
      <Path d="M0 262c10-60 50-84 84-80-12 30-10 58-4 80z" fill="#C2D6A7" />
      <Path d="M340 262c-10-60-50-84-84-80 12 30 10 58 4 80z" fill="#C2D6A7" />
      <Ellipse cx="170" cy="262" rx="170" ry="8" fill="#E7EEE0" />

      {/* Lock Screen phone */}
      <Rect x="40" y="18" width="134" height="236" rx="28" fill="#9DABA6" />
      <Rect x="46" y="24" width="122" height="224" rx="23" fill="url(#flowSky)" />
      <Rect x="86" y="24" width="42" height="13" rx="6.5" fill="#2E3E38" />
      <Text
        x="107"
        y="76"
        fill="#FFFFFF"
        fontSize="32"
        fontFamily={fonts.bold}
        fontWeight="700"
        textAnchor="middle"
      >
        9:41
      </Text>
      <Text
        x="107"
        y="92"
        fill="#FFFFFF"
        fontSize="9"
        fontFamily={fonts.medium}
        textAnchor="middle"
      >
        Mon, Nov 17
      </Text>
      {/* The check-in banner, a little wider than the phone so it reads */}
      <Rect x="20" y="114" width="172" height="96" rx="15" fill="#F5F6F1" />
      <Rect x="27" y="121" width="158" height="32" rx="10" fill="#E8EAE4" />
      {/* The logo and name, with the line under it starting where the name starts */}
      <BannerWordmark x={33} y={123} h={20} />
      <Text
        x={33 + 20 * WORDMARK.nameStart}
        y="148"
        fill="#4C5C55"
        fontSize="7.5"
        fontFamily={fonts.body}
      >
        Check in with {to}
      </Text>
      <Rect x="27" y="159" width="48" height="44" rx="9" fill="#E3F1EA" />
      <Path d="M44 175l7-6 7 6v8h-4.5v-4.5h-5v4.5H44z" fill="#3F6B57" />
      <Text
        x="51"
        y="196"
        fill="#293D36"
        fontSize="7.5"
        fontFamily={fonts.medium}
        textAnchor="middle"
      >
        Home
      </Text>
      <Rect x="82" y="159" width="48" height="44" rx="9" fill="#E2D9F3" />
      <G fill="#7A62B3">
        <Rect x="96" y="172" width="2.6" height="9" rx="1" />
        <Rect x="99.6" y="170" width="2.6" height="13" rx="1" />
        <Rect x="102.4" y="175" width="7" height="2.6" rx="1" />
        <Rect x="109.6" y="170" width="2.6" height="13" rx="1" />
        <Rect x="113.2" y="172" width="2.6" height="9" rx="1" />
      </G>
      <Text
        x="106"
        y="196"
        fill="#293D36"
        fontSize="7.5"
        fontFamily={fonts.medium}
        textAnchor="middle"
      >
        Gym
      </Text>
      <Rect x="137" y="159" width="48" height="44" rx="9" fill="#FAF1DB" />
      <Path
        d="M152 171h3.4l2.6 8.5h9.2l2.2-6h-12.6"
        stroke="#A68642"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="159" cy="183" r="1.4" fill="#A68642" />
      <Circle cx="166.5" cy="183" r="1.4" fill="#A68642" />
      <Text
        x="161"
        y="196"
        fill="#293D36"
        fontSize="7.5"
        fontFamily={fonts.medium}
        textAnchor="middle"
      >
        Grocery
      </Text>
      {/* The tap on Gym, beside its label */}
      <G x="10" y="1">
        <Circle
          cx="116"
          cy="192"
          r="11"
          fill="none"
          stroke="#B0B0AC"
          strokeWidth="1.4"
          opacity="0.6"
        />
        <Circle
          cx="116"
          cy="192"
          r="6"
          fill="none"
          stroke="#B0B0AC"
          strokeWidth="1.4"
          opacity="0.85"
        />
        <Path
          d="M113.5 190.5c0-2.1 3.8-2.1 3.8 0v9.3c1.5-1.4 3.7-1.2 4.4.3 1.5-1 3.5-.5 4 1 1.6-.7 3.4.2 3.4 2v5.5c0 5-3.4 8.9-8.5 8.9h-1.9c-2.7 0-4.7-1.2-6.2-3.4l-5.2-8c-1.2-1.9 1.3-3.9 2.9-2.4l3.4 3.2z"
          fill="#F6D9C3"
          stroke="#B98C70"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </G>
      {/* Messages phone, with the check-in ready for your person */}
      <G rotation={5} origin="262, 160">
        <Rect x="196" y="76" width="132" height="180" rx="24" fill="#9DABA6" />
        <Rect x="202" y="82" width="120" height="168" rx="19" fill="#FBFBF9" />
        <Rect x="244" y="82" width="36" height="11" rx="5.5" fill="#2E3E38" />
        <Rect x="202" y="82" width="120" height="44" rx="19" fill="#F1F2EE" />
        <Path
          d="M214 104l-4.5-4.5 4.5-4.5"
          stroke="#68766D"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx="262" cy="102" r="9" fill="#9DBE95" />
        <Circle cx="262" cy="99.5" r="3" fill="#FFFFFF" />
        <Path d="M256.5 107.5c1.4-3.2 9.6-3.2 11 0" fill="#FFFFFF" />
        <Text
          x="262"
          y="120"
          fill="#293D36"
          fontSize="7.5"
          fontFamily={fonts.medium}
          textAnchor="middle"
        >
          {to}
        </Text>
        <Text
          x="262"
          y="140"
          fill="#8A968E"
          fontSize="6.5"
          fontFamily={fonts.body}
          textAnchor="middle"
        >
          Today 9:41 AM
        </Text>
        <Rect x="212" y="148" width="86" height="40" rx="14" fill="#E7E9E3" />
        <Text x="221" y="164" fill="#293D36" fontSize="9" fontFamily={fonts.bold} fontWeight="700">
          I made it to the
        </Text>
        <Text x="221" y="178" fill="#293D36" fontSize="9" fontFamily={fonts.bold} fontWeight="700">
          gym! 💪
        </Text>
        <Circle cx="217" cy="232" r="7" fill="#EEF0EB" />
        <Path
          d="M217 228.5v7M213.5 232h7"
          stroke="#68766D"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <Rect
          x="228"
          y="225"
          width="84"
          height="14"
          rx="7"
          fill="none"
          stroke="#DDE1DA"
          strokeWidth="1"
        />
        <Text x="235" y="234.5" fill="#A2ACA4" fontSize="6.5" fontFamily={fonts.body}>
          Text Message
        </Text>
      </G>

      {/* A smooth gold arrow with a slightly darker gold edge, from the banner up to the message */}
      {(['#E0A93F', '#F4CC74'] as const).map((color) => {
        const outline = color === '#E0A93F';
        const strokeWidth = outline ? 6.6 : 4.5;
        return (
          <G key={color}>
            <Path
              d="M150 222C176 242 206 230 212 194"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M204.3 201.1L212 194L217.0 203.2"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        );
      })}
      {/* Sparkle */}
      <G stroke="#EDB24E" strokeWidth="3.5" strokeLinecap="round">
        <Path d="M184 6l2.5 10" />
        <Path d="M202 16l-7 7" />
        <Path d="M208 33h-10" />
      </G>
    </Svg>
  );
}
