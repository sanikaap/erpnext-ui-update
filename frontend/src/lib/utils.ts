import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Apple keyboards use ⌘ where everyone else uses Ctrl. */
export const isApplePlatform = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Display label for a Ctrl/⌘ + key shortcut, e.g. "⌘K" or "Ctrl K". */
export function shortcutLabel(key: string) {
  return isApplePlatform ? `⌘${key}` : `Ctrl ${key}`;
}
