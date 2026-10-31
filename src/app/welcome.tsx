import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Field, Notice, Screen, Txt } from '@/components/ui';
import { Landscape, HappySun } from '@/components/illustrations';
import { useApp } from '@/state/app';
import { useAddContact } from '@/components/add-contact';
import { enableNotifications } from '@/lib/notifications';
import { errorMessage } from '@/lib/domain';
export default function Welcome() {
  const app = useApp();
  const contact = useAddContact();
  const [step, setStep] = useState(0),
    [message, setMessage] = useState(app.prefs.defaultMessage),
    [error, setError] = useState('');
  const titles = [
    'A little check-in. A lot of love.',
    'Who would you like to keep in the loop? ❤️',
    'Your words, ready when you are.',
    'A gentle nudge, if you’d like.',
    'A little closer, on your Lock Screen.',
  ];
  async function next() {
    try {
      setError('');
      if (step === 2) {
        if (!message.trim()) throw new Error('Write a default message first.');
        await app.updatePrefs({ defaultMessage: message.trim() });
      }
      if (step === 4) {
        await app.updatePrefs({ onboardingDone: true });
        router.replace('/');
      } else setStep((s) => s + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Screen back>
      <View style={{ alignItems: 'center', gap: 20, marginVertical: 30 }}>
        {step === 0 ? <Landscape width={270} height={220} /> : <HappySun size={125} />}
        <Txt tone="green" style={{ fontSize: 12 }}>
          {step + 1} OF 5
        </Txt>
        <Txt weight="display" style={{ fontSize: 31, lineHeight: 39, textAlign: 'center' }}>
          {titles[step]}
        </Txt>
      </View>
      {step === 0 && (
        <Txt tone="muted" style={{ textAlign: 'center', marginBottom: 30 }}>
          Let your person know you arrived safely, without the hassle of typing a message. Pick a
          shortcut, then approve it in your phone’s messaging app.
        </Txt>
      )}
      {step === 1 && (
        <>
          <Notice text="They receive a normal text message and don’t need Arrive. Save someone now, or skip and add them later." />
          <Button label="Scan QR" variant="secondary" onPress={() => router.push('/scan')} />
          <Button
            label="Share QR or invite"
            variant="ghost"
            onPress={() => router.push('/people')}
          />
          <Button
            label="Choose Contact"
            variant="ghost"
            loading={contact.busy}
            onPress={contact.start}
          />
          <Notice text={contact.note} />
          <Notice text={contact.error} error />
          {contact.sheet}
          <Button label="Enter Manually" variant="ghost" onPress={() => router.push('/person')} />
          {!!app.people.length && (
            <Notice
              text={`${app.people.length} ${app.people.length === 1 ? 'person' : 'people'} saved on this device.`}
            />
          )}
        </>
      )}
      {step === 2 && (
        <Field
          label="Default check-in message"
          multiline
          value={message}
          onChangeText={setMessage}
          maxLength={500}
        />
      )}
      {step === 3 && (
        <>
          <Notice text="Smart Check-In can remind you on your Lock Screen when you leave a remembered place. You always choose when to send." />
          <Button
            label="Enable local notifications"
            variant="secondary"
            onPress={() => {
              void enableNotifications()
                .then(() => setStep(4))
                .catch((e) => setError(errorMessage(e)));
            }}
          />
        </>
      )}
      {step === 4 && (
        <>
          <Notice text="On iPhone, touch and hold your Lock Screen, choose Customize, then Add Widgets and select Arrive. The Check In widget opens your shortcuts. You still approve each message. Widgets must be added manually." />
          <Button
            label="See widget instructions"
            variant="secondary"
            onPress={() => router.push('/widget')}
          />
        </>
      )}
      <Notice text={error} error />
      <Button
        label={
          step === 4
            ? 'Make yourself at home'
            : step === 1 && !app.people.length
              ? 'Skip for now'
              : step === 3
                ? 'Maybe later'
                : 'Continue'
        }
        onPress={next}
        style={{ marginTop: 20 }}
      />
    </Screen>
  );
}
