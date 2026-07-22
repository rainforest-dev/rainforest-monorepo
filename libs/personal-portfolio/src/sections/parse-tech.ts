export interface TechSegment {
  text: string;
  code: boolean;
}

/** Split prose into alternating plain-text and `code` segments on backtick pairs. */
export function parseTech(tech: string): TechSegment[] {
  const segments: TechSegment[] = [];
  const parts = tech.split('`');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '') continue;
    segments.push({ text: parts[i], code: i % 2 === 1 });
  }
  return segments;
}
