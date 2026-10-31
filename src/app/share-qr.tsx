import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Chip, Field, Notice, Row, Screen, Toggle, Txt } from '@/components/ui';
import { encodePerson, validatePerson } from '@/lib/people';
import { errorMessage } from '@/lib/domain';
import { useApp } from '@/state/app';
import {
  createSmartInvite,
  getSmartStatus,
  rememberSmartInvite,
  requestSmartPermissions,
  syncSmartRuntime,
} from '@/lib/smart-reminders';
export default function ShareQR() {
  const app = useApp();
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [consent, setConsent] = useState(false),
    [payload, setPayload] = useState(''),
    [smart, setSmart] = useState(false),
    // Who the invitation is for, so their check-ins get the separation reminder.
    [pairWith, setPairWith] = useState(
      () =>
        app.people.find((p) => p.id === app.prefs.defaultRecipient)?.id ?? app.people[0]?.id ?? '',
    ),
    [paired, setPaired] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function generate() {
    try {
      setBusy(true);
      const clean = validatePerson({ name, phone });
      let pairToken: string | undefined;
      if (smart) {
        await requestSmartPermissions();
        const invite = await createSmartInvite(app.prefs.reminderMinutes);
        pairToken = invite.token;
        // Nothing is uploaded yet: location starts only once they scan and accept.
        await rememberSmartInvite(invite.expiresAt);
        await app.setSmartPartner(pairWith || null);
        await app.updatePrefs({ smartReminders: true });
      }
      setPayload(encodePerson(clean, pairToken));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  // While an invitation is showing, notice when they accept it, then start Smart Reminders.
  const waiting = smart && !!payload && !paired;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      void getSmartStatus()
        .then(async (status) => {
          if (status.pair?.status !== 'active') return;
          setPaired(true);
          await syncSmartRuntime(true);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting]);
  const partner = app.people.find((p) => p.id === pairWith);
  return (
    <Screen modal title="Share My QR" subtitle="A simple way to share your contact details.">
      <Field
        label="Your name"
        value={name}
        maxLength={50}
        onChangeText={(v) => {
          setName(v);
          setPayload('');
        }}
      />
      <Field
        label="Your phone number"
        value={phone}
        maxLength={35}
        keyboardType="phone-pad"
        placeholder="+1 312 555 0123"
        onChangeText={(v) => {
          setPhone(v);
          setPayload('');
        }}
      />
      <Notice text="Anyone who scans or receives your QR can read your name and phone number. Show it only to people you choose. It is not identity verification." />
      <Row
        title="I agree to share my name and number"
        right={
          <Toggle
            label="I agree to share my name and number"
            value={consent}
            onChange={(v) => {
              setConsent(v);
              setPayload('');
            }}
          />
        }
      />
      {Platform.OS === 'ios' && (
        <Row
          title="Pair Smart Reminders"
          subtitle="Adds a one-use invitation that expires in 10 minutes. Both people must opt in."
          right={
            <Toggle
              label="Pair Smart Reminders"
              value={smart}
              onChange={(value) => {
                setSmart(value);
                setPayload('');
              }}
            />
          }
        />
      )}
      {smart && app.people.length > 0 && (
        <>
          <Txt weight="medium" style={{ fontSize: 13, marginBottom: 9 }}>
            Who is this for?
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {app.people.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                active={pairWith === p.id}
                onPress={() => {
                  setPairWith(p.id);
                  setPayload('');
                }}
              />
            ))}
          </View>
        </>
      )}
      {smart && (
        <Notice text="If the other person accepts, each phone sends only its latest approximate location and time to Arrive's Cloudflare service. Each new location replaces the previous one. Your contact, phone number, messages, presets, and check-in history are never uploaded." />
      )}
      <Notice text={error} error />
      <Button
        label="Create my QR"
        disabled={!consent}
        loading={busy}
        onPress={() => void generate()}
      />
      {!!payload && (
        <View style={{ alignItems: 'center', gap: 20, marginTop: 25 }}>
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 20 }}>
            <QRCode
              value={payload}
              size={220}
              color="#193D2E"
              backgroundColor="#FFFFFF"
              quietZone={10}
            />
          </View>
          <Txt tone="muted">
            {paired
              ? `Paired${partner ? ` with ${partner.name}` : ''} ✓ Smart Reminders are on.`
              : 'Ask your person to scan this in Arrive.'}
          </Txt>
          <Button
            label="Share contact details separately"
            variant="secondary"
            onPress={() => {
              const clean = validatePerson({ name, phone });
              void Share.share({ message: `${clean.name}\n${clean.phone}` }).catch((e) =>
                setError(errorMessage(e)),
              );
            }}
          />
          <Txt tone="muted" style={{ fontSize: 12 }}>
            This opens the system share sheet with your name and number as text. No phone number is
            placed in an invitation URL.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
