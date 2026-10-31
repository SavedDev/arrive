import { Notice } from './ui';
export default function PlaceMap(_props: {
  coordinate?: { latitude: number; longitude: number };
  onSelect: (coordinate: { latitude: number; longitude: number }) => void;
  height?: number;
}) {
  return (
    <Notice text="Use the mobile app to choose a point on the map. Here, you can search or use your current location." />
  );
}
