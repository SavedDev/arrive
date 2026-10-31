import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { goBack } from '@/components/ui';
import { dismissReminder } from '@/lib/reminder-runtime';
import { useApp } from '@/state/app';

// Target of the Live Activity's dismiss button (arrive://reminder?action=dismiss).
// Ends the reminder, then returns to wherever the person was, or Home on a cold launch.
export default function ReminderLink() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  const { colors } = useApp();
  useEffect(() => {
    void (action === 'dismiss' ? dismissReminder() : Promise.resolve())
      .catch(() => {})
      .finally(goBack);
  }, [action]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}
