import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Check, Heart, RefreshCw } from 'lucide-react-native';
import { Button, Card, Notice, Screen, Txt } from '@/components/ui';
import { HappySun } from '@/components/illustrations';
import { useApp } from '@/state/app';
import { entitlement, purchases } from '@/lib/purchases';
import { errorMessage } from '@/lib/domain';
export default function Subscription() {
  const app = useApp();
  const [offer, setOffer] = useState<PurchasesPackage | null>(null),
    [info, setInfo] = useState<CustomerInfo | null>(null),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const p = await purchases();
      const [offers, customer] = await Promise.all([p.getOfferings(), p.getCustomerInfo()]);
      if (!active) return;
      setOffer(offers.current?.monthly || null);
      setInfo(customer);
      if (!offers.current?.monthly)
        setError('A monthly subscription is not currently available. Please check back later.');
      const onInfo = (info: CustomerInfo) => {
        if (active) setInfo(info);
      };
      p.addCustomerInfoUpdateListener(onInfo);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active')
          void p
            .getCustomerInfo()
            .then(onInfo)
            .catch((e) => {
              if (active) setError(errorMessage(e));
            });
      });
      unsubscribe = () => {
        p.removeCustomerInfoUpdateListener(onInfo);
        listener.remove();
      };
    })().catch((e) => {
      if (active) setError(errorMessage(e));
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  async function buy(restore: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const p = await purchases();
      if (restore) {
        const restored = await p.restorePurchases();
        setInfo(restored);
        setNote(
          restored.entitlements.active[entitlement]
            ? 'Your subscription has been restored.'
            : 'No active Arrive Plus subscription was found for this store account.',
        );
      } else if (offer) setInfo((await p.purchasePackage(offer)).customerInfo);
    } catch (e) {
      if (!(typeof e === 'object' && e && 'userCancelled' in e && e.userCancelled))
        setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const active = info?.entitlements.active[entitlement];
  return (
    <Screen modal>
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
          <Heart size={16} color={app.colors.green} fill={app.colors.green} />
          <Txt tone="green" weight="bold" style={{ fontSize: 12, letterSpacing: 2 }}>
            ARRIVE PLUS
          </Txt>
        </View>
        <HappySun size={155} />
        <Txt weight="display" style={{ fontSize: 34, lineHeight: 42, textAlign: 'center' }}>
          Little check-ins.{'\n'}A closer you.
        </Txt>
        <Txt tone="muted" style={{ textAlign: 'center', fontSize: 14 }}>
          Support a simpler, more thoughtful{'\n'}way to keep your people close.
        </Txt>
      </View>
      <View style={{ gap: 19, marginVertical: 30 }}>
        {[
          'A tiny utility built around the people you love',
          'A private, ad-free check-in experience',
          'Support continued improvements to Arrive',
        ].map((text) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Check size={18} color={app.colors.green} />
            <Txt style={{ flex: 1, fontSize: 13 }}>{text}</Txt>
          </View>
        ))}
      </View>
      <Card style={{ backgroundColor: app.colors.softGreen, borderWidth: 0, alignItems: 'center' }}>
        <Txt weight="rounded" style={{ fontSize: 24 }}>
          {active
            ? 'You’re part of Arrive Plus'
            : offer
              ? `${offer.product.priceString} / month`
              : 'A little more love, coming soon'}
        </Txt>
        <Txt tone="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 5 }}>
          {active
            ? active.expirationDate
              ? `Current period ends ${new Date(active.expirationDate).toLocaleDateString()}`
              : 'Your subscription is active'
            : 'Your everyday check-ins remain available without Plus.'}
        </Txt>
      </Card>
      <Notice text={error} error />
      <Notice text={note} />
      {!active && (
        <Button
          label={
            offer ? `Subscribe · ${offer.product.priceString}/month` : 'Subscription not available'
          }
          onPress={() => buy(false)}
          disabled={!offer || !process.env.EXPO_PUBLIC_PRIVACY_URL}
          loading={busy}
          style={{ marginTop: 18 }}
        />
      )}
      <Button
        label="Restore purchases"
        variant="ghost"
        icon={RefreshCw}
        onPress={() => buy(true)}
        disabled={busy}
      />
      <Button
        label="Manage subscription"
        variant="ghost"
        onPress={() =>
          Linking.openURL(
            info?.managementURL ||
              (Platform.OS === 'ios'
                ? 'https://apps.apple.com/account/subscriptions'
                : 'https://play.google.com/store/account/subscriptions'),
          ).catch((e) => setError(errorMessage(e)))
        }
      />
      <Button
        label="Privacy policy"
        variant="ghost"
        disabled={!process.env.EXPO_PUBLIC_PRIVACY_URL}
        onPress={() =>
          Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL!).catch((e) =>
            setError(errorMessage(e)),
          )
        }
      />
      <Button
        label="Terms of use"
        variant="ghost"
        onPress={() =>
          Linking.openURL(
            process.env.EXPO_PUBLIC_TERMS_URL ||
              'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
          ).catch((e) => setError(errorMessage(e)))
        }
      />
      {!process.env.EXPO_PUBLIC_PRIVACY_URL && (
        <Notice text="Purchases will be available after the publisher provides the privacy policy for this build." />
      )}
      <Txt tone="muted" style={{ fontSize: 10, lineHeight: 17, textAlign: 'center' }}>
        Monthly subscriptions renew automatically unless canceled through your store account. The
        store shows the final terms before you purchase. No trial is promised.
      </Txt>
    </Screen>
  );
}
