import type { HistoryEntry } from './types';
export const HISTORY_TTL = 72 * 60 * 60 * 1000;
export function recentHistory(entries: HistoryEntry[], now = Date.now()) {
  return entries
    .filter((e) => {
      const time = Date.parse(e.timestamp);
      return Number.isFinite(time) && time > now - HISTORY_TTL && time <= now;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
export function latestSent(entries: HistoryEntry[], now = Date.now()) {
  return recentHistory(entries, now).find((e) => e.status === 'sent');
}
export function historyDay(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  if (date.toDateString() === now.toDateString()) return 'TODAY';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString()
    ? 'YESTERDAY'
    : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toUpperCase();
}
