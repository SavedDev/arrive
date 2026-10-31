import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
export function Landscape({ width = 170, height = 150 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 185">
      <G stroke="#DFB858" strokeWidth="3" strokeLinecap="round">
        <Path d="M136 23v-8M136 88v8M102 54h-8M174 54h8M111 29l-6-6M161 29l6-6M110 79l-6 6M161 79l6 6" />
      </G>
      <Circle cx="136" cy="54" r="27" fill="#F3D77F" />
      <Path d="M125 53v3m20-3v3" stroke="#6C6843" strokeWidth="3" strokeLinecap="round" />
      <Path
        d="M130 62q6 7 12 0"
        stroke="#6C6843"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx="120" cy="61" rx="4" ry="2.5" fill="#ECAE77" />
      <Ellipse cx="151" cy="61" rx="4" ry="2.5" fill="#ECAE77" />
      <Path d="M20 141C58 70 120 100 152 125c33-40 55-20 68-6v66H0z" fill="#C2D6A7" />
      <Path d="M0 148c51-39 95-31 139 11 38-17 64-12 81 0v26H0z" fill="#94B58B" />
      <Path d="M124 185c-15-20-5-32 16-48-34 16-58 29-39 48" fill="#F2E9C8" />
      <G transform="translate(30 75)">
        <Rect x="5" y="23" width="47" height="41" rx="3" fill="#FFF6E8" />
        <Path d="M0 27L28 3 58 27" fill="#C79170" />
        <Rect x="24" y="41" width="12" height="23" rx="6" fill="#90A994" />
        <Rect x="12" y="35" width="9" height="11" rx="2" fill="#D7E5D5" />
        <Path d="M42 14v-9h8v16" fill="#C79170" />
      </G>
      <Path
        d="M186 139v-32m0 16c-18-1-16-14-16-14 15 0 16 14 16 14m0-6c15-2 14-15 14-15-12 2-14 15-14 15"
        stroke="#557C60"
        strokeWidth="2"
        fill="#73996C"
      />
      <Path d="M87 51c-9-11-20 2 0 14 20-12 9-25 0-14" fill="#D5A18E" />
      <Path d="M21 47c5-8 11-6 14-1 8-4 13 0 13 5H15c0-3 2-5 6-4" fill="#FFFFFF" opacity=".8" />
    </Svg>
  );
}
export function HappySun({ size = 180 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="89" fill="#FBF4DB" />
      <G stroke="#E4BA51" strokeWidth="4" strokeLinecap="round">
        <Path d="M100 29v-12m0 166v-12M29 100H17m166 0h-12M50 50l-9-9m118 118l-9-9M50 150l-9 9M150 50l9-9" />
      </G>
      <Circle cx="100" cy="100" r="52" fill="#F2D071" />
      <Path d="M82 94v7m35-7v7" stroke="#6F6745" strokeWidth="5" strokeLinecap="round" />
      <Path
        d="M87 114q13 15 26 0"
        stroke="#6F6745"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx="73" cy="111" rx="8" ry="5" fill="#E9AD7A" />
      <Ellipse cx="126" cy="111" rx="8" ry="5" fill="#E9AD7A" />
      <Path d="M157 135c-17-20-36 3 0 27 36-24 17-47 0-27" fill="#C9877D" />
    </Svg>
  );
}
/** Arrive Plus banner: a smiling sun rising over hills, with floating hearts. */
export function PlusArt({ width = 130, height = 110 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 130 110">
      <Circle cx="78" cy="48" r="30" fill="#FBF4DB" />
      <G stroke="#E4BA51" strokeWidth="2.5" strokeLinecap="round">
        <Path d="M78 8v-5M78 93v-3M38 48h-5M123 48h-5M50 20l-4-4M110 80l-3-3M106 20l4-4" />
      </G>
      <Circle cx="78" cy="48" r="20" fill="#F2D071" />
      <Path d="M71 45v3m14-3v3" stroke="#6F6745" strokeWidth="2.5" strokeLinecap="round" />
      <Path
        d="M73 54q5 6 10 0"
        stroke="#6F6745"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx="66" cy="53" rx="3.5" ry="2" fill="#E9AD7A" />
      <Ellipse cx="90" cy="53" rx="3.5" ry="2" fill="#E9AD7A" />
      <Path d="M0 92c26-22 52-20 74-4 20-12 40-12 56-2v24H0z" fill="#C2D6A7" />
      <Path d="M0 100c30-12 60-10 86 2 16-6 30-6 44 0v8H0z" fill="#94B58B" />
      <Path d="M28 30c-5-6-12 1 0 9 12-8 5-15 0-9" fill="#D5A18E" />
      <Path d="M116 70c-4-5-9 1 0 7 9-6 4-12 0-7" fill="#C9877D" />
      <Path d="M20 58l1.5 3.5L25 63l-3.5 1.5L20 68l-1.5-3.5L15 63l3.5-1.5z" fill="#FFFFFF" />
    </Svg>
  );
}
/** Widget banner: a little phone Lock Screen showing the round Check In widget. */
export function LockScreenArt({ width = 120, height = 130 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 130">
      <Path d="M8 118c20-16 44-16 62-4 16-9 34-9 50 0v16H8z" fill="#C2D6A7" />
      <Rect x="30" y="8" width="62" height="118" rx="14" fill="#293D36" />
      <Rect x="34" y="12" width="54" height="110" rx="11" fill="#EAF2E7" />
      <Rect x="51" y="16" width="20" height="5" rx="2.5" fill="#293D36" />
      <Rect x="46" y="32" width="30" height="11" rx="3" fill="#287B5A" opacity=".85" />
      <Rect x="50" y="47" width="22" height="3" rx="1.5" fill="#94B58B" />
      <Circle cx="61" cy="72" r="13" fill="#FAF0E2" />
      <Path
        d="M53 78c16-3 18-7 4-11 0-4 6-6 12-3"
        stroke="#98A48F"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="53" cy="78" r="2.3" fill="#78866F" />
      <Circle cx="69" cy="64" r="2.3" fill="#D48363" />
      <Rect x="44" y="94" width="34" height="4" rx="2" fill="#C2D6A7" />
      <Rect x="50" y="102" width="22" height="4" rx="2" fill="#C2D6A7" />
      <Path d="M101 30l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="#F2D071" />
      <Path d="M17 52c-4-5-10 1 0 8 10-7 4-13 0-8" fill="#D5A18E" />
    </Svg>
  );
}
