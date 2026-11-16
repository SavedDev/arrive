import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { PlusArt } from '@/components/illustrations';
import { Txt } from '@/components/ui';
import { accents } from '@/design/theme';
import { useApp } from '@/state/app';

/** The Arrive Plus banner, shared by Home and Settings. Opens the subscription sheet. */
export function PlusBanner() {
  const { colors, isDark } = useApp();
  const cream = accents.cream;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Arrive Plus"
      onPress={() => router.push('/subscription')}
      style={({ pressed }) => ({
        backgroundColor: isDark ? cream.dark : cream.bg,
        borderRadius: 26,
        padding: 21,
        minHeight: 150,
        overflow: 'hidden',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
        <PlusArt width={132} height={112} />
      </View>
      <View style={{ maxWidth: '60%', gap: 6 }}>
        <Txt
          weight="bold"
          style={{ fontSize: 10, letterSpacing: 1.6, color: isDark ? '#F2D071' : cream.ink }}
        >
          ARRIVE PLUS
        </Txt>
        <Txt weight="rounded" style={{ fontSize: 20, lineHeight: 26 }}>
          {'Little check-ins.\nA closer you.'}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <Txt weight="bold" style={{ fontSize: 12, color: colors.green }}>
            See what’s included
          </Txt>
          <ArrowRight size={14} color={colors.green} />
        </View>
      </View>
    </Pressable>
  );
}
