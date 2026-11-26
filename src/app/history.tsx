import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Clock, Trash2 } from 'lucide-react-native';
import {
  Card,
  ConfirmDialog,
  Empty,
  IconButton,
  PresetIcon,
  Screen,
  Section,
  Txt,
  styles,
} from '@/components/ui';
import { useApp } from '@/state/app';
import { historyDay, recentHistory } from '@/lib/history';
import { errorMessage } from '@/lib/domain';
export default function History() {
  const { history, refreshHistory, clearHistory, error, dismissError, colors } = useApp();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState('');
  useFocusEffect(
    useCallback(() => {
      void refreshHistory().catch(() => {});
    }, [refreshHistory]),
  );
  const entries = recentHistory(history);
  return (
    <Screen
      modal
      message={{
        text: error || failure,
        error: true,
        onHide: () => {
          dismissError();
          setFailure('');
        },
      }}
      title="History"
      action={
        entries.length > 0 && (
          <IconButton
            icon={Trash2}
            label="Clear history"
            color={colors.danger}
            onPress={() => setConfirm(true)}
          />
        )
      }
    >
      {!entries.length ? (
        <Empty
          icon={Clock}
          title="No check-ins yet!"
          description="Your recent check-ins will appear here."
        />
      ) : (
        entries.map((e, i) => (
          <View key={e.id}>
            {(i === 0 || historyDay(entries[i - 1].timestamp) !== historyDay(e.timestamp)) && (
              <Section title={historyDay(e.timestamp)} />
            )}
            <Card style={{ marginBottom: 12 }}>
              <View style={styles.row}>
                <PresetIcon preset={e} box={44} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold">{e.presetName}</Txt>
                  <Txt tone="muted" style={{ fontSize: 12 }}>
                    To {e.recipientName}
                  </Txt>
                </View>
                <Txt tone="muted" style={{ fontSize: 11 }}>
                  {new Date(e.timestamp).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Txt>
              </View>
              <Txt style={{ marginTop: 15, fontSize: 14 }}>{e.preparedText}</Txt>
              <Txt
                tone={e.status === 'sent' ? 'green' : 'muted'}
                style={{ fontSize: 12, marginTop: 12 }}
              >
                {e.status === 'sent'
                  ? 'Sent in Messages'
                  : 'Opened in Messages, may not have been sent'}
              </Txt>
            </Card>
          </View>
        ))
      )}
      <Txt tone="muted" style={{ fontSize: 12, lineHeight: 19, marginTop: 16 }}>
        Your history stays on this phone for 3 days. Since you send from Messages, you can change a
        message before it goes, and Arrive can’t see what you sent, whether it was delivered, or any
        replies.
      </Txt>
      <ConfirmDialog
        visible={confirm}
        title="Clear history?"
        message="This permanently removes your check-in history from this device."
        confirmLabel="Yes, clear history"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setBusy(true);
          setFailure('');
          clearHistory()
            .then(() => setConfirm(false))
            .catch((e) => setFailure(errorMessage(e)))
            .finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}
