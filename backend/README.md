# Arrive Smart Reminders worker

The Worker stores anonymous device credentials, pairing state, one current location per paired
device, separation state, and reminder delivery state in D1. It does not store contacts, phone
numbers, messages, presets, check-in history, or a trail of locations. Each accepted location
replaces the previous row for that device. Completed/cancelled delivery records are removed after
24 hours on the pair's next location event. Disabling clears that device's current location and
push tokens; disconnecting deletes the pair, both current locations, and pair reminder state.

## Deploy

1. Create a D1 database and Queue, then replace the placeholder IDs in `wrangler.jsonc`.
2. Apply `migrations/0001_initial.sql` with `npm run db:remote`.
3. Add APNs provider secrets with `npx wrangler secret put APNS_TEAM_ID`, `APNS_KEY_ID`, and
   `APNS_PRIVATE_KEY`. The key must be the complete PKCS#8 `.p8` value.
4. Set `APNS_USE_SANDBOX` for development builds and deploy with `npm run deploy`.
5. Put the resulting HTTPS Worker URL in the app's `EXPO_PUBLIC_SMART_REMINDERS_URL` build
   variable and create a new native development build.

The Queue is event-driven. A confirmed separation creates one delayed message. A reunion marks
that session cancelled, so a delayed message that later wakes up is discarded. APNs delivery uses
the per-device push-to-start token where available and falls back to a normal notification.

## Verification

`npm test` covers poor/stale fixes, a single GPS spike, sustained separation, and reunion. Use two
development-build devices for end-to-end pairing, background location, APNs sandbox delivery, and
push-to-start testing; simulators cannot validate the full background/push lifecycle. In a private
development environment, set `DEVELOPMENT_MODE` to `true` to expose the authenticated simulation
controls in the app. Keep it `false` in production.
