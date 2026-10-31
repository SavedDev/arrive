import { useCallback, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, ChevronRight, Contact, Heart, QrCode, UserPlus } from 'lucide-react-native';
import { Avatar, Notice, Row, Screen, Section, Toast, Txt, styles } from '@/components/ui';
import { HappySun } from '@/components/illustrations';
import { SortableList } from '@/components/sortable-list';
import { useAddContact } from '@/components/add-contact';
import { useApp } from '@/state/app';
import { accents } from '@/design/theme';
import { errorMessage } from '@/lib/domain';
import { invitationMessage } from '@/lib/invitation';
const ROW = 66;
export default function People() {
  const app = useApp();
  const [error, setError] = useState(''),
    [dragging, setDragging] = useState(false);
  const contact = useAddContact();
  const hideToast = useCallback(() => contact.clearNote(), [contact]);
  const peach = accents.peach;
  return (
    <Screen
      modal
      title="Your people"
      scrollEnabled={!dragging}
      overlay={<Toast text={contact.note} onHide={hideToast} />}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share Arrive"
        onPress={() => {
          void Share.share({
            message: invitationMessage(process.env.EXPO_PUBLIC_INSTALL_URL),
          }).catch((e) => setError(errorMessage(e)));
        }}
        style={({ pressed }) => ({
          backgroundColor: app.isDark ? peach.dark : peach.bg,
          borderRadius: 24,
          padding: 20,
          minHeight: 118,
          overflow: 'hidden',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ position: 'absolute', right: -18, bottom: -26 }}>
          <HappySun size={130} />
        </View>
        <View style={{ maxWidth: '64%', gap: 4 }}>
          <Txt weight="rounded" style={{ fontSize: 19, lineHeight: 25 }}>
            Share Arrive
          </Txt>
          <Txt tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
            Invite someone you love to check in, too.
          </Txt>
          <View style={[styles.row, { gap: 5, marginTop: 6 }]}>
            <Txt weight="bold" tone="green" style={{ fontSize: 12 }}>
              Send an invite
            </Txt>
            <ArrowRight size={14} color={app.colors.green} />
          </View>
        </View>
      </Pressable>
      <Section title="People" />
      {app.people.length ? (
        <SortableList
          items={app.people}
          keyOf={(p) => p.id}
          labelOf={(p) => p.name}
          rowHeight={ROW}
          onDragChange={setDragging}
          onReorder={(ids) => app.reorderPeople(ids).catch((e) => setError(errorMessage(e)))}
          renderRow={(p) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={p.name}
              onPress={() => router.push({ pathname: '/person', params: { id: p.id } })}
              style={({ pressed }) => [styles.row, { height: ROW, opacity: pressed ? 0.65 : 1 }]}
            >
              <Avatar person={p} size={46} />
              <View style={{ flex: 1 }}>
                <Txt weight="medium" numberOfLines={1}>
                  {p.name}
                </Txt>
                {(app.prefs.defaultRecipient === p.id || p.smartPaired) && (
                  <Txt tone="green" style={{ fontSize: 12, lineHeight: 17 }} numberOfLines={1}>
                    {[
                      app.prefs.defaultRecipient === p.id && 'Default person',
                      // Only shown for the one person who also has Arrive and is paired.
                      p.smartPaired && 'Smart Reminders',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                )}
              </View>
              <ChevronRight size={17} color={app.colors.muted} />
            </Pressable>
          )}
        />
      ) : (
        <Notice text="No one saved yet. Add someone you’d like to keep in the loop." />
      )}
      <Notice text={contact.error || error} error />
      <Section title="Add someone" />
      <Row
        title="Choose Contact"
        subtitle="Pick someone from your phone to add them"
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
