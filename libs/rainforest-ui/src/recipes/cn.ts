import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['meta', 'body', 'heading', 'title'] }],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts so the last one wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
