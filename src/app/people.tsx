import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Contact, Heart, Pencil, QrCode, UserPlus } from 'lucide-react-native';
import { Avatar, Notice, Row, Screen, Section, Txt, styles } from '@/components/ui';
import { ShareBanner } from '@/components/share-banner';
import { useAddContact } from '@/components/add-contact';
import { useApp } from '@/state/app';
const ROW = 66;
export default function People() {
  const app = useApp();
  const [error, setError] = useState('');
  const person = app.people[0];
  const contact = useAddContact();
  return (
    <Screen
      modal
      title="Your person"
      message={{
        text: contact.error || error || contact.note,
        error: !!(contact.error || error),
        onHide: () => {
          contact.clearError();
          contact.clearNote();
          setError('');
        },
      }}
    >
      <ShareBanner onError={setError} style={{ marginBottom: 20 }} />
      {/* Arrive keeps one person; adding someone else replaces them, after asking. */}
      {person ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${person.name}`}
          onPress={() => router.push({ pathname: '/person', params: { id: person.id } })}
          style={({ pressed }) => [
            styles.row,
            {
              // Framed like the person card on Home.
              minHeight: ROW + 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: app.colors.border,
              backgroundColor: app.colors.surface,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Avatar person={person} size={46} />
          <View style={{ flex: 1 }}>
            <Txt weight="medium" numberOfLines={1}>
              {person.name}
            </Txt>
            <Txt tone="green" style={{ fontSize: 12, lineHeight: 17 }} numberOfLines={1}>
              {person.smartPaired ? 'Gets your check-ins · Smart Reminders' : 'Gets your check-ins'}
            </Txt>
          </View>
          {/* The whole row opens the editor; the pill says so. */}
          <View
            style={[
              styles.row,
              {
                gap: 5,
                height: 32,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: app.colors.softGreen,
              },
            ]}
          >
            <Pencil size={13} color={app.colors.green} strokeWidth={2.2} />
            <Txt weight="bold" tone="green" style={{ fontSize: 13 }}>
              Edit
            </Txt>
          </View>
        </Pressable>
      ) : (
        <Notice text="No one saved yet. Add someone you’d like to keep in the loop." />
      )}
      <Section title={person ? 'Change person' : 'Add someone'} />
      <Row
        title="Choose Contact"
        subtitle={
          person ? 'Pick someone else from your phone' : 'Pick someone from your phone to add them'
        }
        icon={Contact}
        onPress={contact.start}
      />
      <Row
        title="Scan QR"
        subtitle="Review their name and number before saving"
        icon={QrCode}
        onPress={() => router.push('/scan')}
      />
      <Row title="Enter Manually" icon={UserPlus} onPress={() => router.push('/person')} />
      <Row
        title="Share My QR"
        subtitle="Share your own name and phone number"
        icon={Heart}
        onPress={() => router.push('/share-qr')}
      />
      {contact.sheet}
    </Screen>
  );
}
