import { Image } from 'expo-image';

// The logo on its own, where there's no name beside it. It always stands alone: never on a tile
// or a white background. With the name, use Wordmark.
const mark = require('../../assets/images/arrive-splash.png');

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={mark}
      contentFit="contain"
      style={{ width: size, height: size }}
      accessibilityIgnoresInvertColors
    />
  );
}
