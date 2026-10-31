import PlaceMap from '@/components/place-map';
import { Button, Screen, goBack } from '@/components/ui';
import { mapStart, pickOnMap, type Coordinate } from '@/lib/map-picker';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

// Fine-tunes a place's pin. Opened from the place editor, which gets the pin back on Done.
export default function MapSheet() {
  const [coordinate, setCoordinate] = useState<Coordinate | undefined>(mapStart);
  const { height } = useWindowDimensions();
  return (
    <Screen
      modal
      scroll={false}
      title="Adjust the pin"
      subtitle="Drag the pin, or tap the map, to mark the exact spot."
    >
      <PlaceMap
        coordinate={coordinate}
        onSelect={setCoordinate}
        height={Math.max(300, height - 330)}
      />
      <Button
        label="Use this spot"
        disabled={!coordinate}
        onPress={() => {
          if (coordinate) pickOnMap(coordinate);
          goBack();
        }}
        style={{ marginTop: 18 }}
      />
    </Screen>
  );
}
