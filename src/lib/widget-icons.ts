import type { IconName } from './types';

/** Native asset names generated from the same Lucide glyphs used by the app. */
export const widgetIconAsset = (icon: IconName) =>
  `ArrivePreset${icon.charAt(0).toUpperCase()}${icon.slice(1)}`;
