import { Platform, View } from 'react-native';
import MapView, { Marker, type LatLng } from 'react-native-maps';
import { Notice } from './ui';
export type PlaceMapProps = {
  coordinate?: LatLng;
  onSelect: (coordinate: LatLng) => void;
  height?: number;
};
export default function PlaceMap({ coordinate, onSelect, height = 220 }: PlaceMapProps) {
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY)
    return (
      <Notice text="Map selection needs Google Maps configuration in this Android build. Search for a place or use your current location instead." />
    );
  const center = coordinate || { latitude: 39.5, longitude: -98.35 };
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden' }}>
      <MapView
        accessibilityLabel="Choose your place on the map"
        style={{ flex: 1 }}
        initialRegion={{
          ...center,
          latitudeDelta: coordinate ? 0.008 : 40,
          longitudeDelta: coordinate ? 0.008 : 40,
        }}
        onPress={(e) => onSelect(e.nativeEvent.coordinate)}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {coordinate && (
          <Marker
            coordinate={coordinate}
            draggable
            onDragEnd={(e) => onSelect(e.nativeEvent.coordinate)}
            pinColor="#287B5A"
            title="Your selected place"
          />
        )}
      </MapView>
    </View>
  );
}
