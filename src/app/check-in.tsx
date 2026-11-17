import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { requestSend, sendRequestFromQuery } from '@/lib/send-request';
import { useApp } from '@/state/app';

// There is no check-in screen: Home sends. This route forwards check-in links that arrive
// while Arrive is open (and every link on web). Cold launches skip it via +native-intent.tsx.
export default function CheckInLink() {
  const params = useLocalSearchParams<{
    preset?: string;
    recipient?: string;
    choose?: string;
    quick?: string;
    from?: string;
    coming?: string;
    call?: string;
  }>();
  const { colors } = useApp();
  const navigation = useNavigation();
  useEffect(() => {
    const request = sendRequestFromQuery(params);
    // Anything open besides Home and this route (a sheet, Settings) closes first, back to
    // the original Home. Messages waits for those sheets to finish sliding away, because
    // iOS can't show it while another screen is still being dismissed.
    const covered = (navigation.getState()?.routes.length ?? 0) > 2;
    router.dismissTo('/');
    if (covered) setTimeout(() => requestSend(request), 450);
    else requestSend(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
