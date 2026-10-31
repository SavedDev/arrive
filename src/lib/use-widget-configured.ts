import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { isArriveWidgetConfigured } from '../../modules/arrive-widget-status';

export function useWidgetConfigured() {
  const [configured, setConfigured] = useState(false);
  const refresh = useCallback(() => {
    void isArriveWidgetConfigured().then(setConfigured);
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  return configured;
}
