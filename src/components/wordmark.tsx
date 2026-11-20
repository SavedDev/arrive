import { Image } from 'expo-image';

// Written by scripts/create-brand.cjs alongside the images, so they always agree.
import geometry from '../../assets/brand/wordmark-geometry.json';

const light = require('../../assets/images/arrive-wordmark.png');
const dark = require('../../assets/images/arrive-wordmark-dark.png');

/**
 * Where things sit in the logo-and-name image (assets/brand/arrive-wordmark.png), as fractions
 * of its height: the name starts `nameStart` in from the left, and its baseline is `baseline`
 * down. Lines under the name line up with it using these. The Lock Screen banner
 * (src/widgets/ReminderActivity.tsx) can't import, so it repeats them for its 30pt header:
 * update it too whenever the logo changes.
 */
export const WORDMARK: { aspect: number; nameStart: number; baseline: number } = geometry;

/** Arrive's logo and name together, exactly as designed. Never redrawn or rebuilt from parts. */
export function Wordmark({ height, onDark = false }: { height: number; onDark?: boolean }) {
  return (
    <Image
      source={onDark ? dark : light}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="Arrive"
      style={{ height, width: height * WORDMARK.aspect }}
    />
  );
}
