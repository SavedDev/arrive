import { iconNames, type IconName } from './types';

// Words people might type to find each check-in icon. The icon's own name always matches too.
// Plain data, so search can be unit tested without the icon components.
export const iconKeywords: Record<IconName, string[]> = {
  home: ['house', 'apartment', 'place', 'back'],
  gym: ['workout', 'fitness', 'exercise', 'weights', 'dumbbell', 'training'],
  grocery: ['groceries', 'supermarket', 'food', 'market', 'basket'],
  coffee: ['cafe', 'café', 'latte', 'tea', 'drink', 'cup'],
  work: ['office', 'job', 'briefcase', 'business', 'meeting'],
  pin: ['location', 'place', 'map', 'somewhere', 'marker'],
  heart: ['love', 'partner', 'date', 'favorite'],
  plane: ['airport', 'flight', 'travel', 'trip', 'vacation'],
  book: ['reading', 'study', 'class', 'lesson'],
  leaf: ['nature', 'plant', 'outdoors', 'green'],
  school: ['class', 'kids', 'pickup', 'teacher', 'education'],
  campus: ['college', 'university', 'graduation', 'class', 'student'],
  office: ['building', 'work', 'downtown', 'company'],
  hospital: ['clinic', 'emergency', 'er', 'doctor', 'health'],
  church: ['worship', 'temple', 'mosque', 'synagogue', 'service', 'faith'],
  hotel: ['motel', 'stay', 'trip', 'lodging', 'resort'],
  store: ['shop', 'mall', 'retail', 'errand'],
  library: ['books', 'study', 'reading'],
  friends: ['friend', 'people', 'hangout', 'party', 'visit', 'group'],
  bed: ['sleep', 'sleepover', 'night', 'bedroom', 'nap'],
  restaurant: ['dinner', 'lunch', 'food', 'eat', 'brunch', 'meal'],
  pizza: ['food', 'dinner', 'takeout', 'slice'],
  bakery: ['bread', 'croissant', 'pastry', 'breakfast'],
  sandwich: ['lunch', 'deli', 'food', 'sub'],
  dessert: ['ice cream', 'gelato', 'treat', 'sweet', 'frozen yogurt'],
  cake: ['birthday', 'party', 'celebration', 'dessert'],
  bar: ['beer', 'pub', 'drinks', 'brewery', 'happy hour'],
  wine: ['drinks', 'date', 'winery', 'dinner'],
  shopping: ['shop', 'mall', 'clothes', 'bag', 'store'],
  cart: ['shopping', 'groceries', 'target', 'costco', 'errand'],
  gift: ['present', 'birthday', 'party', 'holiday'],
  salon: ['hair', 'haircut', 'barber', 'nails', 'spa', 'beauty'],
  gas: ['gas station', 'fuel', 'car', 'petrol'],
  pharmacy: ['drugstore', 'medicine', 'pills', 'prescription', 'cvs', 'walgreens'],
  laundry: ['laundromat', 'clothes', 'dry cleaning', 'washing'],
  bike: ['bicycle', 'cycling', 'ride', 'biking'],
  walk: ['walking', 'stroll', 'run', 'jog', 'steps'],
  hike: ['hiking', 'trail', 'mountain', 'outdoors'],
  park: ['trees', 'playground', 'outdoors', 'nature'],
  beach: ['ocean', 'sea', 'pool', 'swim', 'water', 'lake'],
  sports: ['game', 'practice', 'volleyball', 'soccer', 'basketball', 'match'],
  trophy: ['tournament', 'win', 'competition', 'game'],
  camping: ['camp', 'tent', 'outdoors', 'campsite'],
  car: ['drive', 'driving', 'parking', 'road trip', 'dealership'],
  train: ['subway', 'metro', 'station', 'commute', 'transit'],
  bus: ['transit', 'commute', 'stop', 'school bus'],
  boat: ['ship', 'ferry', 'cruise', 'harbor', 'marina'],
  luggage: ['suitcase', 'travel', 'trip', 'packing'],
  explore: ['compass', 'adventure', 'travel', 'sightseeing'],
  landmark: ['museum', 'courthouse', 'bank', 'monument', 'city hall'],
  baby: ['daycare', 'nursery', 'kids', 'child', 'babysitter'],
  pet: ['vet', 'animal', 'paw', 'pet store', 'groomer'],
  dog: ['dog park', 'walk', 'puppy', 'vet'],
  cat: ['kitty', 'vet', 'kitten'],
  doctor: ['appointment', 'clinic', 'checkup', 'dentist', 'health'],
  family: ['parents', 'mom', 'dad', 'grandma', 'relatives', 'visit'],
  smile: ['happy', 'fun', 'good', 'dentist'],
  music: ['concert', 'lesson', 'band', 'practice', 'piano'],
  movie: ['movies', 'cinema', 'theater', 'film'],
  games: ['gaming', 'arcade', 'video games', 'game night'],
  art: ['painting', 'museum', 'class', 'studio', 'gallery'],
  camera: ['photo', 'photos', 'pictures', 'shoot'],
  tickets: ['event', 'show', 'concert', 'game', 'theater'],
  sun: ['morning', 'day', 'sunny', 'outdoors'],
  moon: ['night', 'evening', 'late', 'bedtime'],
  star: ['favorite', 'special', 'event'],
  flower: ['florist', 'garden', 'flowers', 'nursery'],
  garden: ['gardening', 'plants', 'yard', 'community garden'],
  rain: ['umbrella', 'weather', 'storm'],
};

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Icons matching what was typed, best matches first. Every word typed must match the start of
 * the icon's name or of one of its keywords, so "ice" finds dessert and "gas" finds gas.
 */
export function searchIcons(query: string): IconName[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { name: IconName; score: number }[] = [];
  iconNames.forEach((name, order) => {
    const terms = [name, ...iconKeywords[name]].map(normalize);
    // Each term's words, so "ice cream" is found by "cream" too.
    const parts = terms.flatMap((term) => [term, ...term.split(/\s+/)]);
    let score = 0;
    for (const word of words) {
      if (normalize(name) === word) score += 3;
      else if (normalize(name).startsWith(word)) score += 2;
      else if (parts.some((part) => part.startsWith(word))) score += 1;
      else return;
    }
    scored.push({ name, score: score * 100 - order });
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.name);
}
