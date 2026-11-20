import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { useApp } from '@/state/app';

/** The line explaining what replacing your person means, or '' when there's nobody to replace. */
export function replaceMessage(
  current: { name: string; smartPaired?: boolean } | undefined,
  next: string,
) {
  if (!current) return '';
  return `Arrive keeps one person. Your check-ins will go to ${next} instead of ${current.name}.${
    current.smartPaired ? ` This also ends Smart Reminders with ${current.name}.` : ''
  }`;
}

/**
 * Arrive keeps one person, so adding someone new replaces them. `confirm(name)` asks first, and
 * resolves true straight away when there's nobody to replace. Render `dialog` on the screen.
 */
export function useReplacePerson() {
  const app = useApp();
  const current = app.people[0];
  const [pending, setPending] = useState<{
    name: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const confirm = (name: string) =>
    current
      ? new Promise<boolean>((resolve) => setPending({ name, resolve }))
      : Promise.resolve(true);
  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const dialog = (
    <ConfirmDialog
      visible={!!pending}
      title={`Replace ${current?.name ?? 'your person'} with ${pending?.name ?? 'someone new'}?`}
      message={replaceMessage(current, pending?.name ?? 'them')}
      confirmLabel="Yes, replace"
      onCancel={() => answer(false)}
      onConfirm={() => answer(true)}
    />
  );
  return { confirm, dialog, current };
}
