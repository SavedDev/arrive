import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { Phone } from 'lucide-react-native';
import { Avatar, Button, Notice, SheetModal, Txt, styles } from '@/components/ui';
import { replaceMessage, useReplacePerson } from '@/components/replace-person';
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
  const replace = useReplacePerson();
  // `confirmed`: the number picker already said who this replaces, so picking was the answer.
  async function save(contact: PickedContact, phone: string, confirmed = false) {
    setChoice(null);
    const name = (contact.name.trim() || phone).slice(0, 50);
    try {
      if (!confirmed && !(await replace.confirm(name))) return;
      const replacing = !!replace.current;
      await app.savePerson({ id: Crypto.randomUUID(), name, phone, photo: contact.photo });
      setNote(replacing ? `${name} is now your person.` : `${name} was added.`);
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
    <>
      <PhoneChoice
        choice={choice}
        replacing={choice ? replaceMessage(replace.current, choice.contact.name || 'them') : ''}
        onPick={(phone) => choice && save(choice.contact, phone, true)}
        onCancel={() => setChoice(null)}
      />
      {replace.dialog}
    </>
  );
  return {
    start,
    busy,
    error,
    note,
    clearNote: () => setNote(''),
    clearError: () => setError(''),
    sheet,
  };
}

function PhoneChoice({
  choice,
  replacing,
  onPick,
  onCancel,
}: {
  choice: { contact: PickedContact; phones: string[] } | null;
  /** Who this contact replaces, when there's already a person; picking a number confirms it. */
  replacing: string;
  onPick: (phone: string) => void;
  onCancel: () => void;
}) {
  return (
    <SheetModal visible={!!choice} onClose={onCancel}>
      <View style={{ padding: 24, paddingTop: 18 }}>
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
            <Notice text={replacing} />
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
      </View>
    </SheetModal>
  );
}
