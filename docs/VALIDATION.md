# Validation

The local-first refactor replaces the earlier backend architecture. Current checks cover pure phone/QR/history/composer policy, browser persistence and UI, TypeScript, lint, and bundling. The browser uses localStorage; native uses SQLite. Composer tests inject a fake native boundary only in the test process, not a production simulation mode.

Validation results are recorded after checks complete. Physical iPhone/Android messaging, native SQLite restart behavior, camera scanning, contact permissions, background geofences, notifications, widgets, and store billing still require the release checks in RELEASE.md. No claim of actual SMS delivery or native hardware testing is made.

## Native Live Activity composer (removed) — 2026-09-24

An experimental native composer handoff (`modules/arrive-composer`, `plugins/with-native-composer.cjs`, an expanded expo-widgets patch, and a Lock Screen confirm step) was removed at the user's request. The Live Activity is back to place links that open Messages directly, with ✕ as the only background button. See [LIVE_ACTIVITY.md](LIVE_ACTIVITY.md). The removed patch is not in the repository.
