# Lock Screen reminder (Live Activity)

Arrive shows a "remember to check in" reminder on the iPhone Lock Screen and in the Dynamic Island as an iOS Live Activity. It stays there until the person checks in, dismisses it, or it times out. Everything is local: no server, no push notifications, no automatic sending.

## How the pieces fit

| Surface                                                     | Role                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Static Lock Screen widget (`src/widgets/CheckInWidget.tsx`) | Always there. Opens Home.                                                                                   |
| Live Activity (`src/widgets/ReminderActivity.tsx`)          | Appears only while a reminder is active.                                                                    |
| Local notification                                          | One-time nudge when a departure reminder comes due. Also the fallback when Live Activities are unavailable. |
| Home (`src/app/index.tsx`)                                  | Tap a check-in to send it, hold to edit. `check-in` links forward here.                                     |
| Messages composer                                           | The person reviews and taps Send. Arrive never sends on its own.                                            |

## Smart Check-In

One reminder, the Live Activity, fed by two triggers. Settings › Smart Check-In has the switch, the person, active days, "Show after" (1, 5, or 10 minutes), and the triggers:

| Trigger                    | Detected                                                                         | Started by                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaving a remembered place | Geofence exit after a real stay, on this phone. The phone checks the active day. | The Smart Check-In service, by push, after the delay (`POST /v1/checkin/departure`). The phone sends only an opaque event id and the delay. |
| Going separate ways        | The service, from both paired phones' latest locations.                          | The same service, by push, after the delay. Each phone's own active days apply.                                                             |

Both go through one delivery step in `backend/src/reminders.ts`. It checks the phone's active day in its own time zone, and skips a start within 15 minutes of the last one, so two triggers for one outing make one Live Activity. On the phone, `reconcileReminder()` adopts a pushed Live Activity as the local reminder, and ends any extra.

iOS won't let an app start a Live Activity from the background, which is why departures go through the service. If that's impossible (no service configured, no network, no push-to-start token), the phone schedules one local notification instead. The service also falls back to one alert if the Live Activity push is rejected. Never both. Coming back before the delay, or checking in first, cancels it (`DELETE /v1/checkin/departure`). Arriving at a place no longer sends a notification. Check-ins from Home ignore the schedule.

### Temporary Check-In Anchor and "Coming"

After an arrival check-in is confirmed sent, `anchorHere()` (`src/lib/location.ts`) takes one high-accuracy fix. With a fix of 65 m or better, and Always location, the spot becomes the one temporary anchor (`checkin-anchor`), replacing any earlier one. Its radius is three times the fix error plus 50 m, kept between 150 and 400 m (`src/lib/anchor.ts`). No anchor is made inside an enabled remembered place, which already watches for leaving. It's watched as the `arrive-anchor` region beside the remembered places, exit only, and only fits alongside 19 places.

Leaving it is one more trigger for the same Smart Check-In, with the same switch ("Leaving places"), days, delay and 15-minute duplicate check. Exits in the first 3 minutes (the fix settling), repeated exits, and anchors older than 18 hours are ignored. The departure request carries `context: 'coming'`, so both the pushed banner and the app's redraw put **↩ Coming**, then a divider, then the check-ins (one fewer, favourites first). No other trigger shows Coming.

Coming prepares `prefs.comingMessage` ("Coming home now ❤️" by default, editable in Settings › Smart Check-In) for the default person, through the same Messages flow. Sending it records History as "Coming", ends the Live Activity, and clears the anchor without making a new one. The next arrival check-in makes the next anchor. Home stays the arrival check-in.

## State model

`src/lib/reminder.ts` is a pure state machine, covered by `tests/local.test.ts`.

```
inactive ─┐
scheduled ─► active ─► checkingIn ─► completed
    │           │  ◄───────┘ (composer cancelled or closed)
    │           ├─► dismissed
    └─► inactive└─► expired   (3 hours after it came due)
     (came back before the delay)
```

The current reminder is stored locally under the `reminder` key. Dismissed event ids are kept under `reminder-dismissed`, so the same departure can't remind twice. `src/lib/reminder-runtime.ts` connects the state machine to storage, the Live Activity, and notifications. Every change goes through one queue, so a cold launch can't race itself.

## When it starts

iOS only lets an app start a Live Activity while it is in the foreground. The exceptions are ActivityKit push, which needs a server, and App Intents started from a widget or control. So:

- **Leaving a saved place.** The background geofence task records a `scheduled` reminder and schedules one local notification for the configured delay (1, 5, or 10 minutes). The Live Activity starts the next time Arrive is in the foreground after the delay, usually when the person taps the notification.
- **"Heading out?" on Home.** Starts the reminder immediately, on the Lock Screen.
- **Development tests.** In a dev build, go to Settings › Reminders › Developer tests.

`reconcileReminder()` runs at launch, on every return to the foreground, when check-ins or settings change, and when a pending reminder comes due while the app is open. It starts, updates, or ends the Live Activity to match stored state, and ends extra instances so only one shows. If a reminder that was shown is no longer running, the person removed it, and it is treated as dismissed. Arrive stores what it last sent to the Live Activity (`reminder-activity-pushed`) and skips redraws that would change nothing.

## Buttons

The banner shows up to five check-ins, starred ones first, in the design picked under Settings › Reminders › Lock Screen design ("Soft" or "Glass").

| Control             | What it does                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A place (Home, Gym) | Link to `arrive://check-in?from=reminder&quick=1&preset=<id>`. Opens Messages with that check-in, ready to send.              |
| ✕                   | iOS 17+: App Intent button that ends the reminder without opening Arrive. iOS 16: link to `arrive://reminder?action=dismiss`. |
| Rest of the banner  | Opens Home (`arrive://check-in?from=reminder`).                                                                               |

A place has to open Arrive, because Messages' composer is UIKit UI that only the app on screen can present. There's deliberately no confirm step in the banner: the only Send is the real one in Messages.

No supported iOS API avoids opening Arrive: a widget or Live Activity link is delivered to its own app, and `OpenURLIntent` (iOS 18) opens only the app's own universal links. So the hand-off is made as short as possible:

1. `src/app/+native-intent.tsx` catches `check-in` links before navigation, queues the send (`src/lib/send-request.ts`) and opens Home directly. `src/app/check-in.tsx` only covers web and in-app pushes.
2. Home opens Messages as soon as Arrive is active (after unlock, if the phone was locked), one frame after mounting. There's no fixed delay.
3. On a cold launch for a send, the launch screen stays up until Messages has slid over it (`src/lib/launch-splash.ts`), so Home doesn't flash first. It always hides within 5 seconds.
4. Updating the Lock Screen to "Opening Messages…" happens alongside, not before.

### How ✕ works without opening Arrive

A `Button` in an expo-widgets Live Activity performs expo-widgets' `LiveActivityUserInteraction`, a `LiveActivityIntent`. Apple runs a `LiveActivityIntent` in the app's process without opening the app. Unpatched, that intent only posts an event to JavaScript, which is lost when Arrive isn't running.

`patches/expo-widgets+57.0.20.patch` adds one native step, applied by `patch-package` after every install (including on EAS): a target of `end` ends the activity immediately. Live Activity buttons report the activity's id as their source, so the patch matches on id as well as name. The next time Arrive runs, `reconcileReminder()` sees the activity is gone and records the reminder as dismissed; while Arrive is running, `watchActivityButtons()` records it straight away.

When upgrading `expo-widgets`, re-check the patch. If it no longer applies, `patch-package` reports it during install.

## Updates and endings

- **Messages opened from the reminder.** The reminder moves to `checkingIn`, and the banner reads "Opening Messages…".
- **Messages reports `sent`.** The check-in is saved to History, and the reminder moves to `completed`. The Live Activity shows "Check-in sent ✓", then leaves after about 4 seconds.
- **Messages reports `cancelled` or `unknown`,** or the sheet is closed. The reminder goes back to `active` and stays on the Lock Screen.
- **✕.** Also Home › End, or pausing reminders. The reminder moves to `dismissed`, and the activity ends immediately.
- **Timeout.** 3 hours after the reminder came due, it moves to `expired` and ends. iOS also ends every Live Activity after 8 hours.

## Fallback

A notification stands in for the Live Activity when the device runs iOS older than 16.2, the build doesn't include the widget extension (as in Expo Go), Live Activities are off for Arrive in iOS Settings, or "Keep reminder on Lock Screen" is off. The Lock Screen switch is hidden where Live Activities aren't possible.

## Configuration

Nothing is hand-edited in `ios/`, following Continuous Native Generation. The `expo-widgets` plugin in `app.json` provides `NSSupportsLiveActivities`, the `group.com.arrive.checkin` App Group on the app and the `ExpoWidgetsTarget` extension, and the `arrive` URL scheme. The Live Activity is registered in code with `createLiveActivity('ArriveReminder', …)`. Push for Live Activities is off, and no secrets are involved.

```bash
npx eas-cli@latest build --profile development --platform ios   # physical iPhone
```

## Testing checklist

Run these on a physical iPhone before calling the feature verified.

- [ ] Settings › Reminders › Start Live Activity. Lock the phone. It appears on the Lock Screen and in the Dynamic Island.
- [ ] Tap Gym. Messages opens with the gym message, ready to send.
- [ ] Force-quit Arrive, then tap a place. Same result.
- [ ] Cancel in Messages. The Live Activity stays.
- [ ] Send in Messages. The sheet closes, and the Live Activity shows "sent", then leaves.
- [ ] Tap ✕ with Arrive running. The banner goes away without opening Arrive.
- [ ] Tap ✕ with Arrive force-quit. The banner goes away. Open Arrive: Home shows no reminder.
- [ ] Switch Settings › Reminders › Lock Screen design while a reminder shows. The banner restyles.
- [ ] Turn Live Activities off for Arrive in iOS Settings, then start a reminder. A notification arrives instead.
- [ ] A real departure from a saved place with a departure reminder on.
