import { Badge } from '@rainforest-dev/rainforest-react';

const SHOWN_TAGS = 2;

export function TagBadges({ tags }: { tags: readonly string[] }) {
  const extra = tags.length - SHOWN_TAGS;
  return (
    <div className="flex items-center gap-1">
      {tags.slice(0, SHOWN_TAGS).map((tag) => (
        <Badge key={tag} variant="muted">
          {tag}
        </Badge>
      ))}
      {extra > 0 && (
        <span
          className="text-muted-foreground text-xs"
          title={tags.slice(SHOWN_TAGS).join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
