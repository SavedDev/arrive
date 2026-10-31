export type Accent = 'peach' | 'mint' | 'sky' | 'lavender' | 'cream' | 'rose';
// Every icon a check-in can use. The first ten are the originals, so saved check-ins keep working.
// Components live in src/design/icons.tsx; this list stays plain so tests can run without them.
export const iconNames = [
  'home',
  'gym',
  'grocery',
  'coffee',
  'work',
  'pin',
  'heart',
  'plane',
  'book',
  'leaf',
  'school',
  'campus',
  'office',
  'hospital',
  'church',
  'hotel',
  'store',
  'library',
  'friends',
  'bed',
  'restaurant',
  'pizza',
  'bakery',
  'sandwich',
  'dessert',
  'cake',
  'bar',
  'wine',
  'shopping',
  'cart',
  'gift',
  'salon',
  'gas',
  'pharmacy',
  'laundry',
  'bike',
  'walk',
  'hike',
  'park',
  'beach',
  'sports',
  'trophy',
  'camping',
  'car',
  'train',
  'bus',
  'boat',
  'luggage',
  'explore',
  'landmark',
  'baby',
  'pet',
  'dog',
  'cat',
  'doctor',
  'family',
  'smile',
  'music',
  'movie',
  'games',
  'art',
  'camera',
  'tickets',
  'sun',
  'moon',
  'star',
  'flower',
  'garden',
  'rain',
] as const;
export type IconName = (typeof iconNames)[number];
export type Preset = {
  id: string;
  name: string;
  icon: IconName;
  color: Accent;
  message: string;
  recipientId: string;
  favorite: boolean;
  order: number;
};
export type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  presetId: string;
  recipientId: string;
  enabled: boolean;
  departureReminder: boolean;
};
export type Preferences = {
  defaultRecipient: string;
  defaultPreset: string;
  defaultMessage: string;
  confirmations: boolean;
  /** Smart Check-In's "Show after": minutes between a trigger and the Live Activity. */
  reminderMinutes: 1 | 5 | 10;
  /** Smart Check-In on or off. Manual check-ins always work either way. */
  smartCheckIn: boolean;
  /** Days Smart Check-In may start: 0 = Sunday … 6 = Saturday. */
  activeDays: number[];
  /** Trigger: leaving a remembered place, or the spot you last checked in from. */
  departureReminders: boolean;
  /**
   * The words "Coming" prepares, offered after you leave where you last checked in. It's a
   * heading-home status, not an arrival, so it's kept apart from the Home check-in.
   */
  comingMessage: string;
  /** Trigger: going separate ways from the paired person. Location leaves the phone only then. */
  smartReminders: boolean;
  /** Show the active reminder on the Lock Screen (a Live Activity) instead of only a notification. */
  lockScreenReminder: boolean;
  /** How the Lock Screen reminder looks: a light card, or dark glass. */
  lockScreenStyle: 'soft' | 'glass';
  /** Check-in order shared by the Home preview and the Lock Screen Live Activity. */
  activityPresetOrder: string[];
  /** Show check-in names with the shortcut icons in the Lock Screen banner. */
  activityButtonLabels: boolean;
  pausedUntil: number;
  onboardingDone: boolean;
  theme: 'system' | 'light' | 'dark';
};
// photo is a data URI (iOS) or content URI (Android) copied from the chosen contact.
export type Person = {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  /**
   * Also uses Arrive and is paired with this phone for Smart Reminders. At most one person.
   * Everyone else is an ordinary recipient: check-ins, shortcuts and place reminders all work
   * the same without Arrive on their phone.
   */
  smartPaired?: boolean;
};
export type ComposerResult = 'sent' | 'cancelled' | 'unknown';
export type HistoryEntry = {
  id: string;
  recipientName: string;
  presetName: string;
  icon: IconName;
  color: Accent;
  preparedText: string;
  timestamp: string;
  status: Exclude<ComposerResult, 'cancelled'>;
};
export type Visit = {
  inside: boolean;
  lastAction: number;
  exitedAt: number;
  visitId: string;
  reminderId?: string;
};
export const initialPreferences: Preferences = {
  defaultRecipient: '',
  defaultPreset: '',
  defaultMessage: "I've arrived safely! ❤️",
  confirmations: true,
  reminderMinutes: 5,
  smartCheckIn: true,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  departureReminders: true,
  comingMessage: 'Coming home now ❤️',
  smartReminders: false,
  lockScreenReminder: true,
  lockScreenStyle: 'soft',
  activityPresetOrder: [],
  activityButtonLabels: true,
  pausedUntil: 0,
  onboardingDone: false,
  theme: 'system',
};
export const initialPresets: Preset[] = [
  {
    id: 'elsewhere',
    name: 'Other',
    icon: 'pin',
    color: 'rose',
    message: "I've arrived safely! ❤️",
    favorite: true,
  },
  {
    id: 'work',
    name: 'Work',
    icon: 'work',
    color: 'lavender',
    message: "I've arrived at work! Have a lovely day ❤️",
    favorite: true,
  },
  {
    id: 'grocery',
    name: 'Grocery',
    icon: 'grocery',
    color: 'sky',
    message: 'Made it to the store! Need anything? 🛒',
    favorite: true,
  },
  {
    id: 'home',
    name: 'Home',
    icon: 'home',
    color: 'peach',
    message: "I'm home safe and sound! ❤️",
  },
  { id: 'gym', name: 'Gym', icon: 'gym', color: 'mint', message: "I've arrived at the gym! 💪" },
  {
    id: 'coffee',
    name: 'Coffee',
    icon: 'coffee',
    color: 'cream',
    message: 'Made it to the coffee shop! ☕',
  },
].map((p, order) => ({
  ...p,
  color: p.color as Accent,
  icon: p.icon as IconName,
  favorite: p.favorite ?? false,
  recipientId: '',
  order,
}));
