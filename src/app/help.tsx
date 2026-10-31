import { Screen, Section, Txt } from '@/components/ui';
export default function Help() {
  return (
    <Screen modal title="A little help">
      <Section title="How do I check in?" />
      <Txt>
        Add your person’s name and phone number, pick a shortcut, and tap Send to open your phone’s
        composer. Review the recipient and message, then approve sending there. Your person doesn’t
        need Arrive.
      </Txt>
      <Section title="Why does it say unverified?" />
      <Txt>
        Some phones cannot tell Arrive whether you sent or cancelled a message. Android always
        reports an unknown result. Check your messaging app before trying again. Arrive never
        confirms delivery.
      </Txt>
      <Section title="Where are my conversations?" />
      <Txt>
        Replies stay in your normal messaging app. Arrive’s History is only a record of prepared
        check-ins from the past 72 hours on this device.
      </Txt>
      <Section title="How does Smart Check-In work?" />
      <Txt>
        Smart Check-In is one reminder: a banner on your Lock Screen that stays until you check in
        or dismiss it. It starts on the days you choose, 1, 5, or 10 minutes after either trigger:
        leaving a remembered place, or going separate ways from the person you&apos;re paired with.
        If both happen together, you still get one banner. Coming back, or checking in first,
        cancels it. Check-ins from Home always work, whatever the schedule. If a Live Activity
        can&apos;t start (they&apos;re turned off for Arrive, or there&apos;s no connection), you
        get one notification instead.
      </Txt>
      <Section title="Leaving remembered places" />
      <Txt>
        Turn on Remember this place for a location and allow Always location access. Your phone
        notices when you leave after a real stay; it may take a few minutes. iOS won&apos;t let an
        app put a banner on the Lock Screen from the background, so Arrive asks its service to start
        it. It sends only an anonymous “left, start in 5 minutes” request: never where you are, the
        place, or who you&apos;re texting.
      </Txt>
      <Section title="Going separate ways" />
      <Txt>
        This optional feature needs Arrive on both phones. Turn it on when creating or accepting a
        temporary pairing QR and allow background location and notifications. Each phone sends only
        its latest accurate location to Arrive&apos;s Cloudflare service; the prior location is
        replaced. Two reliable, separated updates over time are required, so a single GPS jump
        cannot start a reminder. Reuniting cancels a pending reminder. Battery restrictions, weak
        GPS, lost network, or disabled permissions can delay or prevent it. Manual check-ins still
        work.
      </Txt>
      <Section title="Inviting someone" />
      <Txt>
        The invite link opens Arrive when installed, or a publisher-provided installation page when
        available. It carries no phone number and does not pair devices. A QR can optionally carry a
        one-use Smart Reminders token; both people must opt in. Always review scanned contact
        details.
      </Txt>
      <Section title="Changing phones" />
      <Txt>
        Arrive has no cloud backup or account recovery. People, places, shortcuts, and history may
        be lost if you uninstall or lose this device. Restoring an app-store subscription does not
        restore local app data.
      </Txt>
    </Screen>
  );
}
