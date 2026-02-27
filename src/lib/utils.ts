import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) {
    return path;
  }

  const ellipsis = '...';
  const charsToShow = maxLength - ellipsis.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return path.substring(0, frontChars) + ellipsis + path.substring(path.length - backChars);
}
