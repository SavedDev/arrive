import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { Bell, Check, MapPin, Smartphone, type LucideIcon } from 'lucide-react-native';
import { CrownArt, CrownBadge } from '@/components/paywall-art';
import { Button, Notice, Screen, Txt } from '@/components/ui';
import { acceptCustomerInfo, setQaBypass, useAccess } from '@/lib/access';
import { errorMessage } from '@/lib/domain';
import { trialLabel, yearlySavings } from '@/lib/paywall';
import { entitlement, purchases } from '@/lib/purchases';
import { useApp } from '@/state/app';

type Plan = 'monthly' | 'yearly';
const FEATURES: {
  icon: LucideIcon;
  tint: 'mint' | 'lavender' | 'cream';
  title: string;
  body: string;
}[] = [
  {
    icon: MapPin,
    tint: 'mint',
    title: 'Smart Check-Ins',
    body: 'Arrive notices when you leave and reminds you to check in.',
  },
  {
    icon: Smartphone,
    tint: 'lavender',
    title: 'Lock Screen shortcuts',
    body: 'Check in from your Lock Screen in a tap.',
  },
  {
    icon: Bell,
    tint: 'cream',
    title: 'Gentle reminders',
    body: 'Friendly nudges so you never forget.',
  },
];

/**
 * Arrive Plus: a free trial or a subscription is needed to use Arrive. Shown after onboarding,
 * and whenever access lapses. There's no way past it except through the store (and, in
 * development builds only, the QA bypass).
 */
export default function Paywall() {
  const app = useApp();
  const { colors, isDark } = app;
  const access = useAccess();
  const [packages, setPackages] = useState<Record<Plan, PurchasesPackage | null>>({
    monthly: null,
    yearly: null,
  });
  const [trialEligible, setTrialEligible] = useState<Record<Plan, boolean>>({
    monthly: false,
    yearly: false,
  });
  const [plan, setPlan] = useState<Plan>('yearly'),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [note, setNote] = useState('');

  const apply = (r: Plans) => {
    setPackages(r.packages);
    setTrialEligible(r.eligible);
    if (!r.packages.yearly && r.packages.monthly) setPlan('monthly');
    setError(r.error);
    setLoading(false);
  };
  useEffect(() => {
    let active = true;
    void fetchPlans().then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, []);
  // Once Arrive Plus is active (bought, restored, or renewed elsewhere), on to Home.
  // (The web preview has no store and isn't gated, so the paywall stays put there to be seen.)
  useEffect(() => {
    if (access === 'active' && Platform.OS !== 'web') router.replace('/');
  }, [access]);

  const selected = packages[plan];
  const trial = selected && trialEligible[plan] ? trialLabel(selected.product.introPrice) : null;
  const anyTrial =
    (packages.yearly && trialEligible.yearly && trialLabel(packages.yearly.product.introPrice)) ||
    (packages.monthly && trialEligible.monthly && trialLabel(packages.monthly.product.introPrice));
  const savings =
    packages.monthly && packages.yearly
      ? yearlySavings(packages.monthly.product.price, packages.yearly.product.price)
      : null;
  // App Store rules: a subscription needs a privacy policy link. Development builds can still
  // test purchases in the sandbox before it's set.
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;
  const termsUrl =
    process.env.EXPO_PUBLIC_TERMS_URL ||
    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  const canBuy = !!selected && (!!privacyUrl || __DEV__);

  async function buy() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const p = await purchases();
      const { customerInfo } = await p.purchasePackage(selected);
      if (!(await acceptCustomerInfo(customerInfo))) {
        if (__DEV__)
          console.warn(
            `[Arrive] Bought ${selected.product.identifier}, but entitlement "${entitlement}" isn't active.`,
            '\nActive entitlements:',
            Object.keys(customerInfo.entitlements.active),
            '\nAll entitlements:',
            Object.keys(customerInfo.entitlements.all),
            '\nActive subscriptions:',
            customerInfo.activeSubscriptions,
          );
        setError('The store didn’t confirm Arrive Plus yet. Try Restore purchases in a moment.');
      }
    } catch (e) {
      if (!(typeof e === 'object' && e && 'userCancelled' in e && e.userCancelled))
        setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const p = await purchases();
      const info = await p.restorePurchases();
      if (!(await acceptCustomerInfo(info)))
        setNote('No active Arrive Plus subscription was found for this store account.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const priceLine = (pkg: PurchasesPackage | null, per: string) =>
    pkg ? `${pkg.product.priceString}/${per}` : loading ? '…' : '—';
  const finePrint = selected
    ? trial
      ? `${trial}, then ${selected.product.priceString} per ${plan === 'yearly' ? 'year' : 'month'}.`
      : `${selected.product.priceString} per ${plan === 'yearly' ? 'year' : 'month'}.`
    : '';

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button
            label={trial ? 'Start free trial' : 'Subscribe'}
            onPress={() => void buy()}
            loading={busy}
            disabled={!canBuy}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
            <FooterLink label="Restore" onPress={() => void restore()} />
            <FooterLink label="Terms" onPress={() => void Linking.openURL(termsUrl)} />
            {!!privacyUrl && (
              <FooterLink label="Privacy" onPress={() => void Linking.openURL(privacyUrl)} />
            )}
            {__DEV__ && (
              <FooterLink label="QA bypass" onPress={() => void setQaBypass(true)} muted />
            )}
          </View>
        </View>
      }
    >
      <CrownArt />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Txt weight="display" style={{ fontSize: 32, lineHeight: 39, textAlign: 'center' }}>
          Stay in the loop,
        </Txt>
        <Txt weight="display" style={{ fontSize: 32, lineHeight: 39, textAlign: 'center' }}>
          effortlessly.
        </Txt>
        <Txt
          tone="muted"
          style={{ fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 16 }}
        >
          Arrive Plus helps you check in faster and smarter, so your people are always in the know.
        </Txt>
      </View>

      <View style={{ gap: 14, marginTop: 22, paddingHorizontal: 6 }}>
        {FEATURES.map(({ icon: Icon, tint, title, body }) => (
          <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? featureTint[tint].dark : featureTint[tint].bg,
              }}
            >
              <Icon size={21} color={featureTint[tint].ink} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="rounded" style={{ fontSize: 16, lineHeight: 21 }}>
                {title}
              </Txt>
              <Txt tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>
                {body}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      {!!anyTrial && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginTop: 22,
            padding: 16,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.softGreen,
          }}
        >
          <CrownBadge />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
          <View>
            <Txt weight="display" style={{ fontSize: 22, lineHeight: 28 }}>
              {String(anyTrial).replace(/^./, (c) => c.toUpperCase())}
            </Txt>
            <Txt tone="muted" style={{ fontSize: 14 }}>
              Cancel anytime.
            </Txt>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <PlanCard
          title="Monthly"
          price={priceLine(packages.monthly, 'mo')}
          selected={plan === 'monthly'}
          disabled={!packages.monthly}
          onPress={() => setPlan('monthly')}
        />
        <PlanCard
          title="Yearly"
          price={priceLine(packages.yearly, 'yr')}
          detail={
            packages.yearly?.product.pricePerMonthString
              ? `Just ${packages.yearly.product.pricePerMonthString}/mo${savings ? ` (${savings}% off)` : ''}`
              : undefined
          }
          badge={savings ? 'Best value' : undefined}
          selected={plan === 'yearly'}
          disabled={!packages.yearly}
          onPress={() => setPlan('yearly')}
        />
      </View>

      <Notice text={error} error />
      <Notice text={note} />
      {!!error && (
        <Button
          label="Try again"
          variant="ghost"
          onPress={() => {
            setLoading(true);
            setError('');
            void fetchPlans().then(apply);
          }}
          disabled={loading}
        />
      )}
      {!privacyUrl && !__DEV__ && (
        <Notice text="Subscriptions open once Arrive’s privacy policy is published." />
      )}
      {!!finePrint && (
        <Txt
          tone="muted"
          style={{ fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 }}
        >
          {finePrint} Renews automatically until canceled. Cancel anytime in{' '}
          {Platform.OS === 'ios' ? 'Settings › Apple Account › Subscriptions' : 'Google Play'}, at
          least 24 hours before the period ends.
        </Txt>
      )}
    </Screen>
  );
}

const featureTint = {
  mint: { bg: '#E3F1EA', dark: '#293E30', ink: '#287B5A' },
  lavender: { bg: '#EEEBF8', dark: '#393047', ink: '#7A62B3' },
  cream: { bg: '#FAF1DB', dark: '#443D2A', ink: '#C9962E' },
};

type Plans = {
  packages: Record<Plan, PurchasesPackage | null>;
  eligible: Record<Plan, boolean>;
  error: string;
};
/** The current monthly and yearly plans, and which still offer this account a free trial. */
async function fetchPlans(): Promise<Plans> {
  const none = { monthly: null, yearly: null };
  try {
    const p = await purchases();
    const offering = (await p.getOfferings()).current;
    const packages = { monthly: offering?.monthly ?? null, yearly: offering?.annual ?? null };
    if (!packages.monthly && !packages.yearly)
      return {
        packages,
        eligible: { monthly: false, yearly: false },
        error: 'Subscriptions aren’t available right now. Please try again shortly.',
      };
    const ids = [packages.monthly, packages.yearly].flatMap((pkg) =>
      pkg ? [pkg.product.identifier] : [],
    );
    // Only promise a trial the store says this account can still get.
    const eligibility: Record<string, { status: number }> = await p
      .checkTrialOrIntroductoryPriceEligibility(ids)
      .catch(() => ({}));
    const eligible = (pkg: PurchasesPackage | null) =>
      !!pkg &&
      !!trialLabel(pkg.product.introPrice) &&
      eligibility[pkg.product.identifier]?.status ===
        p.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    return {
      packages,
      eligible: { monthly: eligible(packages.monthly), yearly: eligible(packages.yearly) },
      error: '',
    };
  } catch (e) {
    return { packages: none, eligible: { monthly: false, yearly: false }, error: errorMessage(e) };
  }
}

function PlanCard({
  title,
  price,
  detail,
  badge,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  price: string;
  detail?: string;
  badge?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${price}`}
      accessibilityState={{ selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 14,
        borderRadius: 18,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.green : colors.border,
        backgroundColor: selected ? colors.softGreen : colors.surface,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        gap: 4,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: selected ? 0 : 1.5,
            borderColor: colors.muted,
            backgroundColor: selected ? colors.green : 'transparent',
          }}
        >
          {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <Txt weight="rounded" style={{ fontSize: 17, lineHeight: 22 }}>
          {title}
        </Txt>
        {!!badge && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10,
              backgroundColor: '#F6E3A9',
            }}
          >
            <Txt weight="medium" style={{ fontSize: 11, lineHeight: 15, color: '#6B5418' }}>
              {badge}
            </Txt>
          </View>
        )}
      </View>
      <Txt style={{ fontSize: 15, lineHeight: 21, marginLeft: 30 }}>{price}</Txt>
      {!!detail && (
        <Txt tone="muted" style={{ fontSize: 11, lineHeight: 15, marginLeft: 30 }}>
          {detail}
        </Txt>
      )}
    </Pressable>
  );
}

function FooterLink({
  label,
  onPress,
  muted = false,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={{ minHeight: 32, justifyContent: 'center' }}
    >
      <Txt tone={muted ? 'muted' : 'green'} weight="medium" style={{ fontSize: 13 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
