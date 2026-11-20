# Arrive

The fastest way to check in.

Arrive is a local-first Expo SDK 57 / React Native app. Save your person’s name and phone number, choose a pastel shortcut, and approve the prepared message in your phone’s native composer. The recipient gets a normal message and does not need Arrive. There is no login, cloud backup, or in-app inbox. An optional Cloudflare service supports paired Smart Reminders without receiving contacts, messages, presets, or history.

## Run

Use Node 22.13+ (22.x) or 24.3+ and npm.

```sh
npm ci
npm run web
# Native development build:
npx eas-cli@latest build --profile development --platform ios
npm start
```

No environment file is needed for local setup, editing, history, or native messaging. Optional publisher/build variables are described in [.env.example](.env.example) and [SETUP.md](docs/SETUP.md). Native SMS, contact picking, background location, notifications, purchases, and the iOS widget require an appropriate native device/build. Rebuild after changing native modules or plugins. Web is a preview with localStorage; native storage is SQLite.

## Implemented

- Home, Locations, History, and Settings; five-step optional onboarding; warm pastel shortcuts, editable messages, favorites, ordering, dark mode, and iPhone widget instructions.
- Local people with validated international phone numbers, edit/remove/default selection, system contact picking, QR creation with explicit sharing consent, camera scanning with strict versioned payload validation and review before saving.
- Generic invitation sharing through the OS share sheet. No phone number appears in a URL. Without a published install URL the invite explicitly opens only an already-installed app. It does not pair people. Contact details can be shared separately as text through the system share sheet, by showing the QR, or through the phone’s Contacts app.
- `expo-sms` native composer with normalized phone and editable prepared text, availability checks and duplicate-open suppression. Arrive cannot send silently. `sent` means the composer reported a send/schedule action, not delivery or confirmation of the original text/recipient. Cancellation adds no history or success. Unknown results are labeled unverified; Android always returns unknown.
- iOS Live Activity Send uses a native App Group request and direct Messages presentation before React Native startup, with a matching cream launch surface and durable result import. Selection, Back and dismiss stay in the background. This requires a new native build; physical-iPhone verification is still outstanding. See [LIVE_ACTIVITY.md](docs/LIVE_ACTIVITY.md).
- Local history containing only the prepared recipient name, preset name/icon/color, prepared message, timestamp, outcome, and local ID. It expires at 72 elapsed hours in UTC. Cleanup runs on launch, foreground, History focus, each new entry, and every minute while open. Data cannot be deleted while the OS is not running the app; overdue records are removed at next execution. Home uses only unexpired, confirmed send actions.
- SQLite local key/value repository with transactional history/preferences updates and an idempotent upgrade migration. Earlier prototype presets and places are preserved; obsolete account-linked references and cached server data are discarded. No old message is reclassified as a native send.
- Optional native geofencing for up to 20 places, arrival reminder notifications, persistent visit cooldowns, overlapping-place and poor-accuracy fallback. Notifications open the relevant shortcut/person; uncertain arrivals require choosing a destination. No background task invokes the composer or sends a message.
- Departure reminders after leaving an enabled place (intended for saved Home), selectable 1/5/10-minute delay, pause controls, cancellation on return, confirmed send, disabling/deleting that reminder, changing delay, or clearing data.
- Opt-in paired Smart Reminders for iPhone, backed by a Cloudflare Worker, D1, Queue, and APNs. Pairing uses an anonymous one-use 10-minute QR token. The server retains one current location per device and requires sustained, accurate separation after a known-together state. Reunion cancels a queued reminder. iOS uses push-to-start Live Activities when available and falls back to a remote notification.
- Optional sender confirmation notifications only for a confirmed native send action, with a Settings toggle. Notifications are local and need no remote push token.
- Anonymous RevenueCat purchase identity with real store offerings, localized pricing, restore and management links. No account is needed, no entitlement is fabricated, and core check-ins remain available without purchase.
- Local history clearing and a separate explicit confirmation for clearing all Arrive data.

## Data limits

People, shortcuts, places, preferences, and recent history belong to this installation. Uninstalling, clearing data, or losing a device can lose them. Arrive provides no cloud backup or recovery. Smart Reminders upload only the latest location fix and anonymous delivery state while enabled; see [the Worker documentation](backend/README.md). Purchase restoration concerns only the store subscription, not app data or cross-platform identity. The phone’s own backups and messaging service operate separately. QR sharing exposes the chosen name and number to anyone receiving it; QR scanning does not verify identity.

Arrive never reads incoming SMS, replies, delivery/read receipts, or the iMessage database. Messaging service/carrier terms and charges apply. A cancelled composer is not a successful check-in. Check your messaging app before repeating an unverified send.

## Validate

```sh
npm run typecheck
npm run lint
npm test
npx expo-doctor
npm run export:web
# Start the preview in one terminal, then run browser tests:
npx expo start --web --port 8095
ARRIVE_TEST_URL=http://127.0.0.1:8095 npm run test:ui
# Generate native configuration in an isolated temporary directory:
node scripts/verify-native-config.cjs
```

See [VALIDATION.md](docs/VALIDATION.md) for evidence and [RELEASE.md](docs/RELEASE.md) for physical-device release checks. Browser tests and injected composer tests do not prove iPhone messaging, native SQLite persistence, geofences, notifications, widget behavior, signing, or purchases on hardware. This repository is not a signed or store-submitted release.

## Structure

```text
src/app/         Expo Router screens
src/components/  Shared UI, maps, runtime notification routing
src/design/      Colors and fonts
src/lib/         Local storage, migration, people/QR, history, composer, native services
src/state/       Local app provider
src/widgets/     iOS Check In widget
patches/         Shared native widget/App Intent handoff
backend/         Cloudflare Worker, D1 migration, Queue consumer, and state-machine tests
 tests/          Domain and browser tests (test data stays in test contexts)
```

## API references

[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [SMS outcomes](https://docs.expo.dev/versions/v57.0.0/sdk/sms/), [Contacts legacy picker](https://docs.expo.dev/versions/v57.0.0/sdk/contacts-legacy/), [Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [Widgets](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/), [RevenueCat anonymous identity](https://www.revenuecat.com/docs/customers/identifying-customers).
