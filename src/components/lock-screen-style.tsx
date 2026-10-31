import { Pressable, View } from 'react-native';
import { BrandMark } from '@/components/brand-mark';
import { Txt } from '@/components/ui';
import { accents } from '@/design/theme';
import { useApp } from '@/state/app';
import type { Preferences } from '@/lib/types';

type Style = Preferences['lockScreenStyle'];
const options: { id: Style; label: string }[] = [
  { id: 'soft', label: 'Soft' },
  { id: 'glass', label: 'Glass' },
];
const swatches = [accents.peach, accents.mint, accents.sky, accents.cream];

/** Two small previews of the Lock Screen reminder. Picking one restyles it. */
export function LockScreenStylePicker({
  value,
  onChange,
}: {
  value: Style;
  onChange: (style: Style) => void;
}) {
  const { colors } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {options.map((o) => {
        const selected = value === o.id;
        const glass = o.id === 'glass';
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${o.label} Lock Screen design`}
            onPress={() => onChange(o.id)}
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 20,
              padding: 8,
              borderWidth: 2,
              borderColor: selected ? colors.green : colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {/* A tiny wallpaper behind the card, so the glass look reads as see-through. */}
            <View
              style={{
                borderRadius: 14,
                padding: 7,
                backgroundColor: glass ? '#51645B' : '#DCE6DA',
              }}
            >
              <View
                style={{
                  borderRadius: 11,
                  padding: 7,
                  gap: 7,
                  backgroundColor: glass ? 'rgba(16,26,22,0.72)' : '#FCFCF8',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      backgroundColor: '#287B5A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BrandMark size={11} variant="monochrome" />
                  </View>
                  <View
                    style={{
                      height: 5,
                      width: 34,
                      borderRadius: 3,
                      backgroundColor: glass ? '#F0F5ED' : '#293D36',
                      opacity: 0.8,
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {swatches.map((a, i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 18,
                        borderRadius: 5,
                        backgroundColor: glass ? `${a.ink}8C` : a.bg,
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>
            <Txt
              weight="medium"
              tone={selected ? 'green' : undefined}
              style={{ fontSize: 13, textAlign: 'center', marginTop: 7 }}
            >
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
