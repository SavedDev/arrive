import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Check, ChevronRight, Star, Trash2 } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import {
  Button,
  Chip,
  ConfirmDialog,
  Field,
  IconButton,
  Notice,
  Screen,
  Toast,
  Txt,
  goBack,
  presetIcons,
  styles,
} from '@/components/ui';
import { useApp } from '@/state/app';
import { accents } from '@/design/theme';
import { quickIcons } from '@/design/icons';
import { onIconPicked } from '@/lib/icon-picker';
import type { Accent, IconName, Preset } from '@/lib/types';
import {
  errorMessage,
  MAX_ACTIVITY_SHORTCUTS,
  MIN_ACTIVITY_SHORTCUTS,
  suggestedMessage,
} from '@/lib/domain';
// Matches the Field label style, so every section of the form reads the same.
const labelStyle = { fontSize: 13, marginBottom: 9 };
export default function PresetEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const app = useApp();
  const existing = app.presets.find((p) => p.id === id);
  const [editorId] = useState(() => existing?.id || Crypto.randomUUID());
  const [name, setName] = useState(existing?.name || ''),
    [message, setMessage] = useState(existing?.message || suggestedMessage(''));
  const [edited, setEdited] = useState(Boolean(existing)),
    [icon, setIcon] = useState<IconName>(existing?.icon || 'pin'),
    [color, setColor] = useState<Accent>(existing?.color || 'mint'),
    [recipient, setRecipient] = useState(existing?.recipientId || ''),
    [favorite, setFavorite] = useState(existing?.favorite || false);
  const navigation = useNavigation();
  const [error, setError] = useState(''),
    [warning, setWarning] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [leaving, setLeaving] = useState(false),
    [discard, setDiscard] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const clearWarning = useCallback(() => setWarning(''), []);
  const showFailure = (failure: unknown) => {
    const message = errorMessage(failure);
    if (message.includes('favorite check-ins')) setWarning(message);
    else setError(message);
  };
  // Unsaved edits ask before the sheet closes, whether by the close button or a swipe down.
  // The star saves on its own for existing check-ins, so it only counts for new ones.
  const dirty =
    name !== (existing?.name || '') ||
    message !== (existing?.message || suggestedMessage('')) ||
    icon !== (existing?.icon || 'pin') ||
    color !== (existing?.color || 'mint') ||
    recipient !== (existing?.recipientId || '') ||
    (!existing && favorite);
  usePreventRemove(dirty && !leaving, ({ data }) => setDiscard(data.action));
  useEffect(() => onIconPicked(setIcon), []);
  // A picked icon from the full list shows first, ahead of the quick picks.
  const shownIcons = quickIcons.includes(icon) ? quickIcons : [icon, ...quickIcons];
  useEffect(() => {
    if (leaving) goBack();
  }, [leaving]);
  async function save() {
    setBusy(true);
    try {
      const p: Preset = {
        id: editorId,
        name,
        message,
        icon,
        color,
        recipientId: recipient,
        favorite,
        order: existing?.order ?? app.presets.length,
      };
      await app.savePreset(p);
      setLeaving(true);
    } catch (e) {
      showFailure(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      modal
      title={existing ? 'Edit check-in' : 'New check-in'}
      overlay={
        <Toast
          text={warning}
          onHide={clearWarning}
          duration={6000}
          enterDuration={80}
          tone="warning"
          dismissable
          top={18}
        />
      }
      action={
        <>
          <IconButton
            icon={Star}
            label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            selected={favorite}
            filled={favorite}
            color={favorite ? '#D8A93A' : app.colors.text}
            onPress={() => {
              const next = !favorite;
              const favoriteCount = app.presets.filter((preset) => preset.favorite).length;
              if (
                next &&
                !existing?.favorite &&
                favoriteCount >= MAX_ACTIVITY_SHORTCUTS
              ) {
                setWarning('Keep no more than 4 favorite check-ins for your Lock Screen banner.');
                return;
              }
              if (
                !next &&
                existing?.favorite &&
                favoriteCount <= MIN_ACTIVITY_SHORTCUTS
              ) {
                setWarning('Keep at least 2 favorite check-ins for your Lock Screen banner.');
                return;
              }
              setError('');
              setWarning('');
              setFavorite(next);
              // Existing check-ins save the star right away; new ones save it with the form.
              if (existing)
                app.savePreset({ ...existing, favorite: next }).catch((e) => {
                  setFavorite(!next);
                  showFailure(e);
                });
            }}
          />
          {existing && (
            <IconButton
              icon={Trash2}
              label="Delete check-in"
              color={app.colors.danger}
              onPress={() => setDeleting(true)}
            />
          )}
        </>
      }
    >
      <Field
        label="Name"
        placeholder="e.g. Pickleball"
        value={name}
        maxLength={40}
        onChangeText={(v) => {
          setName(v);
          if (!edited) setMessage(suggestedMessage(v));
        }}
      />
      <View style={[styles.between, { marginBottom: 9 }]}>
        <Txt weight="medium" style={{ fontSize: 13 }}>
          Icon
        </Txt>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.push({ pathname: '/icons', params: { selected: icon } })}
          style={[styles.row, { gap: 4 }]}
        >
          <Txt tone="green" weight="medium" style={{ fontSize: 13 }}>
            See more icons
          </Txt>
          <ChevronRight size={15} color={app.colors.green} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {shownIcons
          .map((key) => ({ key, Icon: presetIcons[key] }))
          .map(({ key, Icon }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${key} icon`}
              accessibilityState={{ selected: icon === key }}
              aria-selected={icon === key}
              key={key}
              onPress={() => setIcon(key as IconName)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: icon === key ? app.colors.softGreen : app.colors.surface,
                borderWidth: 1,
                borderColor: icon === key ? app.colors.green : app.colors.border,
              }}
            >
              <Icon size={23} color={app.colors.green} strokeWidth={1.6} />
            </Pressable>
          ))}
      </View>
      <Txt weight="medium" style={[labelStyle, { marginTop: 20 }]}>
        Color
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {Object.entries(accents).map(([key, a]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={key}
            accessibilityState={{ selected: color === key }}
            aria-selected={color === key}
            key={key}
            onPress={() => setColor(key as Accent)}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 16,
              backgroundColor: a.bg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: color === key ? a.ink : 'transparent',
            }}
          >
            {color === key && <Check size={19} color={a.ink} />}
          </Pressable>
        ))}
      </View>
      <Field
        label="Message"
        value={message}
        multiline
        grow
        maxLength={500}
        onChangeText={(v) => {
          setEdited(true);
          setMessage(v);
        }}
      />
      <Txt weight="medium" style={labelStyle}>
        Send to
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="My default person" active={!recipient} onPress={() => setRecipient('')} />
        {app.people.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={recipient === c.id}
            onPress={() => setRecipient(c.id)}
          />
        ))}
      </View>
      <Notice text={error} error />
      <Button
        label={existing ? 'Save check-in' : 'Add check-in'}
        onPress={save}
        loading={busy}
        style={{ marginTop: 24 }}
      />
      <ConfirmDialog
        visible={!!discard}
        title="Discard your changes?"
        message="Your edits to this check-in won’t be saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => setDiscard(null)}
        onConfirm={() => {
          const action = discard;
          setDiscard(null);
          if (action) navigation.dispatch(action);
        }}
      />
      {existing && (
        <ConfirmDialog
          visible={deleting}
          title="Delete this check-in?"
          message="Your past check-ins stay in History for up to 3 days."
          confirmLabel="Yes, delete it"
          cancelLabel="Keep it"
          onCancel={() => setDeleting(false)}
          onConfirm={() =>
            app
              .deletePreset(existing.id)
              .then(() => setLeaving(true))
              .catch((e) => {
                setDeleting(false);
                showFailure(e);
              })
          }
        />
      )}
    </Screen>
  );
}
