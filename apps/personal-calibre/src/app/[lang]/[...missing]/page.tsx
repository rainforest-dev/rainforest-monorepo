import { notFound } from 'next/navigation';

/** Every path no page matches, so it gets this locale's not-found page inside the shell. */
export default function MissingPage() {
  notFound();
}
