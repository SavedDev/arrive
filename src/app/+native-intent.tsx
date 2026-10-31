import { checkInLinkQuery, requestSend, sendRequestFromQuery } from '@/lib/send-request';

// Check-in links (the Lock Screen reminder's places, the widget, notifications) go straight
// to Home, which opens Messages. On a cold launch, handling them here, before navigation,
// skips loading the forwarding route, so Messages appears sooner. Web has no native intents
// and uses src/app/check-in.tsx instead.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    const query = checkInLinkQuery(path);
    if (!query) return path;
    // While Arrive is already open, src/app/check-in.tsx handles the link: it closes any
    // open sheets and goes back to the Home underneath, instead of opening another Home.
    if (!initial) return path;
    requestSend(sendRequestFromQuery(query));
    return '/';
  } catch {
    return path;
  }
}
