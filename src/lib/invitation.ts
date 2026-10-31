export function invitationMessage(installUrl?: string) {
  let link = 'arrive://people';
  // Only a publisher-supplied generic HTTPS page is permitted; never recipient data.
  if (installUrl) {
    try {
      const url = new URL(installUrl);
      if (url.protocol === 'https:' && !url.search && !url.hash && !url.username && !url.password)
        link = url.toString();
    } catch {
      /* Use the honest installed-app link until a public listing exists. */
    }
  }
  return `A little check-in, a lot of love. Try Arrive: ${link}\n${link.startsWith('arrive:') ? 'This link opens the app only if you already have Arrive installed. ' : ''}This invite does not share phone numbers or connect us automatically. Share your contact separately, or let me scan your Arrive QR.`;
}
