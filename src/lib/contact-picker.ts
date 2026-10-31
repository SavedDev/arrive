import { Platform } from 'react-native';
// SDK 57's class picker returns only an ID, then needs address-book access to read it.
// The supported legacy picker returns the selected contact directly, without broad permission.
import * as Contacts from 'expo-contacts/legacy';
export type PickedContact = { name: string; phones: string[]; photo?: string };
export async function chooseContact(): Promise<PickedContact | null> {
  if (Platform.OS === 'web')
    throw new Error(
      'Choose Contact is available in the mobile app. You can enter a person manually here.',
    );
  if (Platform.OS === 'android' && !(await Contacts.requestPermissionsAsync()).granted)
    throw new Error('Contact access is off. Enter the name and phone number manually instead.');
  const contact = await Contacts.presentContactPickerAsync();
  if (!contact) return null;
  return {
    // iOS leaves `name` empty for picked contacts, so build it from the parts.
    name:
      contact.name ||
      [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ') ||
      contact.nickname ||
      contact.company ||
      '',
    phones: (contact.phoneNumbers || []).map((p) => p.number || '').filter(Boolean),
    photo: contact.imageAvailable && contact.id ? await contactPhoto(contact.id) : undefined,
  };
}
// The iOS picker never includes the photo, so reading it needs Contacts access.
// Arrive only asks when the chosen contact has a photo, and falls back to initials otherwise.
async function contactPhoto(id: string) {
  try {
    const permission = await Contacts.getPermissionsAsync();
    if (
      !permission.granted &&
      !(permission.canAskAgain && (await Contacts.requestPermissionsAsync()).granted)
    )
      return undefined;
    // iOS returns a data URI when asked for base64; the file copy lives in a purgeable cache.
    const fields = [Contacts.Fields.Image, 'imageBase64' as Contacts.FieldType];
    const full = await Contacts.getContactByIdAsync(id, fields);
    const image = full?.image as (Contacts.Image & { base64?: string }) | undefined;
    return image?.base64 || (Platform.OS === 'android' ? image?.uri : undefined);
  } catch {
    return undefined;
  }
}
