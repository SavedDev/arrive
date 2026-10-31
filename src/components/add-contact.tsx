import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { Phone } from 'lucide-react-native';
import { Avatar, Button, Txt, styles } from '@/components/ui';
import { useApp } from '@/state/app';
import { chooseContact, type PickedContact } from '@/lib/contact-picker';
import { contactPhone, deviceRegion } from '@/lib/people';
import { errorMessage } from '@/lib/domain';

/**
 * Opens the phone's contact picker and saves the chosen person right away.
 * Only asks a follow-up question when the contact has more than one usable number.
 * Numbers that can't be read fall back to the manual editor, prefilled.
 */
export function useAddContact() {
  const app = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [choice, setChoice] = useState<{ contact: PickedContact; phones: string[] } | null>(null);
  async function save(contact: PickedContact, phone: string) {
    setChoice(null);
    const name = (contact.name.trim() || phone).slice(0, 50);
    try {
      await app.savePerson(
        { id: Crypto.randomUUID(), name, phone, photo: contact.photo },
        !app.prefs.defaultRecipient,
      );
      setNote(`${name} was added.`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const contact = await chooseContact();
      if (!contact) return;
      if (!contact.phones.length)
        throw new Error(
          `${contact.name || 'This contact'} has no phone number. Choose another contact, or enter one manually.`,
        );
      const region = deviceRegion();
      const phones = [
        ...new Set(contact.phones.map((p) => contactPhone(p, region)).filter((p) => p !== null)),
      ];
      if (!phones.length) {
        router.push({
          pathname: '/person',
          params: { name: contact.name, phone: contact.phones[0], fix: '1' },
        });
        return;
      }
      if (phones.length === 1) await save(contact, phones[0]);
      else setChoice({ contact, phones });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const sheet = (
    <PhoneChoice
      choice={choice}
      onPick={(phone) => choice && save(choice.contact, phone)}
      onCancel={() => setChoice(null)}
    />
  );
  return { start, busy, error, note, clearNote: () => setNote(''), sheet };
}

function PhoneChoice({
  choice,
  onPick,
  onCancel,
}: {
  choice: { contact: PickedContact; phones: string[] } | null;
  onPick: (phone: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useApp();
  return (
    <Modal visible={!!choice} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Cancel"
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(20, 30, 25, 0.35)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          {choice && (
            <>
              <View style={[styles.row, { marginBottom: 16 }]}>
                <Avatar person={choice.contact} size={46} />
                <View style={{ flex: 1 }}>
                  <Txt weight="rounded" style={{ fontSize: 20, lineHeight: 26 }}>
                    {choice.contact.name}
                  </Txt>
                  <Txt tone="muted" style={{ fontSize: 13 }}>
                    Which number should get your check-ins?
                  </Txt>
                </View>
              </View>
              {choice.phones.map((p) => (
                <Button
                  key={p}
                  label={parsePhoneNumberFromString(p)?.formatInternational() || p}
                  icon={Phone}
                  variant="secondary"
                  onPress={() => onPick(p)}
                  style={{ marginBottom: 10 }}
                />
              ))}
              <Button label="Cancel" variant="ghost" onPress={onCancel} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
