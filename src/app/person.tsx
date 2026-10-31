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
  Row,
  Screen,
  Toggle,
  goBack,
} from '@/components/ui';
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
  const [makeDefault, setDefault] = useState(
    existing ? app.prefs.defaultRecipient === existing.id : !app.prefs.defaultRecipient,
  );
  const [error, setError] = useState(
      params.fix === '1'
        ? 'Arrive couldn’t read this contact’s number. Add the country code, then save.'
        : '',
    ),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await app.savePerson({ id: localId, name, phone, photo: existing?.photo }, makeDefault);
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
      title={existing ? 'Your person' : 'Add a person'}
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
      <Row
        title="Make my default person"
        right={<Toggle label="Make my default person" value={makeDefault} onChange={setDefault} />}
      />
      <Notice text={error} error />
      <Button
        label={existing ? 'Save person' : 'Confirm and save person'}
        onPress={save}
        loading={busy}
      />
      {existing && (
        <ConfirmDialog
          visible={deleting}
          title={`Remove ${existing.name}?`}
          message={`Saved check-ins and places will use your default person. Existing history expires after 3 days.${existing.smartPaired ? ' This also ends Smart Reminders with them.' : ''}`}
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
