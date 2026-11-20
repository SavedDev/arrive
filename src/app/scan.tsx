import { useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { Button, Card, Notice, Row, Screen, Toggle, Txt } from '@/components/ui';
import { useApp } from '@/state/app';
import { decodePerson } from '@/lib/people';
import { replaceMessage } from '@/components/replace-person';
import { errorMessage } from '@/lib/domain';
import {
  acceptSmartInvite,
  requestSmartPermissions,
  syncSmartRuntime,
} from '@/lib/smart-reminders';
export default function Scan() {
  const app = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [candidate, setCandidate] = useState<ReturnType<typeof decodePerson> | null>(null);
  const [error, setError] = useState(''),
    // The scan failed: the camera stays hidden until Scan again, after the error banner has gone.
    [failed, setFailed] = useState(false),
    [pairSmart, setPairSmart] = useState(false),
    [busy, setBusy] = useState(false);
  const scanned = useRef(false);
  const fail = (message: string) => {
    setError(message);
    setFailed(true);
  };
  return (
    <Screen
      modal
      title="Scan their QR"
      subtitle="Their details stay on this device."
      message={{ text: error, error: true, onHide: () => setError('') }}
    >
      {!candidate &&
        !failed &&
        (permission?.granted ? (
          <View style={{ height: 300, overflow: 'hidden', borderRadius: 24 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onMountError={() => fail('Camera unavailable. Enter your person manually instead.')}
              onBarcodeScanned={({ data }) => {
                if (scanned.current) return;
                scanned.current = true;
                try {
                  setCandidate(decodePerson(data));
                  setError('');
                } catch (e) {
                  fail(errorMessage(e));
                }
              }}
            />
          </View>
        ) : (
          <>
            <Notice text="Camera access is used only while you scan a contact QR." />
            <Button
              label={
                permission && !permission.canAskAgain ? 'Open camera settings' : 'Allow camera'
              }
              onPress={() => {
                void (
                  permission && !permission.canAskAgain
                    ? Linking.openSettings()
                    : requestPermission()
                ).catch((e) => setError(errorMessage(e)));
              }}
            />
          </>
        ))}
      {candidate && (
        <>
          <Card>
            <Txt weight="rounded" style={{ fontSize: 24 }}>
              {candidate.name}
            </Txt>
            <Txt>{candidate.phone}</Txt>
          </Card>
          <Notice text="Check these details with your person. Scanning does not verify identity or ask the other person to accept a connection." />
          {'pairToken' in candidate && Platform.OS === 'ios' && (
            <>
              <Row
                title="Pair Smart Reminders"
                subtitle="Opt in to separation reminders with this person. The invitation is one-use and expires after 10 minutes."
                right={
                  <Toggle label="Pair Smart Reminders" value={pairSmart} onChange={setPairSmart} />
                }
              />
              {pairSmart && (
                <Notice text="Each phone sends only its latest approximate location and time to Arrive's Cloudflare service. Each update replaces the last. Contact details, messages, presets, and check-in history stay on your phone." />
              )}
            </>
          )}
          {/* Arrive keeps one person: saving here replaces them, and says so first. */}
          <Notice text={replaceMessage(app.people[0], candidate.name)} />
          <Button
            label={app.people[0] ? `Replace ${app.people[0].name}` : 'Confirm and save person'}
            loading={busy}
            onPress={() => {
              setBusy(true);
              void (async () => {
                const { name, phone } = candidate;
                const id = Crypto.randomUUID();
                // Saved as an ordinary recipient first; pairing is an optional extra.
                await app.savePerson({ id, name, phone });
                if ('pairToken' in candidate && pairSmart) {
                  const pairToken = candidate.pairToken;
                  if (!pairToken) throw new Error('This Smart Reminders invitation is invalid.');
                  await requestSmartPermissions();
                  await acceptSmartInvite(pairToken, app.prefs.reminderMinutes);
                  await app.setSmartPartner(id);
                  await app.updatePrefs({ smartReminders: true });
                  await syncSmartRuntime(true);
                }
              })()
                .then(() => (router.canGoBack() ? router.back() : router.replace('/')))
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setBusy(false));
            }}
          />
        </>
      )}
      {(!!candidate || failed) && (
        <Button
          label="Scan again"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            scanned.current = false;
            setCandidate(null);
            setError('');
            setFailed(false);
          }}
        />
      )}
      <Button
        label="Enter Manually"
        variant="ghost"
        disabled={busy}
        onPress={() => router.replace('/person')}
      />
    </Screen>
  );
}
