import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Trash2 } from 'lucide-react-native';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  Notice,
  Screen,
  goBack,
} from '@/components/ui';
import { useReplacePerson } from '@/components/replace-person';
import { useApp } from '@/state/app';
import { errorMessage } from '@/lib/domain';
export default function PersonEditor() {
  // name/phone/fix prefill the form when a picked contact's number needs fixing by hand.
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    phone?: string;
    fix?: string;
  }>();
  const app = useApp(),
    existing = app.people.find((p) => p.id === params.id);
  const [localId] = useState(() => existing?.id || Crypto.randomUUID());
  const [name, setName] = useState(existing?.name || params.name || ''),
    [phone, setPhone] = useState(existing?.phone || params.phone || '');
  // Arrive keeps one person: adding someone new replaces them, after asking.
  const replace = useReplacePerson();
  // Guidance for fixing a picked contact's number: on the page from the start, so nothing moves.
  const fixHint =
    params.fix === '1'
      ? 'Arrive couldn’t read this contact’s number. Add the country code, then save.'
      : '';
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!existing && !(await replace.confirm(name.trim() || 'this person'))) return;
      await app.savePerson({ id: localId, name, phone, photo: existing?.photo });
      goBack();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      modal
      footer={
        <Button
          label={existing ? 'Save person' : 'Confirm and save person'}
          onPress={save}
          loading={busy}
        />
      }
      message={{ text: error, error: true, onHide: () => setError('') }}
      title={existing ? 'Your person' : replace.current ? 'Change your person' : 'Add your person'}
      action={
        existing && (
          <IconButton
            icon={Trash2}
            label="Remove person"
            color={app.colors.danger}
            onPress={() => setDeleting(true)}
          />
        )
      }
    >
      {existing && (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Avatar person={{ name: name || existing.name, photo: existing.photo }} size={84} />
        </View>
      )}
      <Notice text={fixHint} error />
      <Field label="Person’s name" value={name} onChangeText={setName} maxLength={50} />
      <Field
        label="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={35}
        placeholder="+1 312 555 0123"
      />
      <Notice text="Include the country code. Double-check this is the person you intend to message; Arrive does not verify their identity or ownership of this number." />
      {replace.dialog}
      {existing && (
        <ConfirmDialog
          visible={deleting}
          title={`Remove ${existing.name}?`}
          message={`Your check-ins won’t have anyone to go to until you add someone. Existing history expires after 3 days.${existing.smartPaired ? ' This also ends Smart Reminders with them.' : ''}`}
          confirmLabel="Yes, remove"
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setBusy(true);
            void app
              .deletePerson(existing.id)
              .then(goBack)
              .catch((e) => {
                setDeleting(false);
                setError(errorMessage(e));
              })
              .finally(() => setBusy(false));
          }}
        />
      )}
    </Screen>
  );
}
