import { Fragment } from 'react';

import { LINK_CLASS, linkSegments } from '@/lib';

function segments(text: string) {
  return linkSegments(text).map((segment, i) =>
    segment.kind === 'link' ? (
      <a
        key={i}
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
      >
        {segment.text}
      </a>
    ) : (
      <Fragment key={i}>{segment.text}</Fragment>
    ),
  );
}

export function LinkedText({ text }: { text: string }) {
  return segments(text);
}

export function LinkedParagraph({
  text,
  id,
  className,
}: {
  text: string;
  id?: string;
  className?: string;
}) {
  return (
    <p id={id} className={className}>
      {segments(text)}
    </p>
  );
}
