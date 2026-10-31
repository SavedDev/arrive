import { Image } from 'expo-image';

const icon = require('../../assets/images/arrive-icon.png');
const mark = require('../../assets/images/arrive-splash.png');
const monochrome = require('../../assets/images/arrive-monochrome.png');

export function BrandMark({
  size = 32,
  variant = 'icon',
  color = '#FFFFFF',
}: {
  size?: number;
  variant?: 'icon' | 'mark' | 'monochrome';
  color?: string;
}) {
  return (
    <Image
      source={variant === 'icon' ? icon : variant === 'mark' ? mark : monochrome}
      contentFit="contain"
      tintColor={variant === 'monochrome' ? color : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: variant === 'icon' ? Math.round(size * 0.24) : 0,
      }}
      accessibilityIgnoresInvertColors
    />
  );
}
