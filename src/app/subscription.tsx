import { PlusHeroArt } from '@/components/paywall-art';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { acceptCustomerInfo } from '@/lib/access';
import { errorMessage } from '@/lib/domain';
import { entitlement, purchases } from '@/lib/purchases';
import { RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, View } from 'react-native';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

/**
 * Settings → Arrive Plus: the plan you're on and when it renews, with the ways to manage it.
 * Everyone past the paywall has Arrive Plus, so there's nothing to buy here.
 */
export default function Subscription() {
  const [info, setInfo] = useState<CustomerInfo | null>(null),
    [offering, setOffering] = useState<PurchasesOffering | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const p = await purchases();
      const [customer, offers] = await Promise.all([
        p.getCustomerInfo(),
        p.getOfferings().catch(() => null),
      ]);
      if (!active) return;
      setInfo(customer);
      setOffering(offers?.current ?? null);
      // Renewals, cancellations and refunds that happen while this is open.
      const onInfo = (next: CustomerInfo) => {
        if (active) setInfo(next);
      };
      p.addCustomerInfoUpdateListener(onInfo);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active')
          void p
            .getCustomerInfo()
            .then(onInfo)
            .catch(() => {});
      });
      unsubscribe = () => {
        p.removeCustomerInfoUpdateListener(onInfo);
        listener.remove();
      };
    })()
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function restore() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const restored = await (await purchases()).restorePurchases();
      setInfo(restored);
      setNote(
        (await acceptCustomerInfo(restored))
          ? 'Your subscription has been restored.'
          : 'No active Arrive Plus subscription was found for this store account.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const active = info?.entitlements.active[entitlement];
  // Which plan this is, from the store's own plans.
  const plan =
    active &&
    [
      { label: 'Yearly', per: 'year', pkg: offering?.annual },
      { label: 'Monthly', per: 'month', pkg: offering?.monthly },
    ].find((p) => p.pkg?.product.identifier === active.productIdentifier);
  const date = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
  const ends = date(active?.expirationDate);
  const status = !active
    ? loading
      ? 'Checking your subscription…'
      : 'Arrive Plus isn’t active on this store account.'
    : active.periodType === 'TRIAL'
      ? ends
        ? `Free trial · ${active.willRenew ? 'Your plan starts' : 'Ends'} ${ends}`
        : 'Free trial'
      : ends
        ? `${active.willRenew ? 'Renews' : 'Ends'} ${ends}`
        : 'Active';
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;
  const termsUrl =
    process.env.EXPO_PUBLIC_TERMS_URL ||
    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  const open = (url: string) => void Linking.openURL(url).catch((e) => setError(errorMessage(e)));

  return (
    <Screen
      modal
      title="Arrive Plus"
      message={{
        text: error || note,
        error: !!error,
        onHide: () => {
          setError('');
          setNote('');
        },
      }}
    >
      <PlusHeroArt />
      <Card style={{ alignItems: 'center', marginTop: 8 }}>
        <Txt weight="rounded" style={{ fontSize: 22, lineHeight: 28 }}>
          {active ? (plan ? `${plan.label} plan` : 'You have Arrive Plus') : 'Arrive Plus'}
        </Txt>
        <Txt tone="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 4 }}>
          {status}
        </Txt>
        {plan?.pkg && (
          <Txt tone="muted" style={{ fontSize: 13, textAlign: 'center' }}>
            {`${plan.pkg.product.priceString} per ${plan.per}`}
          </Txt>
        )}
      </Card>
      <View style={{ gap: 4, marginTop: 16 }}>
        <Button
          label="Manage subscription"
          variant="secondary"
          onPress={() =>
            open(
              info?.managementURL ||
                (Platform.OS === 'ios'
                  ? 'https://apps.apple.com/account/subscriptions'
                  : 'https://play.google.com/store/account/subscriptions'),
            )
          }
        />
        <Button
          label="Restore purchases"
          variant="ghost"
          icon={RefreshCw}
          onPress={() => void restore()}
          loading={busy}
        />
        {/* Terms and privacy side by side */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 4 }}>
          <TextLink label="Terms of use" onPress={() => open(termsUrl)} />
          {!!privacyUrl && <TextLink label="Privacy policy" onPress={() => open(privacyUrl)} />}
        </View>
      </View>
      <Txt
        tone="muted"
        style={{
          fontSize: 11,
          lineHeight: 17,
          textAlign: 'center',
          marginTop: 8,
          marginHorizontal: 16,
        }}
      >
        Change or cancel your plan any time in your App Store account.
      </Txt>
    </Screen>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt tone="green" weight="bold" style={{ fontSize: 12 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
