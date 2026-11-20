import { PlusHeroArt } from '@/components/paywall-art';
import { Button, Notice, Screen, Txt } from '@/components/ui';
import { acceptCustomerInfo, useAccess } from '@/lib/access';
import { errorMessage } from '@/lib/domain';
import { trialLabel, yearlySavings } from '@/lib/paywall';
import { entitlement, purchases } from '@/lib/purchases';
import { useApp } from '@/state/app';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, Check, Smartphone } from 'lucide-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import Svg, { Path } from 'react-native-svg';

type Plan = 'monthly' | 'yearly';
type FeatureIcon = ComponentType<{ size: number; color: string; strokeWidth: number }>;

/** An iOS Messages-style speech bubble, drawn in the same line style as the Lucide icons. */
function MessageBubble({
  size,
  color,
  strokeWidth,
}: {
  size: number;
  color: string;
  strokeWidth: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M7.6 17.7A9.5 7.5 0 1 0 4.4 15.4C4.3 17 3.7 18.6 2.6 19.8C4.6 19.9 6.3 19.1 7.6 17.7Z" />
    </Svg>
  );
}

const FEATURES: { icon: FeatureIcon; tint: 'mint' | 'lavender' | 'cream'; title: string }[] = [
  { icon: Smartphone, tint: 'lavender', title: 'Lock Screen check-ins' },
  { icon: Bell, tint: 'cream', title: 'Smart reminders' },
  { icon: MessageBubble, tint: 'mint', title: 'Customized presets' },
];

/**
 * Arrive Plus: a free trial or a subscription is needed to use Arrive. Shown after onboarding,
 * and whenever access lapses. There's no way past it except through the store (and, in
 * development builds only, the trial preview, which can't buy anything).
 */
export default function Paywall() {
  const app = useApp();
  const { colors, isDark } = app;
  const access = useAccess();
  // Developer tests → "Paywall with trial": shows the paywall as a first-time subscriber sees
  // it, with a 7-day free trial on both plans. Development builds only; nothing can be bought.
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const previewTrial = __DEV__ && preview === 'trial';
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
    // The plans couldn't be loaded: offers Try again, after the error banner has gone.
    [loadFailed, setLoadFailed] = useState(false),
    [note, setNote] = useState('');

  const apply = (r: Plans) => {
    setPackages(r.packages);
    setTrialEligible(r.eligible);
    if (!r.packages.yearly && r.packages.monthly) setPlan('monthly');
    setError(r.error);
    setLoadFailed(!!r.error);
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
    if (access === 'active' && Platform.OS !== 'web' && !previewTrial) router.replace('/');
  }, [access, previewTrial]);

  const selected = packages[plan];
  const trialFor = (p: Plan) => {
    const pkg = packages[p];
    if (previewTrial) return '7-day free trial';
    return pkg && trialEligible[p] ? trialLabel(pkg.product.introPrice) : null;
  };
  const trial = selected ? trialFor(plan) : null;
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
    if (previewTrial) return setNote('This is a preview, so nothing was bought.');
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
  // Under the plans: what the selected plan costs, after its free trial when there is one.
  const afterTrial = selected
    ? {
        price: `${selected.product.priceString} per ${plan === 'yearly' ? 'year' : 'month'}`,
        monthly: plan === 'yearly' ? selected.product.pricePerMonthString : null,
      }
    : null;

  return (
    <Screen
      message={{
        text: error || note,
        error: !!error,
        onHide: () => {
          setError('');
          setNote('');
        },
      }}
      footer={
        <View style={{ gap: 10 }}>
          <Button
            label={trial ? 'Start Free Trial' : 'Subscribe'}
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
            {__DEV__ &&
              (previewTrial ? (
                <FooterLink
                  label="Close preview"
                  onPress={() => router.setParams({ preview: undefined })}
                  muted
                />
              ) : (
                <FooterLink
                  label="Preview trial"
                  onPress={() => router.setParams({ preview: 'trial' })}
                  muted
                />
              ))}
          </View>
        </View>
      }
    >
      <PlusHeroArt />

      <View style={{ flexDirection: 'row', marginTop: 24 }}>
        {FEATURES.map(({ icon: Icon, tint, title }, i) => (
          <View key={title} style={{ flex: 1, flexDirection: 'row' }}>
            {i > 0 && (
              <View style={{ width: 1, marginVertical: 8, backgroundColor: colors.border }} />
            )}
            <View style={{ flex: 1, alignItems: 'center', gap: 10, paddingHorizontal: 6 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? featureTint[tint].dark : featureTint[tint].bg,
                }}
              >
                <Icon size={24} color={featureTint[tint].ink} strokeWidth={1.8} />
              </View>
              <Txt weight="bold" style={{ fontSize: 15, lineHeight: 20, textAlign: 'center' }}>
                {title}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      {/* Room above each card for its floating badge */}
      <View style={{ gap: 20, marginTop: 40 }}>
        <PlanCard
          title="Yearly"
          price={priceLine(packages.yearly, 'yr')}
          badge={trialFor('yearly') ?? (savings ? `Save ${savings}%` : undefined)}
          // What a year works out to each month, as the App Store works it out.
          aside={
            packages.yearly?.product.pricePerMonthString
              ? `Just ${packages.yearly.product.pricePerMonthString}/mo`
              : undefined
          }
          selected={plan === 'yearly'}
          disabled={!packages.yearly}
          onPress={() => setPlan('yearly')}
        />
        <PlanCard
          title="Monthly"
          price={priceLine(packages.monthly, 'mo')}
          badge={trialFor('monthly') ?? undefined}
          selected={plan === 'monthly'}
          disabled={!packages.monthly}
          onPress={() => setPlan('monthly')}
        />
      </View>

      {loadFailed && (
        <Button
          label="Try again"
          variant="ghost"
          onPress={() => {
            setLoading(true);
            setError('');
            setLoadFailed(false);
            void fetchPlans().then(apply);
          }}
          disabled={loading}
        />
      )}
      {!privacyUrl && !__DEV__ && (
        <Notice text="Subscriptions open once Arrive’s privacy policy is published." />
      )}
      {afterTrial && (
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          {/* Two lines: the trial (if any) and price, then the monthly equivalent and the terms. */}
          <Txt style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
            {!!trial && `${trial}, then `}
            <Txt weight="bold" style={{ fontSize: 14 }}>
              {afterTrial.price}
            </Txt>
          </Txt>
          <Txt tone="muted" style={{ fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            {[afterTrial.monthly && `${afterTrial.monthly}/month`, 'Cancel anytime']
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
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
  badge,
  aside,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  price: string;
  badge?: string;
  /** A note on the right of the card, such as what a year costs per month. */
  aside?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useApp();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={[title, price, aside, badge].filter(Boolean).join(', ')}
      accessibilityState={{ selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        // The selected border is 1pt thicker; the padding gives that point back, so the card
        // and its contents stay exactly where they are as the selection moves.
        paddingVertical: selected ? 15 : 16,
        paddingHorizontal: selected ? 17 : 18,
        borderRadius: 20,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.green : colors.border,
        backgroundColor: selected ? colors.softGreen : colors.surface,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: selected ? 0 : 1.5,
          borderColor: colors.muted,
          backgroundColor: selected ? colors.green : 'transparent',
        }}
      >
        {selected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="display" style={{ fontSize: 20, lineHeight: 25 }}>
          {title}
        </Txt>
        <Txt tone="muted" style={{ fontSize: 14, lineHeight: 19 }}>
          {price}
        </Txt>
      </View>
      {/* On the right: what a year works out to each month */}
      {!!aside && (
        <Txt weight="medium" style={{ fontSize: 14, lineHeight: 19 }}>
          {aside}
        </Txt>
      )}
      {/* Floating over the card's top-right corner, overlapping its edge */}
      {!!badge && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -12,
            right: 16,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: isDark ? '#4A3F22' : '#F6E3A9',
          }}
        >
          <Txt
            weight="bold"
            style={{ fontSize: 12, lineHeight: 16, color: isDark ? '#F2D071' : '#5E4A14' }}
          >
            {badge.replace(/^./, (c) => c.toUpperCase())}
          </Txt>
        </View>
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
      <Txt tone="muted" weight="medium" style={{ fontSize: 13, opacity: muted ? 0.6 : 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
