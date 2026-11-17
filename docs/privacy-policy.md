# Arrive Privacy Policy

_Effective November 17, 2026_

Arrive helps you let the people you care about know you got where you were going. It was built to keep as little about you as possible. There's no Arrive account, no advertising, no analytics and no tracking, and we never sell data.

This policy explains what Arrive keeps on your phone, what leaves it, who handles it and the choices you have. "Arrive", "we" and "us" mean the Arrive app and its publisher.

## What stays on your phone

Most of what you put into Arrive is stored only on your device:

- **Your people:** the names and phone numbers you add, typed in, picked from Contacts or scanned from a QR code.
- **Your check-ins:** their names, icons and message text.
- **Your places:** the places you ask Arrive to remember, with their addresses and map coordinates.
- **Your history:** recent check-ins you've sent, which expire after 72 hours.
- **The spot of your last arrival check-in**, so Arrive can notice when you leave. Each new check-in replaces it, and no history of places is kept.
- **Your preferences**, such as appearance, reminders and your default person.

We never receive any of this. There's no cloud backup, so if you delete Arrive, clear its data or lose your phone, this information is gone and we can't recover it.

## Sending messages and calls

When you send a check-in, Arrive opens your phone's own message composer with the recipient and text filled in. You can change either one, and nothing is sent until you tap Send. Your messaging app and carrier deliver the message under their own terms. Arrive can't read your messages, your replies or your inbox.

If you turn on the call button for the Lock Screen banner, tapping it asks your phone to call your person. Your phone always asks you to confirm before dialing.

## Permissions

Arrive asks only for what a feature needs, and you can say no. Manual check-ins work without any of these permissions.

- **Location:** used to remember places, to notice when you leave one (Smart Check-In) and, if you pair with someone, to notice when you've gone separate ways (Smart Reminders). Background location is optional.
- **Contacts:** on iPhone, the system contact picker shares only the contact you choose, not your whole address book.
- **Camera:** used only to scan Arrive QR codes.
- **Notifications:** used when a Lock Screen reminder can't be shown, and to confirm a send.

You can change any of these at any time in your phone's Settings.

## What leaves your phone, and why

### Smart Check-In

Smart Check-In puts a reminder on your Lock Screen after you leave a remembered place. To do that, Arrive uses a small service we run on Cloudflare. When you turn Smart Check-In on, your phone registers with it anonymously. The service then stores:

- a random device identifier, and a scrambled (hashed) form of a secret that only your phone knows;
- your phone's platform (iOS or Android);
- the push tokens Apple issues so the service can start your Lock Screen reminder;
- the days Smart Check-In is active and your time zone.

When you leave a remembered place, your phone sends only a random event identifier and how long to wait before reminding you. The service keeps when that reminder is due and whether it was delivered. **It never receives your location, the place you left, who you check in with, or what your messages say.**

### Smart Reminders (pairing with someone)

Smart Reminders are off unless both of you choose to turn them on. You pair by scanning a one-time QR invitation, which expires after 10 minutes.

While Smart Reminders are on, each paired phone sends the service its **latest location**: latitude, longitude, accuracy and the time it was measured. Each update replaces the last one, so the service never builds a trail of where you've been. The service compares the two latest locations to tell whether you're together or have gone separate ways. To do that it keeps:

- the anonymous pair identifier and your two device identifiers;
- the pair's current state (for example "together"), the most recent distance between you and when you were last together;
- when a reminder is due and whether it was delivered.

The service doesn't receive names, phone numbers, saved places, message text or check-in history.

**What happens when you stop:**
- Turning Smart Reminders off deletes your phone's location from the service straight away.
- Disconnecting from your person deletes both phones' locations and ends the pair.
- Clearing Arrive's data does both.

### Address search and maps

When you search for an address, what you type is sent to Apple's mapping service to find matches. Maps in Arrive are shown using Apple Maps.

### Arrive Plus subscriptions

Arrive Plus is sold through the App Store. Apple handles payment, and Arrive never sees your payment details. We use RevenueCat to check whether your subscription is active. RevenueCat links your purchases to a random, anonymous identifier rather than your name or email. It processes:

- your purchase and subscription history;
- basic technical details, such as your device model, system version, app version and IP address.

Restore Purchases uses your App Store account, and it doesn't restore your people, places or history.

### Sharing your contact details by QR code

If you choose to share your details, Arrive makes a QR code holding the name and phone number you pick. Anyone who scans it can read them. If you're pairing for Smart Reminders, the code also holds a random pairing token that works once and expires after 10 minutes. Scanning a code always asks for confirmation, and the other person must approve pairing separately.

## Who handles data for us

Each of these companies handles only the parts described above, under its own privacy policy:

| Company | What it does for Arrive | Privacy policy |
| --- | --- | --- |
| Cloudflare | Hosts the Smart Check-In and Smart Reminders service | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| Apple | Sends Lock Screen reminders and notifications, handles App Store purchases, maps and address search | [apple.com/legal/privacy](https://www.apple.com/legal/privacy/) |
| RevenueCat | Checks your Arrive Plus subscription | [revenuecat.com/privacy](https://www.revenuecat.com/privacy/) |

Like any internet service, Cloudflare sees your phone's IP address when your phone contacts the Arrive service. Arrive doesn't store IP addresses.

## How long we keep data

- **On your phone:** until you delete it, clear Arrive's data or delete the app. History expires after 72 hours.
- **Latest locations (Smart Reminders):** replaced with every update, and deleted when you turn Smart Reminders off, disconnect or clear Arrive's data.
- **Pairing invitations:** they expire after 10 minutes and are deleted when you create a new one.
- **Anonymous device and reminder records:** kept for as long as the service needs them to deliver your reminders. They hold no name, phone number, location or message content.

## Security

Everything sent between Arrive and our service is encrypted with HTTPS. Your phone proves who it is with a secret that we store only in scrambled (hashed) form, and pairing tokens are stored the same way.

## Your choices and rights

- Turn off Smart Check-In or Smart Reminders at any time in Arrive's settings.
- Remove Arrive's access to location, contacts, camera or notifications in your phone's Settings.
- Delete everything Arrive keeps on your phone with **Settings → Privacy & data → Clear app data**, or by deleting the app.
- Cancel Arrive Plus in your App Store account settings. Deleting the app doesn't cancel a subscription.

Depending on where you live, you may have the right to ask what data we hold about you, or to have it corrected or deleted. Email us to make a request. We hold no names, emails or phone numbers, so we may not be able to match anonymous service records to you. Everything personal is on your own phone, where you can view and delete it yourself.

## Children

Arrive isn't directed at children under 13, and we don't knowingly collect personal information from them.

## Changes to this policy

If we change this policy, we'll update it here and change the date at the top. If a change affects how we handle information you've already shared, we'll tell you in the app before it takes effect.

## Contact

Questions or requests: [andycheco25@gmail.com](mailto:andycheco25@gmail.com)
