import { Image, Text, VStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  clipShape,
  font,
  foregroundStyle,
  frame,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
const CheckIn = (_props: object, environment: WidgetEnvironment) => {
  'widget';
  const small = environment.widgetFamily === 'accessoryCircular';
  const color = environment.widgetRenderingMode === 'fullColor' ? '#287B5A' : '#FFFFFF';
  const size = small ? 42 : 40;
  return (
    <VStack modifiers={[widgetURL('arrive://check-in')]}>
      <Image
        assetName="ArriveActivityIcon"
        modifiers={[
          resizable(),
          aspectRatio({ contentMode: 'fit' }),
          frame({ width: size, height: size }),
          ...(small ? [clipShape('circle')] : []),
        ]}
      />
      {!small && (
        <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(color)]}>
          Check In
        </Text>
      )}
    </VStack>
  );
};
export default createWidget('ArriveCheckIn', CheckIn);
