# Setup

## Local app

Install with `npm ci` on Node 22.13+ (22.x) or 24.3+. Core features require no server credentials or login. Use `npm run web` for a preview and a development build for device features. Data is stored in SQLite on native and localStorage on web. Native folders are generated through Expo CNG; do not edit them by hand.

## Native build

1. Choose final bundle/package IDs in app.json. Set up your EAS project and put its public project ID in `EXPO_PUBLIC_EAS_PROJECT_ID` for builds.
2. Run `npx eas-cli@latest build --profile development --platform ios` (or android). Install the build and run `npm start`.
3. Android map rendering needs `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`, restricted to your package/signing certificate. Coordinates/manual setup remain available without it. iOS uses Apple Maps.
4. Camera, Contacts, notifications, background location, SQLite, and widget plugins are configured in app.json. Rebuild after changing these. The app requests permissions only in the corresponding user flow.
5. On iOS, the supported `expo-contacts/legacy` system picker directly returns the chosen contact without full address-book permission. SDK 57’s newer class picker returns an ID whose subsequent lookup needs access, so this implementation deliberately uses the documented legacy entry point. On Android its lookup requires read access; the app asks only when choosing a contact. WRITE_CONTACTS and all SMS-reading/silent-send permissions are explicitly blocked. Manual entry works without these permissions.

## Messaging and links

`expo-sms` opens the native message composer. A physical, messaging-capable device is required; iOS simulators and web are unavailable. Android outcomes are always unknown. Sending/scheduling on iOS can return sent, cancelled, or unknown. The user can edit the recipient and body, so history displays prepared content only.

Supported links include `arrive://check-in`, `arrive://check-in?preset=gym`, and `arrive://people`. Only local shortcut/person IDs are used internally for notification navigation; there are no phone numbers in links. Notification taps are deduplicated and open a screen, never the composer directly.

Optional `EXPO_PUBLIC_INSTALL_URL` must be a publisher-controlled generic HTTPS installation page with no query, fragment, or embedded credentials. Without it, invitations explicitly say the custom-scheme link requires an installed app. It is not an install link, deferred deep link, remote invite token, or automatic pairing. Share contact information separately through Share My QR or the phone’s Contacts app. No web domain or app-store listing has been created by this implementation.

## Widget

The iOS `ArriveCheckIn` widget supports accessoryCircular, accessoryRectangular, and systemSmall. Its URL opens Home, where one tap sends a check-in. Add it manually from Lock Screen customization or Home Screen widgets. It requires a signed native build with the generated extension/app-group configuration. Android has no Arrive widget in this implementation.

## Local notifications and places

Local notifications do not need an EAS push project, APNs/FCM registration, or a server. Arrival monitoring asks for foreground location, notifications, then background location when enabling a place. Use an isolated place and a fresh precise fix for a specific preset; missing/stale/inaccurate fixes and overlapping places open a generic destination choice. Manual check-ins work with all location permissions denied. Operating systems may delay geofences or stop execution after force quit; no timing guarantees are made.

## Optional billing

Create the planned $1.99 monthly product in each app store and configure RevenueCat’s current monthly offering and `arrive_plus` entitlement (or the environment override). Set platform-specific public SDK keys. The SDK generates an anonymous ID; no login or custom app user ID is supplied. Set published privacy/terms URLs before enabling purchases. The UI uses the real localized store price, never a fabricated price or entitlement. Test restore behavior under the chosen RevenueCat restore/transfer policy and your store account. This does not synchronize or recover Arrive’s local data, and does not provide cross-platform subscription identity.

## Publisher configuration

Provide a working support email and published privacy policy before release. All EXPO_PUBLIC variables are visible in the app bundle; never put secrets in them. No credentials are needed for local contacts, presets, history or message composition. `check:release` is a publisher-config check, not a condition for launching or using the app.
