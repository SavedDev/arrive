import { Button, Card, Screen, Txt } from '@/components/ui';
import { BrandMark } from '@/components/brand-mark';
import { useApp } from '@/state/app';
import { router } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { View } from 'react-native';
export default function Widget() {
  const { colors } = useApp();
  return (
    <Screen title="Lock screen widget" modal>
      <View
        style={{
          alignSelf: 'center',
          width: 220,
          height: 270,
          borderRadius: 35,
          backgroundColor: colors.softGreen,
          borderWidth: 5,
          borderColor: '#D9E4D5',
          alignItems: 'center',
          paddingTop: 22,
          marginBottom: 25,
          marginTop: 5,
        }}
      >
        <LockKeyhole size={17} color={colors.green} />
        <Txt weight="display" style={{ fontSize: 55, lineHeight: 70, color: colors.green }}>
          9:41
        </Txt>
        <Txt tone="green" style={{ fontSize: 11 }}>
          A little peace of mind
        </Txt>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 23,
          }}
        >
          <BrandMark size={50} variant="icon" />
        </View>
        <Txt tone="green" style={{ fontSize: 10, marginTop: 7 }}>
          Check In
        </Txt>
      </View>
      <Card style={{ marginBottom: 15 }}>
        {[
          'Touch and hold your iPhone Lock Screen.',
          'Tap Customize, then choose Lock Screen.',
          'Tap the widget area and find Arrive.',
          'Choose Check In, then tap Done.',
        ].map((text, i) => (
          <View key={text} style={{ flexDirection: 'row', gap: 14, marginVertical: 10 }}>
            <Txt tone="green" weight="bold">
              0{i + 1}
            </Txt>
            <Txt style={{ flex: 1, fontSize: 13 }}>{text}</Txt>
          </View>
        ))}
      </Card>
      <Button label="Done" onPress={() => router.dismissTo('/')} />
      <Txt tone="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 15 }}>
        You can also add Arrive to your iPhone Home Screen.
      </Txt>
    </Screen>
  );
}
