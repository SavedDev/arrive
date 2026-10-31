import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Txt, goBack } from '@/components/ui';
import { iconCategories } from '@/design/icons';
import { pickIcon } from '@/lib/icon-picker';
import type { IconName } from '@/lib/types';
import { useApp } from '@/state/app';
export default function Icons() {
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const { colors } = useApp();
  return (
    <Screen modal title="Icons">
      {iconCategories.map((category) => (
        <View key={category.title} style={{ marginBottom: 22 }}>
          <Txt weight="medium" style={{ fontSize: 13, marginBottom: 9 }}>
            {category.title}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(category.icons).map(([key, Icon]) => {
              const active = selected === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${key} icon`}
                  accessibilityState={{ selected: active }}
                  aria-selected={active}
                  onPress={() => {
                    pickIcon(key as IconName);
                    goBack();
                  }}
                  style={({ pressed }) => ({
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.softGreen : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.green : colors.border,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Icon size={23} color={colors.green} strokeWidth={1.6} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}
