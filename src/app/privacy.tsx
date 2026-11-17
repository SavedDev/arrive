import { Linking } from 'react-native';
import { useState } from 'react';
import { Button, Notice, Screen, Section, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/domain';
export default function Privacy() {
  const [error, setError] = useState('');
  return (
    <Screen modal title="Always in your hands" subtitle="Small check-ins. Thoughtful privacy.">
      <Section title="Your data stays with you" />
      <Txt>
        People and phone numbers, shortcuts, places, preferences, and history are stored on this
        device. History expires after 72 hours when Arrive runs. There is no Arrive account, cloud
        backup, or account recovery. Uninstalling the app, clearing data, or losing your device can
        lose your data.
      </Txt>
      <Section title="Messages are yours to send" />
      <Txt>
        Arrive opens your phone’s message composer with a prepared recipient and text. You can edit
        both and must approve sending. The messaging service and carrier handle the message under
        their own terms. Arrive cannot read replies, see your inbox, or verify delivery. A send
        confirmation only reflects the composer’s reported action.
      </Txt>
      <Section title="Only the permissions you choose" />
      <Txt>
        Camera access is used to scan contact QR codes. On iPhone, the system contact picker shares
        the contact you select without granting access to your whole address book. Android may
        request contact access to read your selection. Manual entry is always available. Optional
        background location notices when you leave a remembered place, on this phone. To put Smart
        Check-In on your Lock Screen, Arrive then sends its service an anonymous request holding
        only a random event id and the delay, never your location, the place, or who you text. After
        you send an arrival check-in, Arrive keeps that one spot on this phone, so it can notice
        when you leave. A new check-in replaces it; no history of places is kept. Searching for an
        address sends what you type to Apple to find matches. Notifications appear only when a Live
        Activity can&apos;t, or to confirm a send. Manual check-ins work without location or
        notification access.
      </Txt>
      <Section title="Smart Check-In: going separate ways" />
      <Txt>
        Arrive compares your latest location with your paired person&apos;s latest location to
        notice when you&apos;ve gone separate ways. Previous locations are replaced instead of
        creating a location history. Smart Reminders are off until both people explicitly opt in
        through a temporary, one-use QR invitation. While enabled, each paired phone sends its
        latest latitude, longitude, accuracy, and capture time to Arrive&apos;s Cloudflare service.
        A new update overwrites the previous location; Arrive does not build a location trail. The
        service stores anonymous device and pair identifiers, push tokens, your Smart Check-In days
        and time zone, current proximity state, and reminder delivery state. It does not receive
        names, phone numbers, saved places, message text, presets, or check-in history. Disabling
        Smart Reminders deletes that phone&apos;s current location. Disconnecting deletes both
        current locations and ends the anonymous pair.
      </Txt>
      <Section title="Sharing contact details" />
      <Txt>
        QR codes contain your chosen name and phone number. Anyone with the QR can read them.
        Sharing requires your consent and scanning requires confirmation. When you choose Smart
        Reminders, the QR also contains a random pairing token that expires after 10 minutes and can
        be used once. The other person must separately approve pairing.
      </Txt>
      <Section title="Optional subscriptions" />
      <Txt>
        Arrive Plus uses the app store and RevenueCat’s anonymous purchase identity. Store purchase
        records are separate from your local check-in data. Restore purchases uses your store
        account; it does not restore your people, places, or history.
      </Txt>
      <Notice text={error} error />
      <Button
        label="Open phone permissions"
        variant="secondary"
        onPress={() => {
          void Linking.openSettings().catch((e) => setError(errorMessage(e)));
        }}
      />
      {!!process.env.EXPO_PUBLIC_PRIVACY_URL && (
        <Button
          label="Publisher privacy policy"
          variant="ghost"
          onPress={() => {
            void Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL!).catch((e) =>
              setError(errorMessage(e)),
            );
          }}
        />
      )}
    </Screen>
  );
}
